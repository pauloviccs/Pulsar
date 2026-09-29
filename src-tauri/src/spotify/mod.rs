use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::link_resolver;
use crate::youtube::{TrackMetadata, YouTubeSidecar};

/// Credenciais padrão embutidas da aplicação Pulsar no Spotify Developer Dashboard.
/// Usadas no Client Credentials Flow (sem login do usuário, só playlists públicas).
const DEFAULT_CLIENT_ID: &str = "PULSAR_SPOTIFY_CLIENT_ID_PLACEHOLDER";
const DEFAULT_CLIENT_SECRET: &str = "PULSAR_SPOTIFY_CLIENT_SECRET_PLACEHOLDER";

/// Metadados extraídos de uma faixa do Spotify
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyTrackMeta {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: i64,
    pub cover_url: String,
    pub spotify_id: String,
}

/// Nível de confiança do match YouTube ↔ Spotify
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchConfidence {
    High,
    Medium,
    Low,
    NotFound,
}

/// Resultado de resolução de uma faixa Spotify → YouTube
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyResolvedTrack {
    pub track: TrackMetadata,
    pub confidence: MatchConfidence,
    pub spotify_meta: SpotifyTrackMeta,
}

/// Token de acesso do Spotify com expiração
struct CachedToken {
    access_token: String,
    expires_at: Instant,
}

/// Resolver de metadados Spotify via Web API + busca correspondente no YouTube
pub struct SpotifyResolver {
    client_id: String,
    client_secret: String,
    cached_token: Mutex<Option<CachedToken>>,
}

impl SpotifyResolver {
    pub fn new(client_id: Option<String>, client_secret: Option<String>) -> Self {
        Self {
            client_id: client_id.unwrap_or_else(|| DEFAULT_CLIENT_ID.to_string()),
            client_secret: client_secret.unwrap_or_else(|| DEFAULT_CLIENT_SECRET.to_string()),
            cached_token: Mutex::new(None),
        }
    }

    /// Client Credentials Flow: obtém Bearer token sem login do usuário
    async fn authenticate(&self) -> Result<String, String> {
        // Verificar se as credenciais foram configuradas pelo usuário
        if self.client_id == DEFAULT_CLIENT_ID
            || self.client_secret == DEFAULT_CLIENT_SECRET
            || self.client_id.trim().is_empty()
            || self.client_secret.trim().is_empty()
        {
            return Err("Credenciais da API Spotify não configuradas. Por favor, insira seu Client ID e Client Secret gratuitos do Spotify.".to_string());
        }

        // Verificar cache
        {
            let cache = self.cached_token.lock().map_err(|e| e.to_string())?;
            if let Some(ref token) = *cache {
                if Instant::now() < token.expires_at {
                    return Ok(token.access_token.clone());
                }
            }
        }

        let client = reqwest::Client::new();
        let response = client
            .post("https://accounts.spotify.com/api/token")
            .basic_auth(&self.client_id, Some(&self.client_secret))
            .header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded")
            .body("grant_type=client_credentials")
            .send()
            .await
            .map_err(|e| format!("Erro ao conectar com Spotify: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            if body.contains("invalid_client") {
                return Err("Credenciais do Spotify inválidas. Verifique se o Client ID e Client Secret foram copiados corretamente do painel do Spotify.".to_string());
            }
            return Err(format!("Spotify retornou {} na autenticação: {}", status, body));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Erro ao decodificar resposta do Spotify: {}", e))?;

        let access_token = json.get("access_token")
            .and_then(|v| v.as_str())
            .ok_or("Token de acesso ausente na resposta do Spotify")?
            .to_string();

        let expires_in = json.get("expires_in")
            .and_then(|v| v.as_u64())
            .unwrap_or(3600);

        // Cache com 60s de margem de segurança
        let expires_at = Instant::now() + Duration::from_secs(expires_in.saturating_sub(60));

        {
            let mut cache = self.cached_token.lock().map_err(|e| e.to_string())?;
            *cache = Some(CachedToken {
                access_token: access_token.clone(),
                expires_at,
            });
        }

        Ok(access_token)
    }

    /// Testa se as credenciais são válidas
    #[allow(dead_code)]
    pub async fn test_connection(&self) -> Result<bool, String> {
        let token = self.authenticate().await?;

        let client = reqwest::Client::new();
        let resp = client
            .get("https://api.spotify.com/v1/browse/categories?limit=1")
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| format!("Erro ao testar conexão Spotify: {}", e))?;

        Ok(resp.status().is_success())
    }

    /// Extrai metadados de uma faixa individual do Spotify
    pub async fn resolve_track(&self, url: &str) -> Result<SpotifyTrackMeta, String> {
        let track_id = link_resolver::extract_spotify_id(url)
            .ok_or("ID de faixa inválido na URL do Spotify")?;

        let token = self.authenticate().await?;

        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| format!("Falha ao inicializar cliente HTTP: {}", e))?;
        let resp = client
            .get(format!("https://api.spotify.com/v1/tracks/{}", track_id))
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| format!("Erro ao buscar faixa do Spotify: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            if status.as_u16() == 404 {
                return Err("Faixa não encontrada no Spotify.".to_string());
            }
            return Err(format!("Spotify retornou {} ao buscar faixa", status));
        }

        let json: serde_json::Value = resp.json().await
            .map_err(|e| format!("Erro ao decodificar faixa do Spotify: {}", e))?;

        Self::parse_track_json(&json)
    }

    /// Extrai todas as faixas de uma playlist pública do Spotify (com paginação automática e alta resiliência a instabilidades do gateway)
    pub async fn resolve_playlist(&self, url: &str) -> Result<(String, String, Vec<SpotifyTrackMeta>), String> {
        let playlist_id = link_resolver::extract_spotify_id(url)
            .ok_or("ID de playlist inválido na URL do Spotify")?;

        let token = self.authenticate().await?;
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| format!("Falha ao inicializar cliente HTTP: {}", e))?;

        // Buscar dados da playlist (sem o parâmetro ?fields que causa 502 Bad Gateway em servidores de borda do Spotify)
        let mut attempts = 0;
        let mut pl_json: Option<serde_json::Value> = None;
        let mut last_status = None;

        while attempts < 3 {
            attempts += 1;
            let req = client
                .get(format!("https://api.spotify.com/v1/playlists/{}", playlist_id))
                .bearer_auth(&token);

            match req.send().await {
                Ok(resp) => {
                    let status = resp.status();
                    last_status = Some(status);

                    if status.is_success() {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            pl_json = Some(json);
                            break;
                        }
                    } else if status.as_u16() == 404 {
                        return Err("Playlist não encontrada no Spotify. Verifique se o link ou ID está correto.".to_string());
                    } else if status.as_u16() == 401 || status.as_u16() == 403 {
                        return Err("Esta playlist é privada ou inacessível no Spotify. Ela precisa ser pública para ser importada.".to_string());
                    } else if status.as_u16() >= 500 {
                        // 502 Bad Gateway / 503 / 504 no servidor do Spotify: aguarda e tenta novamente
                        println!("[Pulsar Spotify] Servidor do Spotify retornou {} na tentativa {}. Tentando novamente...", status, attempts);
                        tokio::time::sleep(Duration::from_millis(600 * attempts as u64)).await;
                    } else {
                        return Err(format!("Spotify retornou código HTTP {} ao buscar playlist.", status));
                    }
                }
                Err(e) => {
                    println!("[Pulsar Spotify] Erro de rede ao conectar com Spotify na tentativa {}: {}", attempts, e);
                    tokio::time::sleep(Duration::from_millis(600 * attempts as u64)).await;
                }
            }
        }

        let pl_json = match pl_json {
            Some(j) => j,
            None => {
                let status_str = last_status.map(|s| s.to_string()).unwrap_or_else(|| "502 Bad Gateway".to_string());
                return Err(format!(
                    "O servidor do Spotify apresentou instabilidade temporária ({}) ou a playlist não pôde ser acessada. Certifique-se de que a playlist está configurada como Pública no Spotify.",
                    status_str
                ));
            }
        };

        let playlist_name = pl_json.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Playlist do Spotify")
            .to_string();

        let playlist_cover = pl_json.get("images")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .and_then(|img| img.get("url"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // 1. Coleta das faixas iniciais já retornadas no payload principal (até 100)
        let mut tracks = Vec::new();
        if let Some(items) = pl_json.get("tracks").and_then(|t| t.get("items")).and_then(|v| v.as_array()) {
            for item in items {
                if let Some(track) = item.get("track") {
                    if let Ok(meta) = Self::parse_track_json(track) {
                        tracks.push(meta);
                    }
                }
            }
        }

        // 2. Se houver mais páginas além das 100 primeiras, continuar a paginação
        let has_more = pl_json.get("tracks")
            .and_then(|t| t.get("next"))
            .map(|v| !v.is_null())
            .unwrap_or(false);

        if has_more {
            let mut offset = 100u32;
            let limit = 100u32;

            loop {
                let tracks_resp = client
                    .get(format!(
                        "https://api.spotify.com/v1/playlists/{}/tracks?offset={}&limit={}",
                        playlist_id, offset, limit
                    ))
                    .bearer_auth(&token)
                    .send()
                    .await;

                let tracks_resp = match tracks_resp {
                    Ok(r) if r.status().is_success() => r,
                    _ => break,
                };

                let tracks_json: serde_json::Value = match tracks_resp.json().await {
                    Ok(j) => j,
                    Err(_) => break,
                };

                if let Some(items) = tracks_json.get("items").and_then(|v| v.as_array()) {
                    for item in items {
                        if let Some(track) = item.get("track") {
                            if let Ok(meta) = Self::parse_track_json(track) {
                                tracks.push(meta);
                            }
                        }
                    }
                }

                let has_next = tracks_json.get("next")
                    .map(|v: &serde_json::Value| !v.is_null())
                    .unwrap_or(false);

                if !has_next {
                    break;
                }

                offset += limit;
            }
        }

        Ok((playlist_name, playlist_cover, tracks))
    }

    /// Extrai todas as faixas de um álbum do Spotify
    pub async fn resolve_album(&self, url: &str) -> Result<(String, String, Vec<SpotifyTrackMeta>), String> {
        let album_id = link_resolver::extract_spotify_id(url)
            .ok_or("ID de álbum inválido na URL do Spotify")?;

        let token = self.authenticate().await?;
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| format!("Falha ao inicializar cliente HTTP: {}", e))?;

        // Buscar dados do álbum com retentativas em caso de erro temporário
        let mut attempts = 0;
        let mut album_json: Option<serde_json::Value> = None;
        let mut last_status = None;

        while attempts < 3 {
            attempts += 1;
            let req = client
                .get(format!("https://api.spotify.com/v1/albums/{}", album_id))
                .bearer_auth(&token);

            match req.send().await {
                Ok(resp) => {
                    let status = resp.status();
                    last_status = Some(status);

                    if status.is_success() {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            album_json = Some(json);
                            break;
                        }
                    } else if status.as_u16() == 404 {
                        return Err("Álbum não encontrado no Spotify. Verifique se o link está correto.".to_string());
                    } else if status.as_u16() == 401 || status.as_u16() == 403 {
                        return Err("Este álbum é privado ou inacessível no Spotify.".to_string());
                    } else if status.as_u16() >= 500 {
                        println!("[Pulsar Spotify] Servidor do Spotify retornou {} no álbum. Tentativa {}...", status, attempts);
                        tokio::time::sleep(Duration::from_millis(600 * attempts as u64)).await;
                    } else {
                        return Err(format!("Spotify retornou código HTTP {} ao buscar álbum.", status));
                    }
                }
                Err(e) => {
                    println!("[Pulsar Spotify] Erro ao conectar para álbum na tentativa {}: {}", attempts, e);
                    tokio::time::sleep(Duration::from_millis(600 * attempts as u64)).await;
                }
            }
        }

        let album_json = match album_json {
            Some(j) => j,
            None => {
                let status_str = last_status.map(|s| s.to_string()).unwrap_or_else(|| "indisponível".to_string());
                return Err(format!("Os servidores do Spotify estão instáveis ({}) ao buscar o álbum. Tente novamente em instantes.", status_str));
            }
        };

        let album_name = album_json.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Álbum do Spotify")
            .to_string();

        let album_cover = album_json.get("images")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .and_then(|img| img.get("url"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let album_artist = album_json.get("artists")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .and_then(|a| a.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("Artista Desconhecido")
            .to_string();

        let mut tracks = Vec::new();

        if let Some(items) = album_json.get("tracks")
            .and_then(|t| t.get("items"))
            .and_then(|v| v.as_array())
        {
            for item in items {
                let title = item.get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Faixa")
                    .to_string();

                let artist = item.get("artists")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
                            .collect::<Vec<&str>>()
                            .join(", ")
                    })
                    .unwrap_or_else(|| album_artist.clone());

                let duration_ms = item.get("duration_ms")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);

                let spotify_id = item.get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                tracks.push(SpotifyTrackMeta {
                    title,
                    artist,
                    album: album_name.clone(),
                    duration_ms,
                    cover_url: album_cover.clone(),
                    spotify_id,
                });
            }
        }

        Ok((album_name, album_cover, tracks))
    }

    /// Busca a faixa correspondente no YouTube via yt-dlp com scoring de confiança
    pub async fn search_youtube(meta: &SpotifyTrackMeta) -> Result<SpotifyResolvedTrack, String> {
        let query = format!("{} - {}", meta.artist, meta.title);
        let search_url = format!("ytsearch1:{}", query);

        let result = YouTubeSidecar::extract_info(&search_url).await;

        match result {
            Ok(mut track) => {
                // Scoring de confiança baseado na diferença de duração
                let spotify_duration_s = meta.duration_ms / 1000;
                let diff = (track.duration_seconds - spotify_duration_s).abs();

                let confidence = if diff <= 15 {
                    MatchConfidence::High
                } else if diff <= 35 {
                    MatchConfidence::Medium
                } else {
                    MatchConfidence::Low
                };

                // Preservar metadados limpos e oficiais do Spotify
                if !meta.title.is_empty() {
                    track.title = meta.title.clone();
                }
                if !meta.artist.is_empty() {
                    track.artist_guess = meta.artist.clone();
                }
                if !meta.cover_url.is_empty() {
                    track.thumbnail_url = meta.cover_url.clone();
                }

                Ok(SpotifyResolvedTrack {
                    track,
                    confidence,
                    spotify_meta: meta.clone(),
                })
            }
            Err(e) => {
                println!("[Pulsar Spotify] Nenhum match no YouTube para '{}': {}", query, e);
                Ok(SpotifyResolvedTrack {
                    track: TrackMetadata {
                        id: uuid::Uuid::new_v4().to_string(),
                        youtube_video_id: String::new(),
                        title: meta.title.clone(),
                        artist_guess: meta.artist.clone(),
                        channel_name: meta.artist.clone(),
                        duration_seconds: meta.duration_ms / 1000,
                        thumbnail_url: meta.cover_url.clone(),
                        stream_url: String::new(),
                    },
                    confidence: MatchConfidence::NotFound,
                    spotify_meta: meta.clone(),
                })
            }
        }
    }

    /// Utilitário para parsear JSON de faixa do Spotify em SpotifyTrackMeta
    fn parse_track_json(json: &serde_json::Value) -> Result<SpotifyTrackMeta, String> {
        let title = json.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Faixa Desconhecida")
            .to_string();

        let artist = json.get("artists")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
                    .collect::<Vec<&str>>()
                    .join(", ")
            })
            .unwrap_or_else(|| "Artista Desconhecido".to_string());

        let album = json.get("album")
            .and_then(|a| a.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let duration_ms = json.get("duration_ms")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        let cover_url = json.get("album")
            .and_then(|a| a.get("images"))
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .and_then(|img| img.get("url"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let spotify_id = json.get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        Ok(SpotifyTrackMeta {
            title,
            artist,
            album,
            duration_ms,
            cover_url,
            spotify_id,
        })
    }
}
