use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackMetadata {
    pub id: String,
    pub youtube_video_id: String,
    pub title: String,
    pub artist_guess: String,
    pub channel_name: String,
    pub duration_seconds: i64,
    pub thumbnail_url: String,
    pub stream_url: String,
}

pub struct YouTubeSidecar;

impl YouTubeSidecar {
    /// Localiza o executável do yt-dlp empacotado
    pub fn get_binary_path() -> PathBuf {
        let current_dir = std::env::current_dir().unwrap_or_default();
        let dev_path = current_dir.join("bin").join("yt-dlp-x86_64-pc-windows-msvc.exe");

        if dev_path.exists() {
            return dev_path;
        }

        let tauri_dev_path = current_dir.join("src-tauri").join("bin").join("yt-dlp-x86_64-pc-windows-msvc.exe");
        if tauri_dev_path.exists() {
            return tauri_dev_path;
        }

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                let prod_path = parent.join("yt-dlp-x86_64-pc-windows-msvc.exe");
                if prod_path.exists() {
                    return prod_path;
                }
            }
        }

        PathBuf::from("yt-dlp")
    }

    /// Retorna a versão instalada do yt-dlp
    pub async fn get_version() -> Result<String, String> {
        let bin = Self::get_binary_path();
        
        let mut cmd = Command::new(&bin);
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.arg("--version");
        cmd.kill_on_drop(true);

        match cmd.output().await {
            Ok(output) => {
                if output.status.success() {
                    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    Ok(version)
                } else {
                    let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
                    Err(format!("Falha ao executar yt-dlp: {}", err))
                }
            }
            Err(e) => Err(format!("Executável yt-dlp não encontrado em {:?}: {}", bin, e)),
        }
    }

    /// Extrai metadados completos e a URL do stream de áudio bruto
    pub async fn extract_info(url: &str) -> Result<TrackMetadata, String> {
        let bin = Self::get_binary_path();

        let mut cmd = Command::new(&bin);
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.args([
            "--dump-single-json",
            "--no-warnings",
            "--no-playlist",
            "-f", "bestaudio[ext=m4a]/bestaudio/ba/b",
            url
        ]);
        cmd.kill_on_drop(true);

        let output = cmd.output().await.map_err(|e| format!("Erro ao executar yt-dlp: {}", e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(format!("yt-dlp retornou erro: {}", err));
        }

        let json_str = String::from_utf8_lossy(&output.stdout);
        let val: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| format!("Falha ao decodificar JSON do yt-dlp: {}", e))?;

        let youtube_video_id = val.get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let raw_title = val.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Música Sem Título")
            .to_string();

        let channel_name = val.get("uploader")
            .or_else(|| val.get("channel"))
            .and_then(|v| v.as_str())
            .unwrap_or("Canal Desconhecido")
            .to_string();

        let duration_seconds = val.get("duration")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        // Heurística de Artista: se o título tiver "Artista - Música"
        let (artist_guess, title) = if let Some((artist, track)) = raw_title.split_once(" - ") {
            (artist.trim().to_string(), track.trim().to_string())
        } else {
            (channel_name.clone(), raw_title.clone())
        };

        // Thumbnail de melhor qualidade
        let thumbnail_url = val.get("thumbnail")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // URL direta do stream de áudio bruto
        let stream_url = val.get("url")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if stream_url.is_empty() {
            return Err("Nenhum stream de áudio encontrado para este link.".to_string());
        }

        let id = uuid::Uuid::new_v4().to_string();

        Ok(TrackMetadata {
            id,
            youtube_video_id,
            title,
            artist_guess,
            channel_name,
            duration_seconds,
            thumbnail_url,
            stream_url,
        })
    }

    /// Extrai faixas de uma playlist inteira do YouTube
    pub async fn extract_playlist(url: &str) -> Result<(String, Vec<TrackMetadata>), String> {
        let bin = Self::get_binary_path();

        let mut cmd = Command::new(&bin);
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.args([
            "--flat-playlist",
            "-J",
            "--no-warnings",
            url
        ]);
        cmd.kill_on_drop(true);

        let output = cmd.output().await.map_err(|e| format!("Erro ao extrair playlist: {}", e))?;
        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(format!("yt-dlp retornou erro na playlist: {}", err));
        }

        let json_str = String::from_utf8_lossy(&output.stdout);
        let val: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| format!("Falha no JSON da playlist: {}", e))?;

        let playlist_title = val.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Playlist do YouTube")
            .to_string();

        let mut tracks = Vec::new();
        if let Some(entries) = val.get("entries").and_then(|e| e.as_array()) {
            for entry in entries {
                let ytid = match entry.get("id").and_then(|v| v.as_str()) {
                    Some(id) if !id.is_empty() => id.to_string(),
                    _ => continue,
                };

                let raw_title = entry.get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Faixa")
                    .to_string();

                let channel_name = entry.get("uploader")
                    .or_else(|| entry.get("channel"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("YouTube")
                    .to_string();

                let duration_seconds = entry.get("duration")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);

                let (artist_guess, title) = if let Some((artist, track)) = raw_title.split_once(" - ") {
                    (artist.trim().to_string(), track.trim().to_string())
                } else {
                    (channel_name.clone(), raw_title.clone())
                };

                // Thumbnail fallback
                let thumbnail_url = entry.get("thumbnail")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", ytid));

                tracks.push(TrackMetadata {
                    id: uuid::Uuid::new_v4().to_string(),
                    youtube_video_id: ytid,
                    title,
                    artist_guess,
                    channel_name,
                    duration_seconds,
                    thumbnail_url,
                    stream_url: String::new(), // Resolvido sob demanda no proxy
                });
            }
        }

        Ok((playlist_title, tracks))
    }

    /// Resolve apenas a URL do stream direto de um vídeo caso tenha expirado
    pub async fn get_direct_stream_url(video_id: &str) -> Result<String, String> {
        let bin = Self::get_binary_path();
        let target_url = if video_id.starts_with("http") {
            video_id.to_string()
        } else {
            format!("https://www.youtube.com/watch?v={}", video_id)
        };

        let mut cmd = Command::new(&bin);
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.args([
            "-g",
            "-f", "bestaudio[ext=m4a]/bestaudio/ba/b",
            "--no-warnings",
            &target_url
        ]);
        cmd.kill_on_drop(true);

        let output = cmd.output().await.map_err(|e| format!("Erro ao obter URL: {}", e))?;
        if output.status.success() {
            let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !url.is_empty() {
                return Ok(url);
            }
        }

        Err("Não foi possível resolver o stream direto para este vídeo.".to_string())
    }
}
