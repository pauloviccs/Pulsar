mod audio_devices;
mod audio_engine;
mod cast;
mod commands;
mod db;
mod link_resolver;
mod logger;
mod spotify;
mod taskbar;
mod updater;
mod upnp;
mod youtube;

use audio_engine::{start_proxy_server, StreamState};
use db::Database;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[derive(Clone)]
pub struct TrayState {
    pub minimize_to_tray: Arc<AtomicBool>,
}

#[derive(Clone)]
pub struct ImportState {
    pub is_cancelled: Arc<AtomicBool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Inicializa o sistema de logs persistentes em disco
    logger::init_logger();

    let db = Database::init().expect("Falha ao inicializar o banco de dados SQLite local");
    let stream_state = StreamState::new();
    let cast_manager = cast::CastManager::new();

    // Iniciar o servidor proxy local de streaming em background
    let proxy_state = stream_state.clone();
    tauri::async_runtime::spawn(async move {
        start_proxy_server(proxy_state).await;
    });

    let tray_state = TrayState {
        minimize_to_tray: Arc::new(AtomicBool::new(true)),
    };

    let import_state = ImportState {
        is_cancelled: Arc::new(AtomicBool::new(false)),
    };

    tauri::Builder::default()
        .manage(db)
        .manage(stream_state)
        .manage(tray_state)
        .manage(import_state)
        .manage(cast_manager)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let open_i = MenuItem::with_id(app, "open", "Abrir Pulsar", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Sair do Pulsar", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "open" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            tray_builder.build(app)?;

            #[cfg(target_os = "windows")]
            if let Some(main_win) = app.get_webview_window("main") {
                if let Err(e) = taskbar::windows_taskbar::init_taskbar(&main_win) {
                    eprintln!("[Pulsar Taskbar] Erro ao inicializar Thumbnail Toolbar: {}", e);
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let tray_state = window.state::<TrayState>();
                if tray_state.minimize_to_tray.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_ytdlp,
            commands::check_database,
            commands::resolve_track,
            commands::resolve_playlist,
            commands::get_library_tracks,
            commands::get_playlists,
            commands::get_playlist_tracks,
            commands::create_playlist,
            commands::delete_playlist,
            commands::add_track_to_playlist,
            commands::remove_track_from_playlist,
            commands::toggle_favorite,
            commands::get_favorites,
            commands::get_favorite_tracks,
            commands::save_playback_state,
            commands::get_playback_state,
            commands::record_track_played,
            commands::get_recent_tracks,
            commands::update_playlist,
            commands::toggle_mini_player,
            commands::get_cache_info,
            commands::clear_audio_cache,
            commands::set_minimize_to_tray,
            commands::update_taskbar_thumbnail,
            commands::drag_window,
            // Multi-Platform (YouTube Music + Spotify)
            commands::detect_link_platform,
            commands::resolve_spotify_track,
            commands::resolve_spotify_playlist,
            commands::configure_spotify_credentials,
            commands::get_spotify_credentials,
            commands::cancel_import,
            // Pulsar Connect Audio Stream & UPnP/DLNA
            commands::get_local_stream_base_url,
            commands::upnp_discover_devices,
            commands::upnp_set_uri_and_play,
            commands::upnp_play,
            commands::upnp_pause,
            commands::upnp_stop,
            commands::upnp_seek,
            commands::upnp_set_volume,
            commands::upnp_get_position_info,
            // Windows System Audio & Bluetooth Endpoints
            commands::get_system_audio_devices,
            commands::connect_bluetooth_device,
            commands::open_bluetooth_settings,
            // Centralized System Logs
            commands::get_system_logs,
            commands::open_logs_folder,
            commands::write_client_log,
            // Google Home & Google Cast (LAN Direct)
            commands::cast_discover_devices,
            commands::cast_load_and_play,
            commands::cast_play,
            commands::cast_pause,
            commands::cast_stop,
            commands::cast_set_volume,
            commands::cast_seek,
            // Native Auto-Updater
            updater::fetch_update_manifest,
            updater::download_and_run_installer,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao executar a aplicação Pulsar Tauri");
}
