use crate::audio_engine::StreamState;
use crate::db::{Database, PlaybackStateDTO, PlaylistDTO, TrackDTO};
use crate::youtube::YouTubeSidecar;
use tauri::{Manager, State};

#[tauri::command]
pub async fn check_ytdlp() -> Result<String, String> {
    YouTubeSidecar::get_version().await
}

#[tauri::command]
pub fn check_database(db: State<'_, Database>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM tracks", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(format!("SQLite conectado com sucesso! Total de faixas na biblioteca: {}", count))
}

#[tauri::command]
pub async fn resolve_track(
    url: String,
    db: State<'_, Database>,
    stream_state: State<'_, StreamState>,
) -> Result<TrackDTO, String> {
    println!("[Pulsar] Resolvendo faixa do YouTube: {}", url);

    // 1. Extrair metadados e stream direto usando yt-dlp
    let metadata = YouTubeSidecar::extract_info(&url).await?;

    // 2. Registrar a URL do stream no proxy local
    stream_state.register_url(metadata.youtube_video_id.clone(), metadata.stream_url.clone());

    // 3. Persistir no SQLite local
    let dto = db.save_track(&metadata)?;

    println!("[Pulsar] Faixa resolvida e salva com sucesso: {} ({})", dto.title, dto.youtube_video_id);

    Ok(dto)
}

#[tauri::command]
pub async fn resolve_playlist(
    url: String,
    db: State<'_, Database>,
) -> Result<PlaylistDTO, String> {
    println!("[Pulsar] Extraindo playlist do YouTube: {}", url);

    let (playlist_title, tracks) = YouTubeSidecar::extract_playlist(&url).await?;

    if tracks.is_empty() {
        return Err("Nenhuma faixa encontrada na playlist fornecida.".to_string());
    }

    // Criar a playlist no SQLite
    let pl = db.create_playlist(&playlist_title, "Playlist importada do YouTube")?;

    // Salvar cada faixa e associar à playlist
    for track in &tracks {
        if let Ok(saved_track) = db.save_track(track) {
            let _ = db.add_track_to_playlist(&pl.id, &saved_track.id);
        }
    }

    println!("[Pulsar] Playlist '{}' importada com {} faixas!", playlist_title, tracks.len());

    // Retornar a playlist atualizada com contagem real
    let mut updated_pl = pl;
    updated_pl.track_count = tracks.len() as i64;
    updated_pl.is_imported_youtube_playlist = true;

    Ok(updated_pl)
}

#[tauri::command]
pub fn get_library_tracks(db: State<'_, Database>) -> Result<Vec<TrackDTO>, String> {
    db.get_tracks()
}

#[tauri::command]
pub fn get_playlists(db: State<'_, Database>) -> Result<Vec<PlaylistDTO>, String> {
    db.get_playlists()
}

#[tauri::command]
pub fn get_playlist_tracks(playlist_id: String, db: State<'_, Database>) -> Result<Vec<TrackDTO>, String> {
    db.get_playlist_tracks(&playlist_id)
}

#[tauri::command]
pub fn create_playlist(
    name: String,
    description: String,
    db: State<'_, Database>,
) -> Result<PlaylistDTO, String> {
    db.create_playlist(&name, &description)
}

#[tauri::command]
pub fn delete_playlist(id: String, db: State<'_, Database>) -> Result<(), String> {
    db.delete_playlist(&id)
}

#[tauri::command]
pub fn add_track_to_playlist(playlist_id: String, track_id: String, db: State<'_, Database>) -> Result<(), String> {
    db.add_track_to_playlist(&playlist_id, &track_id)
}

#[tauri::command]
pub fn remove_track_from_playlist(playlist_id: String, track_id: String, db: State<'_, Database>) -> Result<(), String> {
    db.remove_track_from_playlist(&playlist_id, &track_id)
}

#[tauri::command]
pub fn toggle_favorite(track_id: String, track: Option<TrackDTO>, db: State<'_, Database>) -> Result<bool, String> {
    db.toggle_favorite(&track_id, track.as_ref())
}

#[tauri::command]
pub fn get_favorites(db: State<'_, Database>) -> Result<Vec<String>, String> {
    db.get_favorite_ids()
}

#[tauri::command]
pub fn get_favorite_tracks(db: State<'_, Database>) -> Result<Vec<TrackDTO>, String> {
    db.get_favorite_tracks()
}

#[tauri::command]
pub fn save_playback_state(state: PlaybackStateDTO, db: State<'_, Database>) -> Result<(), String> {
    db.save_playback_state(&state)
}

#[tauri::command]
pub fn get_playback_state(db: State<'_, Database>) -> Result<Option<PlaybackStateDTO>, String> {
    db.get_playback_state()
}

#[tauri::command]
pub fn record_track_played(track_id: String, db: State<'_, Database>) -> Result<(), String> {
    db.record_track_played(&track_id)
}

#[tauri::command]
pub fn get_recent_tracks(db: State<'_, Database>) -> Result<Vec<TrackDTO>, String> {
    db.get_recent_tracks()
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn update_playlist(
    id: String,
    name: String,
    description: String,
    cover_image: Option<String>,
    coverImage: Option<String>,
    db: State<'_, Database>,
) -> Result<PlaylistDTO, String> {
    let final_cover = cover_image.or(coverImage);
    db.update_playlist(&id, &name, &description, final_cover.as_deref())
}

#[tauri::command]
pub async fn toggle_mini_player(
    app: tauri::AppHandle,
    enable: bool,
    video_mode: bool,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if enable {
            let width = if video_mode { 460.0 } else { 380.0 };
            let height = if video_mode { 360.0 } else { 160.0 };
            let _ = window.set_min_size::<tauri::Size>(None);
            let _ = window.set_decorations(false);
            let _ = window.set_always_on_top(true);
            window
                .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
                .map_err(|e| e.to_string())?;
        } else {
            let _ = window.set_decorations(true);
            let _ = window.set_always_on_top(false);
            let _ = window
                .set_size(tauri::Size::Logical(tauri::LogicalSize { width: 1100.0, height: 720.0 }));
            let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize {
                width: 800.0,
                height: 550.0,
            })));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn drag_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.start_dragging();
    }
    Ok(())
}

#[derive(serde::Serialize)]
pub struct CacheInfo {
    pub total_bytes: u64,
    pub formatted_size: String,
    pub file_count: usize,
}

#[tauri::command]
pub fn get_cache_info(stream_state: State<'_, StreamState>) -> Result<CacheInfo, String> {
    let cache_dir = &stream_state.cache_dir;
    let mut total_bytes = 0u64;
    let mut file_count = 0usize;

    if cache_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(cache_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        total_bytes += meta.len();
                        file_count += 1;
                    }
                }
            }
        }
    }

    let formatted_size = if total_bytes < 1024 {
        format!("{} B", total_bytes)
    } else if total_bytes < 1024 * 1024 {
        format!("{:.1} KB", total_bytes as f64 / 1024.0)
    } else if total_bytes < 1024 * 1024 * 1024 {
        format!("{:.1} MB", total_bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.2} GB", total_bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    };

    Ok(CacheInfo {
        total_bytes,
        formatted_size,
        file_count,
    })
}

#[tauri::command]
pub fn clear_audio_cache(stream_state: State<'_, StreamState>) -> Result<CacheInfo, String> {
    let cache_dir = &stream_state.cache_dir;
    let mut deleted_bytes = 0u64;
    let mut deleted_count = 0usize;

    if cache_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(cache_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        let size = meta.len();
                        if std::fs::remove_file(entry.path()).is_ok() {
                            deleted_bytes += size;
                            deleted_count += 1;
                        }
                    }
                }
            }
        }
    }

    let formatted_size = if deleted_bytes < 1024 {
        format!("{} B", deleted_bytes)
    } else if deleted_bytes < 1024 * 1024 {
        format!("{:.1} KB", deleted_bytes as f64 / 1024.0)
    } else {
        format!("{:.1} MB", deleted_bytes as f64 / (1024.0 * 1024.0))
    };

    Ok(CacheInfo {
        total_bytes: deleted_bytes,
        formatted_size,
        file_count: deleted_count,
    })
}

#[tauri::command]
pub fn set_minimize_to_tray(enabled: bool, tray_state: State<'_, crate::TrayState>) -> Result<(), String> {
    tray_state.minimize_to_tray.store(enabled, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn update_taskbar_thumbnail(is_playing: bool, has_track: bool, is_favorite: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        crate::taskbar::windows_taskbar::update_buttons(is_playing, has_track, is_favorite)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}


