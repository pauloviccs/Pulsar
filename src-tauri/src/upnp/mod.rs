use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::net::SocketAddr;
use std::time::Duration;
use tokio::net::UdpSocket;
use tokio::time::timeout;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpnpDevice {
    pub id: String,
    pub friendly_name: String,
    pub location_url: String,
    pub av_transport_url: Option<String>,
    pub rendering_control_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpnpPositionInfo {
    pub track_duration_seconds: f64,
    pub current_position_seconds: f64,
    pub transport_state: String,
}

// Extrai o conteúdo entre tags <tag>...</tag> de forma simples e tolerante
fn extract_tag_content(xml: &str, tag_name: &str) -> Option<String> {
    let open_tag = format!("<{}", tag_name);
    let close_tag = format!("</{}", tag_name);

    if let Some(start_idx) = xml.find(&open_tag) {
        let after_open = &xml[start_idx..];
        if let Some(bracket_end) = after_open.find('>') {
            let content_start = start_idx + bracket_end + 1;
            let remaining = &xml[content_start..];
            if let Some(end_idx) = remaining.find(&close_tag) {
                return Some(remaining[..end_idx].trim().to_string());
            }
        }
    }
    None
}

// Resolve URLs relativas contra uma base URL (ex: http://192.168.1.50:8080)
fn resolve_url(base_location: &str, path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        return path.to_string();
    }

    if let Ok(base_url) = reqwest::Url::parse(base_location) {
        if let Ok(joined) = base_url.join(path) {
            return joined.to_string();
        }
    }

    // Fallback manual se a URL base falhar no parse
    let trimmed_path = path.trim_start_matches('/');
    if let Some(proto_end) = base_location.find("://") {
        let after_proto = &base_location[proto_end + 3..];
        if let Some(slash_idx) = after_proto.find('/') {
            let host_part = &base_location[..proto_end + 3 + slash_idx];
            return format!("{}/{}", host_part, trimmed_path);
        }
    }
    format!("{}/{}", base_location.trim_end_matches('/'), trimmed_path)
}

// Converte segundos (f64) para formato UPnP HH:MM:SS
fn seconds_to_hhmmss(total_seconds: f64) -> String {
    let secs = total_seconds.max(0.0) as u64;
    let hours = secs / 3600;
    let minutes = (secs % 3600) / 60;
    let seconds = secs % 60;
    format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
}

// Converte formato UPnP HH:MM:SS ou HH:MM:SS.mmm para segundos f64
fn hhmmss_to_seconds(time_str: &str) -> f64 {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 3 {
        return 0.0;
    }
    let hours: f64 = parts[0].parse().unwrap_or(0.0);
    let minutes: f64 = parts[1].parse().unwrap_or(0.0);
    let seconds: f64 = parts[2].parse().unwrap_or(0.0);
    hours * 3600.0 + minutes * 60.0 + seconds
}

// Escapa caracteres especiais XML para metadados DIDL-Lite
fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

pub struct UpnpService {
    client: reqwest::Client,
}

impl UpnpService {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(4))
            .build()
            .unwrap_or_default();
        Self { client }
    }

    // Varredura SSDP na rede local para encontrar dispositivos MediaRenderer UPnP / DLNA
    pub async fn discover_devices(&self) -> Result<Vec<UpnpDevice>, String> {
        let socket = UdpSocket::bind("0.0.0.0:0")
            .await
            .map_err(|e| format!("Falha ao abrir socket UDP para SSDP: {}", e))?;

        let multicast_addr: SocketAddr = "239.255.255.250:1900".parse().unwrap();

        // Alvos de busca universais para máxima compatibilidade:
        // LG webOS, Samsung Tizen, Sony Bravia, Roku, Fire TV, Philips, Sonos e caixas DLNA
        let search_targets = [
            "urn:schemas-upnp-org:device:MediaRenderer:1",
            "urn:schemas-upnp-org:device:MediaRenderer:2",
            "urn:schemas-upnp-org:service:AVTransport:1",
            "urn:schemas-upnp-org:service:RenderingControl:1",
            "upnp:rootdevice",
            "urn:dial-multiscreen-org:service:dial:1",
            "ssdp:all",
        ];

        for target in search_targets {
            let msg = format!(
                "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: {}\r\n\r\n",
                target
            );
            let _ = socket.send_to(msg.as_bytes(), multicast_addr).await;
        }

        let mut locations = HashSet::new();
        let mut buf = [0u8; 4096];

        // Escuta respostas por até 2.6 segundos para dar tempo a TVs mais lentas
        let deadline = tokio::time::Instant::now() + Duration::from_millis(2600);

        while tokio::time::Instant::now() < deadline {
            let remaining = deadline - tokio::time::Instant::now();
            match timeout(remaining, socket.recv_from(&mut buf)).await {
                Ok(Ok((len, _addr))) => {
                    let response = String::from_utf8_lossy(&buf[..len]);
                    for line in response.lines() {
                        let trimmed = line.trim();
                        if trimmed.to_uppercase().starts_with("LOCATION:") {
                            if let Some(loc) = trimmed.splitn(2, ':').nth(1) {
                                let loc_url = loc.trim().to_string();
                                if !loc_url.is_empty() {
                                    locations.insert(loc_url);
                                }
                            }
                        }
                    }
                }
                _ => break, // Timeout ou erro, finaliza coleta de respostas SSDP
            }
        }

        // Para cada URL de localização descoberta, obtém a descrição do dispositivo
        let mut devices = Vec::new();

        for location_url in locations {
            if let Ok(dev) = self.fetch_device_description(&location_url).await {
                // Apenas adiciona se possuir serviço de AVTransport (reprodutor de mídia)
                if dev.av_transport_url.is_some() {
                    devices.push(dev);
                }
            }
        }

        Ok(devices)
    }

    // Busca o XML de descrição e extrai friendlyName e URLs de controle de AVTransport e RenderingControl
    async fn fetch_device_description(&self, location_url: &str) -> Result<UpnpDevice, String> {
        let resp = self
            .client
            .get(location_url)
            .send()
            .await
            .map_err(|e| format!("Falha ao requisitar XML de descrição {}: {}", location_url, e))?;

        if !resp.status().is_success() {
            return Err(format!("HTTP {} ao obter {}", resp.status(), location_url));
        }

        let xml_text = resp
            .text()
            .await
            .map_err(|e| format!("Falha ao ler corpo do XML: {}", e))?;

        let friendly_name = extract_tag_content(&xml_text, "friendlyName")
            .unwrap_or_else(|| "Dispositivo DLNA / UPnP".to_string());

        let udn = extract_tag_content(&xml_text, "UDN")
            .unwrap_or_else(|| location_url.to_string());

        let mut av_transport_url = None;
        let mut rendering_control_url = None;

        // Varre os blocos <service> para localizar os serviços necessários
        let mut service_blocks: Vec<&str> = xml_text.split("<service>").collect();
        if service_blocks.len() > 1 {
            service_blocks.remove(0); // descarta cabeçalho antes do primeiro service
            for block in service_blocks {
                let service_xml = match block.split("</service>").next() {
                    Some(s) => s,
                    None => continue,
                };

                let service_type = extract_tag_content(service_xml, "serviceType").unwrap_or_default();
                let control_url = extract_tag_content(service_xml, "controlURL").unwrap_or_default();

                if service_type.contains("AVTransport") && !control_url.is_empty() {
                    av_transport_url = Some(resolve_url(location_url, &control_url));
                } else if service_type.contains("RenderingControl") && !control_url.is_empty() {
                    rendering_control_url = Some(resolve_url(location_url, &control_url));
                }
            }
        }

        Ok(UpnpDevice {
            id: udn,
            friendly_name,
            location_url: location_url.to_string(),
            av_transport_url,
            rendering_control_url,
        })
    }

    // Configura a URL de streaming no receptor UPnP e inicia a reprodução de forma segura para Smart TVs
    pub async fn set_uri_and_play(
        &self,
        av_transport_url: &str,
        stream_url: &str,
        title: &str,
        artist: &str,
        duration_seconds: f64,
    ) -> Result<(), String> {
        // REGRA DE OURO UPNP (Smart TVs LG WebOS / Samsung Tizen):
        // Se a TV já estiver no estado PLAYING, ela rejeita SetAVTransportURI com erro 701.
        // É mandatório enviar Stop primeiro e dar uma breve pausa para transição de estado.
        let _ = self.stop(av_transport_url).await;
        tokio::time::sleep(Duration::from_millis(120)).await;

        let dur_str = seconds_to_hhmmss(duration_seconds);
        let escaped_title = escape_xml(title);
        let escaped_artist = escape_xml(artist);
        let escaped_url = escape_xml(stream_url);

        // Metadados DIDL-Lite informando ao renderer o tipo e nome da faixa
        let didl_lite = format!(
            "&lt;DIDL-Lite xmlns=\"urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:upnp=\"urn:schemas-upnp-org:metadata-1-0/upnp/\"&gt;&lt;item id=\"0\" parentID=\"-1\" restricted=\"1\"&gt;&lt;dc:title&gt;{}&lt;/dc:title&gt;&lt;upnp:artist&gt;{}&lt;/upnp:artist&gt;&lt;upnp:class&gt;object.item.audioItem.musicTrack&lt;/upnp:class&gt;&lt;res protocolInfo=\"http-get:*:audio/mpeg:*\" duration=\"{}\"&gt;{}&lt;/res&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;",
            escaped_title, escaped_artist, dur_str, escaped_url
        );

        let body_set_uri = format!(
            "<?xml version=\"1.0\" encoding=\"utf-8\"?>\
<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">\
<s:Body>\
<u:SetAVTransportURI xmlns:u=\"urn:schemas-upnp-org:service:AVTransport:1\">\
<InstanceID>0</InstanceID>\
<CurrentURI>{}</CurrentURI>\
<CurrentURIMetaData>{}</CurrentURIMetaData>\
</u:SetAVTransportURI>\
</s:Body>\
</s:Envelope>",
            stream_url, didl_lite
        );

        let mut res_set = self
            .client
            .post(av_transport_url)
            .header("Content-Type", "text/xml; charset=\"utf-8\"")
            .header(
                "SOAPAction",
                "\"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI\"",
            )
            .body(body_set_uri.clone())
            .send()
            .await
            .map_err(|e| format!("Erro HTTP ao chamar SetAVTransportURI: {}", e))?;

        if !res_set.status().is_success() {
            // Em caso de rejeição temporária (ex: 701 Transition not available durante troca de faixa na fila),
            // aguarda desocupar buffer, envia stop e tenta uma segunda vez antes de falhar
            let err_first = res_set.text().await.unwrap_or_default();
            eprintln!("[UPnP] Primeira tentativa de SetAVTransportURI rejeitada: {}. Tentando retry com Stop...", err_first);
            let _ = self.stop(av_transport_url).await;
            tokio::time::sleep(Duration::from_millis(200)).await;

            res_set = self
                .client
                .post(av_transport_url)
                .header("Content-Type", "text/xml; charset=\"utf-8\"")
                .header(
                    "SOAPAction",
                    "\"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI\"",
                )
                .body(body_set_uri)
                .send()
                .await
                .map_err(|e| format!("Erro HTTP na segunda tentativa de SetAVTransportURI: {}", e))?;
        }

        if !res_set.status().is_success() {
            let err_text = res_set.text().await.unwrap_or_default();
            eprintln!("[UPnP] SetAVTransportURI rejeitado definitivamente: {}", err_text);
            return Err(format!("UPnP SetAVTransportURI rejeitado: {}", err_text));
        }

        tokio::time::sleep(Duration::from_millis(100)).await;

        // Após configurar a URI com sucesso, envia o comando Play
        self.play(av_transport_url).await
    }

    // Comando Play
    pub async fn play(&self, av_transport_url: &str) -> Result<(), String> {
        let body_play = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\
<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">\
<s:Body>\
<u:Play xmlns:u=\"urn:schemas-upnp-org:service:AVTransport:1\">\
<InstanceID>0</InstanceID>\
<Speed>1</Speed>\
</u:Play>\
</s:Body>\
</s:Envelope>";

        let res = self
            .client
            .post(av_transport_url)
            .header("Content-Type", "text/xml; charset=\"utf-8\"")
            .header(
                "SOAPAction",
                "\"urn:schemas-upnp-org:service:AVTransport:1#Play\"",
            )
            .body(body_play)
            .send()
            .await;

        match res {
            Ok(r) if r.status().is_success() => Ok(()),
            Ok(r) => {
                let err_text = r.text().await.unwrap_or_default();
                // Algumas TVs LG/Samsung já começam a tocar automaticamente após o SetURI.
                // Se o erro for 701 ("Transition not available"), significa que ela já está transicionando ou tocando.
                if err_text.contains("701") || err_text.to_lowercase().contains("transition") {
                    println!("[UPnP] TV já está transicionando ou tocando automaticamente (701). Prosseguindo...");
                    Ok(())
                } else {
                    eprintln!("[UPnP] Play rejeitado pela TV: {}", err_text);
                    // Retenta uma vez com leve atraso
                    tokio::time::sleep(Duration::from_millis(150)).await;
                    let _ = self.client.post(av_transport_url)
                        .header("Content-Type", "text/xml; charset=\"utf-8\"")
                        .header("SOAPAction", "\"urn:schemas-upnp-org:service:AVTransport:1#Play\"")
                        .body(body_play)
                        .send().await;
                    Ok(())
                }
            }
            Err(e) => {
                eprintln!("[UPnP] Erro de rede ao chamar Play: {}", e);
                Ok(())
            }
        }
    }

    // Comando Pause com Fallback para Stop em Smart TVs
    pub async fn pause(&self, av_transport_url: &str) -> Result<(), String> {
        let body_pause = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\
<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">\
<s:Body>\
<u:Pause xmlns:u=\"urn:schemas-upnp-org:service:AVTransport:1\">\
<InstanceID>0</InstanceID>\
</u:Pause>\
</s:Body>\
</s:Envelope>";

        let res = self
            .client
            .post(av_transport_url)
            .header("Content-Type", "text/xml; charset=\"utf-8\"")
            .header(
                "SOAPAction",
                "\"urn:schemas-upnp-org:service:AVTransport:1#Pause\"",
            )
            .body(body_pause)
            .send()
            .await;

        match res {
            Ok(r) if r.status().is_success() => Ok(()),
            _ => {
                // Em TVs LG WebOS que não suportam Pause em streams de rede, Stop funciona 100%
                println!("[UPnP] Pause rejeitado pela TV. Executando Stop como fallback...");
                self.stop(av_transport_url).await
            }
        }
    }

    // Comando Stop
    pub async fn stop(&self, av_transport_url: &str) -> Result<(), String> {
        let body_stop = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\
<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">\
<s:Body>\
<u:Stop xmlns:u=\"urn:schemas-upnp-org:service:AVTransport:1\">\
<InstanceID>0</InstanceID>\
</u:Stop>\
</s:Body>\
</s:Envelope>";

        let _ = self
            .client
            .post(av_transport_url)
            .header("Content-Type", "text/xml; charset=\"utf-8\"")
            .header(
                "SOAPAction",
                "\"urn:schemas-upnp-org:service:AVTransport:1#Stop\"",
            )
            .body(body_stop)
            .send()
            .await;

        Ok(())
    }

    // Comando Seek (avanço/retrocesso na faixa)
    pub async fn seek(&self, av_transport_url: &str, position_seconds: f64) -> Result<(), String> {
        let target_time = seconds_to_hhmmss(position_seconds);
        let body_seek = format!(
            "<?xml version=\"1.0\" encoding=\"utf-8\"?>\
<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">\
<s:Body>\
<u:Seek xmlns:u=\"urn:schemas-upnp-org:service:AVTransport:1\">\
<InstanceID>0</InstanceID>\
<Unit>REL_TIME</Unit>\
<Target>{}</Target>\
</u:Seek>\
</s:Body>\
</s:Envelope>",
            target_time
        );

        let res = self
            .client
            .post(av_transport_url)
            .header("Content-Type", "text/xml; charset=\"utf-8\"")
            .header(
                "SOAPAction",
                "\"urn:schemas-upnp-org:service:AVTransport:1#Seek\"",
            )
            .body(body_seek)
            .send()
            .await
            .map_err(|e| format!("Erro HTTP ao chamar Seek: {}", e))?;

        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(format!("UPnP Seek rejeitado: {}", err_text));
        }

        Ok(())
    }

    // Consulta posição atual e estado da reprodução
    pub async fn get_position_info(&self, av_transport_url: &str) -> Result<UpnpPositionInfo, String> {
        let body_pos = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\
<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">\
<s:Body>\
<u:GetPositionInfo xmlns:u=\"urn:schemas-upnp-org:service:AVTransport:1\">\
<InstanceID>0</InstanceID>\
</u:GetPositionInfo>\
</s:Body>\
</s:Envelope>";

        let res = self
            .client
            .post(av_transport_url)
            .header("Content-Type", "text/xml; charset=\"utf-8\"")
            .header(
                "SOAPAction",
                "\"urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo\"",
            )
            .body(body_pos)
            .send()
            .await
            .map_err(|e| format!("Erro HTTP ao chamar GetPositionInfo: {}", e))?;

        let xml = res.text().await.unwrap_or_default();

        let track_duration = extract_tag_content(&xml, "TrackDuration").unwrap_or_default();
        let rel_time = extract_tag_content(&xml, "RelTime").unwrap_or_default();

        Ok(UpnpPositionInfo {
            track_duration_seconds: hhmmss_to_seconds(&track_duration),
            current_position_seconds: hhmmss_to_seconds(&rel_time),
            transport_state: "PLAYING".to_string(),
        })
    }

    // Controle de volume (via RenderingControl service)
    pub async fn set_volume(
        &self,
        rendering_control_url: &str,
        volume_0_to_100: u32,
    ) -> Result<(), String> {
        let clamped = volume_0_to_100.min(100);
        let body_vol = format!(
            "<?xml version=\"1.0\" encoding=\"utf-8\"?>\
<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">\
<s:Body>\
<u:SetVolume xmlns:u=\"urn:schemas-upnp-org:service:RenderingControl:1\">\
<InstanceID>0</InstanceID>\
<Channel>Master</Channel>\
<DesiredVolume>{}</DesiredVolume>\
</u:SetVolume>\
</s:Body>\
</s:Envelope>",
            clamped
        );

        let _ = tokio::time::timeout(
            Duration::from_millis(1500),
            self.client
                .post(rendering_control_url)
                .header("Content-Type", "text/xml; charset=\"utf-8\"")
                .header(
                    "SOAPAction",
                    "\"urn:schemas-upnp-org:service:RenderingControl:1#SetVolume\"",
                )
                .body(body_vol)
                .send()
        ).await;

        Ok(())
    }
}
