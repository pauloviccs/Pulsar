use serde::{Deserialize, Serialize};

/// Plataforma de origem detectada a partir da URL
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Platform {
    YouTube,
    YouTubeMusic,
    Spotify,
    Unknown,
}

/// Tipo de conteúdo detectado a partir da URL
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LinkType {
    Track,
    Playlist,
    Album,
    Radio,
    Unknown,
}

/// Resultado da detecção de link para envio ao frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkDetectionResult {
    pub platform: String,
    pub link_type: String,
    pub normalized_url: String,
}

/// Detecta a plataforma de origem de uma URL de mídia
pub fn detect_platform(url: &str) -> Platform {
    let lower = url.to_lowercase();
    if lower.contains("open.spotify.com") || lower.contains("spotify.link") {
        Platform::Spotify
    } else if lower.contains("music.youtube.com") {
        Platform::YouTubeMusic
    } else if lower.contains("youtube.com") || lower.contains("youtu.be") {
        Platform::YouTube
    } else {
        Platform::Unknown
    }
}

/// Detecta o tipo de conteúdo (faixa, playlist, álbum, rádio) a partir da URL
pub fn detect_link_type(url: &str, platform: &Platform) -> LinkType {
    let lower = url.to_lowercase();

    match platform {
        Platform::Spotify => {
            if lower.contains("/track/") {
                LinkType::Track
            } else if lower.contains("/playlist/") {
                LinkType::Playlist
            } else if lower.contains("/album/") {
                LinkType::Album
            } else {
                LinkType::Unknown
            }
        }
        Platform::YouTube | Platform::YouTubeMusic => {
            // Playlist pura (sem watch?v=)
            if (lower.contains("/playlist") || lower.contains("list="))
                && !lower.contains("/watch?v=")
            {
                LinkType::Playlist
            }
            // Mix/Rádio automático
            else if lower.contains("list=RD") || lower.contains("list=RDMM") {
                LinkType::Radio
            }
            // Faixa individual
            else if lower.contains("/watch?v=")
                || lower.contains("youtu.be/")
                || lower.contains("/watch?")
            {
                LinkType::Track
            } else {
                LinkType::Unknown
            }
        }
        Platform::Unknown => LinkType::Unknown,
    }
}

/// Normaliza a URL removendo parâmetros de rastreamento e convertendo para formato canônico
pub fn normalize_url(url: &str, platform: &Platform) -> String {
    let mut clean = url.trim().to_string();

    match platform {
        Platform::YouTubeMusic => {
            // Converter music.youtube.com → www.youtube.com
            clean = clean.replace("music.youtube.com", "www.youtube.com");

            // Se for faixa única com mix automático, remover &list=
            if clean.contains("watch?v=") && clean.contains("&list=") {
                if let Some(pos) = clean.find("&list=") {
                    clean.truncate(pos);
                }
            }
        }
        Platform::YouTube => {
            // Se for faixa única com mix automático, remover &list=
            if clean.contains("watch?v=") && clean.contains("&list=") {
                if let Some(pos) = clean.find("&list=") {
                    clean.truncate(pos);
                }
            }
        }
        Platform::Spotify => {
            // Remover query params de tracking do Spotify (?si=...)
            if let Some(pos) = clean.find('?') {
                clean.truncate(pos);
            }
        }
        Platform::Unknown => {}
    }

    clean
}

/// Extrai o ID do recurso Spotify (track, playlist ou album) a partir da URL
pub fn extract_spotify_id(url: &str) -> Option<String> {
    // Formato: https://open.spotify.com/{type}/{id}?params
    let clean = if let Some(pos) = url.find('?') {
        &url[..pos]
    } else {
        url
    };

    let parts: Vec<&str> = clean.rsplitn(2, '/').collect();
    if parts.is_empty() {
        return None;
    }

    let id = parts[0];
    if id.is_empty() || id.len() < 10 {
        return None;
    }

    Some(id.to_string())
}

/// Fachada principal: detecta plataforma + tipo + normaliza URL
pub fn detect_link(url: &str) -> LinkDetectionResult {
    let platform = detect_platform(url);
    let link_type = detect_link_type(url, &platform);
    let normalized = normalize_url(url, &platform);

    let platform_str = match platform {
        Platform::YouTube => "youtube",
        Platform::YouTubeMusic => "youtube_music",
        Platform::Spotify => "spotify",
        Platform::Unknown => "unknown",
    };

    let type_str = match link_type {
        LinkType::Track => "track",
        LinkType::Playlist => "playlist",
        LinkType::Album => "album",
        LinkType::Radio => "radio",
        LinkType::Unknown => "unknown",
    };

    LinkDetectionResult {
        platform: platform_str.to_string(),
        link_type: type_str.to_string(),
        normalized_url: normalized,
    }
}
