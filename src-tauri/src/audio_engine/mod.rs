use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use futures_util::TryStreamExt;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use tower_http::cors::CorsLayer;

use crate::youtube::YouTubeSidecar;

pub const PROXY_PORT: u16 = 41235;

#[derive(Clone)]
pub struct StreamState {
    pub cache_dir: PathBuf,
    pub active_urls: Arc<RwLock<HashMap<String, String>>>,
    pub http_client: reqwest::Client,
}

impl StreamState {
    pub fn new() -> Self {
        let mut cache_dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
        cache_dir.push("com.pulsar.app");
        cache_dir.push("cache");

        if !cache_dir.exists() {
            let _ = fs::create_dir_all(&cache_dir);
        }

        Self {
            cache_dir,
            active_urls: Arc::new(RwLock::new(HashMap::new())),
            http_client: reqwest::Client::builder()
                .build()
                .unwrap_or_default(),
        }
    }

    pub fn register_url(&self, video_id: String, stream_url: String) {
        if let Ok(mut lock) = self.active_urls.write() {
            lock.insert(video_id, stream_url);
        }
    }

    pub fn get_url(&self, video_id: &str) -> Option<String> {
        self.active_urls.read().ok()?.get(video_id).cloned()
    }

    pub fn clear_active_urls(&self) {
        if let Ok(mut lock) = self.active_urls.write() {
            lock.clear();
        }
    }
}

/// Obtém o IP da interface de rede local ativa (LAN) usando o kernel routing table
pub fn get_local_ip() -> String {
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(local_addr) = socket.local_addr() {
                let ip = local_addr.ip();
                if !ip.is_loopback() && !ip.is_unspecified() {
                    return ip.to_string();
                }
            }
        }
    }
    "127.0.0.1".to_string()
}

pub fn get_local_stream_base_url() -> String {
    let ip = get_local_ip();
    format!("http://{}:{}", ip, PROXY_PORT)
}

pub async fn start_proxy_server(state: StreamState) {
    let app = Router::new()
        .route("/stream/{video_id}", get(handle_stream))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", PROXY_PORT);
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[Pulsar Proxy] Falha ao vincular na porta {}: {}", PROXY_PORT, e);
            return;
        }
    };

    let local_ip = get_local_ip();
    println!(
        "[Pulsar Proxy] Servidor local de streaming ouvindo em 0.0.0.0:{} (Acessível na LAN: http://{}:{})",
        PROXY_PORT, local_ip, PROXY_PORT
    );

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("[Pulsar Proxy] Erro no servidor de streaming: {}", e);
    }
}

async fn handle_stream(
    Path(video_id): Path<String>,
    headers: HeaderMap,
    State(state): State<StreamState>,
) -> Response {
    // 1. Verificar se já existe cache no disco
    let cached_file = state.cache_dir.join(format!("{}.m4a", video_id));
    if cached_file.exists() {
        if let Ok(file) = tokio::fs::File::open(&cached_file).await {
            let stream = tokio_util::io::ReaderStream::new(file);
            let body = Body::from_stream(stream);
            return (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "audio/mp4")],
                body,
            ).into_response();
        }
    }

    // 2. Obter a URL do stream do YouTube
    let raw_url = match state.get_url(&video_id) {
        Some(url) => url,
        None => {
            // Re-resolver via sidecar se não estiver na memória
            match YouTubeSidecar::get_direct_stream_url(&video_id).await {
                Ok(url) => {
                    state.register_url(video_id.clone(), url.clone());
                    url
                }
                Err(e) => {
                    return (
                        StatusCode::NOT_FOUND,
                        format!("Stream não encontrado para {}: {}", video_id, e),
                    ).into_response();
                }
            }
        }
    };

    // 3. Fazer proxy com repasse de cabeçalho Range (Scrubbing / Seek)
    let mut req = state.http_client.get(&raw_url);

    if let Some(range) = headers.get(header::RANGE) {
        if let Ok(range_str) = range.to_str() {
            req = req.header("Range", range_str);
        }
    }

    let mut upstream_res = match req.send().await {
        Ok(res) => res,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                format!("Erro ao contatar stream do YouTube: {}", e),
            ).into_response();
        }
    };

    let mut status = upstream_res.status();

    // Auto-Recovery: Se a URL expirou ou o YouTube retornou 403/410 devido a concorrência com o player de vídeo,
    // re-resolvemos um stream direto novo e retentamos imediatamente para manter a Smart TV tocando!
    if status == StatusCode::FORBIDDEN || status == StatusCode::GONE {
        crate::logger::log_warn(&format!(
            "[Pulsar Proxy] URL do YouTube retornou {} para {}. Re-resolvendo link direto...",
            status, video_id
        ));
        if let Ok(new_url) = YouTubeSidecar::get_direct_stream_url(&video_id).await {
            state.register_url(video_id.clone(), new_url.clone());
            let mut retry_req = state.http_client.get(&new_url);
            if let Some(range) = headers.get(header::RANGE) {
                if let Ok(range_str) = range.to_str() {
                    retry_req = retry_req.header("Range", range_str);
                }
            }
            if let Ok(new_res) = retry_req.send().await {
                status = new_res.status();
                upstream_res = new_res;
            }
        }
    }
    let mut response_headers = HeaderMap::new();

    // Repassar cabeçalhos vitais de áudio
    if let Some(ct) = upstream_res.headers().get(header::CONTENT_TYPE) {
        response_headers.insert(header::CONTENT_TYPE, ct.clone());
    } else {
        response_headers.insert(header::CONTENT_TYPE, "audio/mp4".parse().unwrap());
    }

    if let Some(cl) = upstream_res.headers().get(header::CONTENT_LENGTH) {
        response_headers.insert(header::CONTENT_LENGTH, cl.clone());
    }

    if let Some(cr) = upstream_res.headers().get(header::CONTENT_RANGE) {
        response_headers.insert(header::CONTENT_RANGE, cr.clone());
    }

    response_headers.insert(header::ACCEPT_RANGES, "bytes".parse().unwrap());

    let body_stream = upstream_res.bytes_stream().map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e));
    let body = Body::from_stream(body_stream);

    let mut response = Response::new(body);
    *response.status_mut() = StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::OK);
    *response.headers_mut() = response_headers;

    response
}
