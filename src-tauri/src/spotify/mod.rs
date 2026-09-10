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

        let client = reqwest::Client::new();
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

    /// Extrai todas as faixas de uma playlist pública do Spotify (com paginação automática)
    pub async fn resolve_playlist(&self, url: &str) -> Result<(String, String, Vec<SpotifyTrackMeta>), String> {
        let playlist_id = link_resolver::extract_spotify_id(url)
            .ok_or("ID de playlist inválido na URL do Spotify")?;

        let token = self.authenticate().await?;
        let client = reqwest::Client::new();

        // Buscar dados da playlist
        let pl_resp = client
            .get(format!("https://api.spotify.com/v1/playlists/{}?fields=name,description,images", playlist_id))
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| format!("Erro ao buscar playlist do Spotify: {}", e))?;

        if !pl_resp.status().is_success() {
            let status = pl_resp.status();
            if status.as_u16() == 404 {
                return Err("Playlist não encontrada no Spotify.".to_string());
            }
            if status.as_u16() == 401 || status.as_u16() == 403 {
                return Err("Esta playlist é privada. Não é possível acessá-la com as credenciais padrão.".to_string());
            }
            return Err(format!("Spotify retornou {} ao buscar playlist", status));
        }

        let pl_json: serde_json::Value = pl_resp.json().await
            .map_err(|e| format!("Erro ao decodificar playlist do Spotify: {}", e))?;

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

        // Buscar faixas com paginação
        let mut tracks = Vec::new();
        let mut offset = 0u32;
        let limit = 100u32;

        loop {
            let tracks_resp = client
                .get(format!(
                    "https://api.spotify.com/v1/playlists/{}/tracks?offset={}&limit={}&fields=items(track(id,name,artists,album,duration_ms,external_urls)),next",
                    playlist_id, offset, limit
                ))
                .bearer_auth(&token)
                .send()
                .await
                .map_err(|e| format!("Erro ao buscar faixas da playlist: {}", e))?;

            if !tracks_resp.status().is_success() {
                break;
            }

            let tracks_json: serde_json::Value = tracks_resp.json().await
                .map_err(|e| format!("Erro ao decodificar faixas: {}", e))?;

            if let Some(items) = tracks_json.get("items").and_then(|v| v.as_array()) {
                for item in items {
                    if let Some(track) = item.get("track") {
                        if let Ok(meta) = Self::parse_track_json(track) {
                            tracks.push(meta);
                        }
                    }
                }
            }

            // Verificar se há mais páginas
            let has_next = tracks_json.get("next")
                .map(|v: &serde_json::Value| !v.is_null())
                .unwrap_or(false);

            if !has_next {
                break;
            }

            offset += limit;
        }

        Ok((playlist_name, playlist_cover, tracks))
    }

    /// Extrai todas as faixas de um álbum do Spotify
    pub async fn resolve_album(&self, url: &str) -> Result<(String, String, Vec<SpotifyTrackMeta>), String> {
        let album_id = link_resolver::extract_spotify_id(url)
            .ok_or("ID de álbum inválido na URL do Spotify")?;

        let token = self.authenticate().await?;
        let client = reqwest::Client::new();

        // Buscar dados do álbum
        let album_resp = client
            .get(format!("https://api.spotify.com/v1/albums/{}", album_id))
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| format!("Erro ao buscar álbum do Spotify: {}", e))?;

        if !album_resp.status().is_success() {
            let status = album_resp.status();
            if status.as_u16() == 404 {
                return Err("Álbum não encontrado no Spotify.".to_string());
            }
            return Err(format!("Spotify retornou {} ao buscar álbum", status));
        }

        let album_json: serde_json::Value = album_resp.json().await
            .map_err(|e| format!("Erro ao decodificar álbum do Spotify: {}", e))?;

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
            Ok(track) => {
                // Scoring de confiança baseado na diferença de duração
                let spotify_duration_s = meta.duration_ms / 1000;
                let diff = (track.duration_seconds - spotify_duration_s).abs();

                let confidence = if diff <= 10 {
                    MatchConfidence::High
                } else if diff <= 30 {
                    MatchConfidence::Medium
                } else {
                    MatchConfidence::Low
                };

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
