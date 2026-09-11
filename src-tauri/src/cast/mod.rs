use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpStream, UdpSocket};
use tokio::sync::Mutex;
use tokio::time::timeout;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CastDevice {
    pub id: String,
    pub friendly_name: String,
    pub model_name: String,
    pub ip_address: String,
    pub port: u16,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CastMediaStatus {
    pub player_state: String, // "PLAYING", "PAUSED", "IDLE", "BUFFERING"
    pub current_time: f64,
    pub duration: f64,
    pub volume_level: f64,
    pub is_muted: bool,
}

pub struct CastManager {
    // Gerenciador de conexões ativas por IP
    active_sessions: Arc<Mutex<HashMap<String, CastSession>>>,
    http_client: reqwest::Client,
}

struct CastSession {
    transport_id: String,
    media_session_id: Option<i64>,
    tls_stream: tokio_native_tls::TlsStream<TcpStream>,
}

impl CastManager {
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .unwrap_or_default();

        Self {
            active_sessions: Arc::new(Mutex::new(HashMap::new())),
            http_client,
        }
    }

    /// Descoberta de dispositivos Google Cast (Google Home, Nest Mini, Chromecast) via mDNS na rede local
    pub async fn discover_devices(&self) -> Result<Vec<CastDevice>, String> {
        let socket = UdpSocket::bind("0.0.0.0:0")
            .await
            .map_err(|e| format!("Falha ao abrir socket UDP para mDNS: {}", e))?;

        let _ = socket.set_broadcast(true);

        // Pacote DNS PTR query formatado para: _googlecast._tcp.local
        let query_bytes: [u8; 40] = [
            0x00, 0x00, // ID: 0
            0x00, 0x00, // Flags: Standard query
            0x00, 0x01, // Questions: 1
            0x00, 0x00, // Answer RRs: 0
            0x00, 0x00, // Authority RRs: 0
            0x00, 0x00, // Additional RRs: 0
            // QNAME: _googlecast._tcp.local
            11, b'_', b'g', b'o', b'o', b'g', b'l', b'e', b'c', b'a', b's', b't',
            4, b'_', b't', b'c', b'p',
            5, b'l', b'o', b'c', b'a', b'l',
            0x00,       // End of string
            0x00, 0x0c, // QTYPE: PTR (12)
            0x00, 0x01, // QCLASS: IN (1)
        ];

        let mcast_addr: SocketAddr = "224.0.0.251:5353".parse().unwrap();
        let _ = socket.send_to(&query_bytes, mcast_addr).await;

        let mut devices_by_ip: HashMap<String, CastDevice> = HashMap::new();
        let mut buf = [0u8; 4096];
        let end_time = tokio::time::Instant::now() + Duration::from_millis(1800);

        while tokio::time::Instant::now() < end_time {
            let remaining = end_time.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() {
                break;
            }

            match timeout(remaining, socket.recv_from(&mut buf)).await {
                Ok(Ok((len, remote_addr))) => {
                    let ip = remote_addr.ip().to_string();
                    let resp_str = String::from_utf8_lossy(&buf[..len]);

                    // Verifica se é uma resposta de Google Cast
                    if resp_str.contains("googlecast") || resp_str.contains("fn=") {
                        let mut friendly_name = String::new();
                        let mut model_name = "Google Cast Audio".to_string();
                        let mut id = ip.clone();

                        // Extrai friendly name do registro TXT se presente
                        if let Some(fn_pos) = resp_str.find("fn=") {
                            let after = &resp_str[fn_pos + 3..];
                            let end_pos = after.find('\0').or_else(|| after.find('\t')).unwrap_or(after.len().min(40));
                            friendly_name = after[..end_pos].trim().to_string();
                        }

                        // Extrai model name
                        if let Some(md_pos) = resp_str.find("md=") {
                            let after = &resp_str[md_pos + 3..];
                            let end_pos = after.find('\0').or_else(|| after.find('\t')).unwrap_or(after.len().min(30));
                            model_name = after[..end_pos].trim().to_string();
                        }

                        if let Some(id_pos) = resp_str.find("id=") {
                            let after = &resp_str[id_pos + 3..];
                            let end_pos = after.find('\0').or_else(|| after.find('\t')).unwrap_or(after.len().min(32));
                            id = after[..end_pos].trim().to_string();
                        }

                        devices_by_ip.insert(
                            ip.clone(),
                            CastDevice {
                                id,
                                friendly_name,
                                model_name,
                                ip_address: ip,
                                port: 8009,
                            },
                        );
                    }
                }
                _ => break,
            }
        }

        // Enriquecer dispositivos com chamada direta à API Eureka (porta 8008)
        let mut final_list = Vec::new();
        for (ip, mut dev) in devices_by_ip {
            let eureka_url = format!("http://{}:8008/setup/eureka_info?params=name,model_name", ip);
            if let Ok(res) = self.http_client.get(&eureka_url).send().await {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    if let Some(name) = json.get("name").and_then(|v| v.as_str()) {
                        dev.friendly_name = name.to_string();
                    }
                    if let Some(model) = json.get("model_name").and_then(|v| v.as_str()) {
                        dev.model_name = model.to_string();
                    }
                    if let Some(ssdp_udn) = json.get("ssdp_udn").and_then(|v| v.as_str()) {
                        dev.id = ssdp_udn.to_string();
                    }
                }
            }

            if dev.friendly_name.is_empty() {
                dev.friendly_name = format!("Google Cast ({})", dev.ip_address);
            }

            final_list.push(dev);
        }

        Ok(final_list)
    }

    /// Conecta ao Google Cast via TLS na porta 8009 e inicializa a sessão com Default Media Receiver
    async fn connect_to_device(
        &self,
        ip: &str,
        port: u16,
    ) -> Result<tokio_native_tls::TlsStream<TcpStream>, String> {
        let addr = format!("{}:{}", ip, port);
        let tcp = TcpStream::connect(&addr)
            .await
            .map_err(|e| format!("Falha TCP ao conectar no Google Cast em {}: {}", addr, e))?;

        // Google Cast utiliza certificados auto-assinados pela CA de hardware da Google
        let mut builder = native_tls::TlsConnector::builder();
        builder.danger_accept_invalid_certs(true);
        builder.danger_accept_invalid_hostnames(true);

        let connector = builder
            .build()
            .map_err(|e| format!("Falha ao construir TLS connector: {}", e))?;
        let tokio_connector = tokio_native_tls::TlsConnector::from(connector);

        let tls = tokio_connector
            .connect(ip, tcp)
            .await
            .map_err(|e| format!("Falha no handshake TLS com Google Cast: {}", e))?;

        Ok(tls)
    }

    /// Envia uma mensagem CastMessage enquadrada com prefixo de tamanho em 4 bytes Big-Endian
    async fn send_cast_message(
        stream: &mut tokio_native_tls::TlsStream<TcpStream>,
        source_id: &str,
        destination_id: &str,
        namespace: &str,
        payload_json: &str,
    ) -> Result<(), String> {
        let proto_bytes = encode_cast_message(source_id, destination_id, namespace, payload_json);
        let len = proto_bytes.len() as u32;
        let mut packet = len.to_be_bytes().to_vec();
        packet.extend_from_slice(&proto_bytes);

        stream
            .write_all(&packet)
            .await
            .map_err(|e| format!("Falha ao enviar dados para Google Cast: {}", e))?;
        stream
            .flush()
            .await
            .map_err(|e| format!("Falha no flush do stream: {}", e))?;

        Ok(())
    }

    /// Inicia streaming no Google Cast usando o Default Media Receiver nativo (CC1AD845)
    pub async fn load_and_play(
        &self,
        ip: &str,
        port: u16,
        stream_url: &str,
        title: &str,
        artist: &str,
    ) -> Result<(), String> {
        let mut stream = self.connect_to_device(ip, port).await?;

        // 1. Mensagem de handshake: CONNECT para receiver-0
        Self::send_cast_message(
            &mut stream,
            "sender-0",
            "receiver-0",
            "urn:x-cast:com.google.cast.tp.connection",
            r#"{"type":"CONNECT"}"#,
        )
        .await?;

        // 2. Inicia o app Default Media Receiver nativo da Google (CC1AD845)
        Self::send_cast_message(
            &mut stream,
            "sender-0",
            "receiver-0",
            "urn:x-cast:com.google.cast.receiver",
            r#"{"type":"LAUNCH","appId":"CC1AD845","requestId":1}"#,
        )
        .await?;

        // 3. Aguarda resposta com transportId do Media Receiver
        let mut transport_id = "receiver-0".to_string();
        let media_session_id = None;

        let end_wait = tokio::time::Instant::now() + Duration::from_millis(3000);
        while tokio::time::Instant::now() < end_wait {
            if let Ok(Ok(msg)) = timeout(Duration::from_millis(600), read_next_cast_payload(&mut stream)).await {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&msg) {
                    if let Some(apps) = val.get("status").and_then(|s| s.get("applications")).and_then(|a| a.as_array()) {
                        for app in apps {
                            if app.get("appId").and_then(|id| id.as_str()) == Some("CC1AD845") {
                                if let Some(t_id) = app.get("transportId").and_then(|t| t.as_str()) {
                                    transport_id = t_id.to_string();
                                    break;
                                }
                            }
                        }
                    }
                    if transport_id != "receiver-0" {
                        break;
                    }
                }
            }
        }

        // 4. Conecta diretamente ao transportId do app de mídia
        Self::send_cast_message(
            &mut stream,
            "sender-0",
            &transport_id,
            "urn:x-cast:com.google.cast.tp.connection",
            r#"{"type":"CONNECT"}"#,
        )
        .await?;

        // 5. Envia comando LOAD com os dados da faixa
        let load_payload = serde_json::json!({
            "type": "LOAD",
            "requestId": 2,
            "media": {
                "contentId": stream_url,
                "streamType": "BUFFERED",
                "contentType": "audio/mp3",
                "metadata": {
                    "metadataType": 3, // Music Track
                    "title": title,
                    "artist": artist
                }
            },
            "autoplay": true,
            "currentTime": 0
        })
        .to_string();

        Self::send_cast_message(
            &mut stream,
            "sender-0",
            &transport_id,
            "urn:x-cast:com.google.cast.media",
            &load_payload,
        )
        .await?;

        // 6. Armazena a sessão ativa para permitir Pause, Play, Stop e Volume
        let mut sessions = self.active_sessions.lock().await;
        sessions.insert(
            ip.to_string(),
            CastSession {
                transport_id,
                media_session_id,
                tls_stream: stream,
            },
        );

        println!("[GoogleCast] Mídia carregada com sucesso em {} ({})", ip, title);

        Ok(())
    }

    /// Pausa a reprodução no Google Cast
    pub async fn pause(&self, ip: &str) -> Result<(), String> {
        let mut sessions = self.active_sessions.lock().await;
        if let Some(session) = sessions.get_mut(ip) {
            let payload = serde_json::json!({
                "type": "PAUSE",
                "requestId": 10,
                "mediaSessionId": session.media_session_id.unwrap_or(1)
            })
            .to_string();

            Self::send_cast_message(
                &mut session.tls_stream,
                "sender-0",
                &session.transport_id,
                "urn:x-cast:com.google.cast.media",
                &payload,
            )
            .await?;
        }
        Ok(())
    }

    /// Retoma a reprodução no Google Cast
    pub async fn play(&self, ip: &str) -> Result<(), String> {
        let mut sessions = self.active_sessions.lock().await;
        if let Some(session) = sessions.get_mut(ip) {
            let payload = serde_json::json!({
                "type": "PLAY",
                "requestId": 11,
                "mediaSessionId": session.media_session_id.unwrap_or(1)
            })
            .to_string();

            Self::send_cast_message(
                &mut session.tls_stream,
                "sender-0",
                &session.transport_id,
                "urn:x-cast:com.google.cast.media",
                &payload,
            )
            .await?;
        }
        Ok(())
    }

    /// Interrompe a reprodução no Google Cast
    pub async fn stop(&self, ip: &str) -> Result<(), String> {
        let mut sessions = self.active_sessions.lock().await;
        if let Some(mut session) = sessions.remove(ip) {
            let payload = serde_json::json!({
                "type": "STOP",
                "requestId": 12,
                "mediaSessionId": session.media_session_id.unwrap_or(1)
            })
            .to_string();

            let _ = Self::send_cast_message(
                &mut session.tls_stream,
                "sender-0",
                &session.transport_id,
                "urn:x-cast:com.google.cast.media",
                &payload,
            )
            .await;
        }
        Ok(())
    }

    /// Ajusta o volume no Google Cast (0.0 a 1.0)
    pub async fn set_volume(&self, ip: &str, level: f64) -> Result<(), String> {
        let clamped = level.clamp(0.0, 1.0);
        let mut sessions = self.active_sessions.lock().await;
        if let Some(session) = sessions.get_mut(ip) {
            let payload = serde_json::json!({
                "type": "SET_VOLUME",
                "requestId": 13,
                "volume": { "level": clamped }
            })
            .to_string();

            let _ = Self::send_cast_message(
                &mut session.tls_stream,
                "sender-0",
                "receiver-0",
                "urn:x-cast:com.google.cast.receiver",
                &payload,
            )
            .await;
        }
        Ok(())
    }
}

/// Lê o próximo payload JSON de uma mensagem CastMessage do stream TLS
async fn read_next_cast_payload(
    stream: &mut tokio_native_tls::TlsStream<TcpStream>,
) -> Result<String, String> {
    let mut len_bytes = [0u8; 4];
    stream
        .read_exact(&mut len_bytes)
        .await
        .map_err(|e| format!("Erro ao ler tamanho da mensagem: {}", e))?;

    let msg_len = u32::from_be_bytes(len_bytes) as usize;
    if msg_len > 65536 {
        return Err("Tamanho de mensagem inválido do Google Cast".to_string());
    }

    let mut buf = vec![0u8; msg_len];
    stream
        .read_exact(&mut buf)
        .await
        .map_err(|e| format!("Erro ao ler corpo da mensagem: {}", e))?;

    // Extrai o campo payload_utf8 (tag 6 no protobuf = 0x32)
    let payload = extract_protobuf_string(&buf, 6).unwrap_or_default();
    Ok(payload)
}

/// Codificador Protobuf leve e sem dependências externas para CastMessage
fn encode_cast_message(
    source_id: &str,
    destination_id: &str,
    namespace: &str,
    payload_utf8: &str,
) -> Vec<u8> {
    let mut out = Vec::with_capacity(256);

    // Campo 1: protocol_version = CASTV2_1_0 (0) -> (1 << 3) | 0 = 0x08
    out.push(0x08);
    out.push(0x00);

    // Campo 2: source_id (string, tag = (2 << 3) | 2 = 0x12)
    write_proto_string(&mut out, 2, source_id);

    // Campo 3: destination_id (string, tag = (3 << 3) | 2 = 0x1a)
    write_proto_string(&mut out, 3, destination_id);

    // Campo 4: namespace (string, tag = (4 << 3) | 2 = 0x22)
    write_proto_string(&mut out, 4, namespace);

    // Campo 5: payload_type = STRING (0) -> (5 << 3) | 0 = 0x28
    out.push(0x28);
    out.push(0x00);

    // Campo 6: payload_utf8 (string, tag = (6 << 3) | 2 = 0x32)
    write_proto_string(&mut out, 6, payload_utf8);

    out
}

fn write_proto_string(buf: &mut Vec<u8>, field_number: u32, s: &str) {
    let tag = (field_number << 3) | 2;
    encode_varint(buf, tag as u64);
    encode_varint(buf, s.len() as u64);
    buf.extend_from_slice(s.as_bytes());
}

fn encode_varint(buf: &mut Vec<u8>, mut val: u64) {
    while val >= 0x80 {
        buf.push(((val & 0x7F) as u8) | 0x80);
        val >>= 7;
    }
    buf.push(val as u8);
}

fn extract_protobuf_string(data: &[u8], target_field: u32) -> Option<String> {
    let target_tag = (target_field << 3) | 2;
    let mut i = 0;
    while i < data.len() {
        let (tag, tag_len) = read_varint(&data[i..])?;
        i += tag_len;

        let wire_type = tag & 0x07;
        match wire_type {
            0 => {
                let (_, v_len) = read_varint(&data[i..])?;
                i += v_len;
            }
            2 => {
                let (length, l_len) = read_varint(&data[i..])?;
                i += l_len;
                let len = length as usize;
                if i + len > data.len() {
                    return None;
                }
                if tag == target_tag as u64 {
                    return String::from_utf8(data[i..i + len].to_vec()).ok();
                }
                i += len;
            }
            _ => break,
        }
    }
    None
}

fn read_varint(data: &[u8]) -> Option<(u64, usize)> {
    let mut val = 0u64;
    let mut shift = 0;
    for (idx, &byte) in data.iter().enumerate() {
        val |= ((byte & 0x7F) as u64) << shift;
        if (byte & 0x80) == 0 {
            return Some((val, idx + 1));
        }
        shift += 7;
        if shift >= 64 {
            return None;
        }
    }
    None
}
