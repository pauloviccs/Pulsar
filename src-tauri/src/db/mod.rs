use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::youtube::TrackMetadata;

fn default_volume() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackDTO {
    pub id: String,
    pub youtube_video_id: String,
    pub title: String,
    #[serde(default)]
    pub artist_guess: String,
    #[serde(default)]
    pub channel_name: String,
    #[serde(default)]
    pub duration_seconds: i64,
    #[serde(default)]
    pub thumbnail_url: String,
    #[serde(default)]
    pub audio_stream_cached: bool,
    #[serde(default)]
    pub added_at: String,
    #[serde(default)]
    pub stream_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistDTO {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub cover_image: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub is_imported_youtube_playlist: bool,
    #[serde(default)]
    pub track_count: i64,
    #[serde(default)]
    pub total_duration_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackStateDTO {
    #[serde(default)]
    pub current_track_id: Option<String>,
    #[serde(default)]
    pub current_playlist_id: Option<String>,
    #[serde(default)]
    pub position_seconds: f64,
    #[serde(default = "default_volume")]
    pub volume: f64,
    #[serde(default)]
    pub shuffle: bool,
    #[serde(default)]
    pub repeat_mode: String,
    #[serde(default)]
    pub video_visible: bool,
}

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn init() -> Result<Self, Box<dyn std::error::Error>> {
        let mut db_dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
        db_dir.push("com.pulsar.app");

        if !db_dir.exists() {
            fs::create_dir_all(&db_dir)?;
        }

        let db_path = db_dir.join("pulsar.db");
        println!("[Pulsar DB] Inicializando SQLite em: {:?}", db_path);

        let conn = Connection::open(db_path)?;

        // Modo WAL para performance máxima e concorrência
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;"
        )?;

        // Criar tabelas
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS tracks (
                id TEXT PRIMARY KEY,
                youtube_video_id TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                artist_guess TEXT,
                channel_name TEXT,
                duration_seconds INTEGER NOT NULL,
                thumbnail_path TEXT,
                audio_stream_cached BOOLEAN DEFAULT 0,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                cover_image_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_imported_youtube_playlist BOOLEAN DEFAULT 0,
                source_youtube_playlist_id TEXT
            );

            CREATE TABLE IF NOT EXISTS playlist_tracks (
                playlist_id TEXT NOT NULL,
                track_id TEXT NOT NULL,
                position INTEGER NOT NULL,
                PRIMARY KEY (playlist_id, track_id),
                FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
                FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS favorites (
                track_id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS playback_state (
                singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
                current_track_id TEXT,
                current_playlist_id TEXT,
                position_seconds REAL DEFAULT 0.0,
                volume REAL DEFAULT 1.0,
                shuffle BOOLEAN DEFAULT 0,
                repeat_mode TEXT DEFAULT 'none',
                video_visible BOOLEAN DEFAULT 0,
                FOREIGN KEY(current_track_id) REFERENCES tracks(id)
            );

            INSERT OR IGNORE INTO playback_state (singleton_id, volume) VALUES (1, 1.0);"
        )?;

        // Migrações defensivas automáticas para bases de dados já existentes
        let _ = conn.execute("ALTER TABLE playlists ADD COLUMN description TEXT DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE playlists ADD COLUMN cover_image_path TEXT DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE playlists ADD COLUMN is_imported_youtube_playlist BOOLEAN DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE playlists ADD COLUMN source_youtube_playlist_id TEXT", []);
        let _ = conn.execute("ALTER TABLE tracks ADD COLUMN audio_stream_cached BOOLEAN DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE tracks ADD COLUMN last_played_at TIMESTAMP", []);
        let _ = conn.execute("ALTER TABLE tracks ADD COLUMN source_platform TEXT DEFAULT 'youtube'", []);

        // Tabela de configurações genérica (key-value) para credenciais e preferências
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );"
        ).map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

        // Migração para converter IDs de playlists legados ("pl-UUID") para UUID canônico (36 caracteres)
        let _ = conn.execute("PRAGMA foreign_keys = OFF;", []);
        let _ = conn.execute(
            "UPDATE playlists SET id = SUBSTR(id, 4) WHERE id LIKE 'pl-%' AND length(id) = 39;",
            [],
        );
        let _ = conn.execute(
            "UPDATE playlist_tracks SET playlist_id = SUBSTR(playlist_id, 4) WHERE playlist_id LIKE 'pl-%' AND length(playlist_id) = 39;",
            [],
        );
        let _ = conn.execute("PRAGMA foreign_keys = ON;", []);

        // Seed inicial da playlist padrão com tracks reais caso o banco SQLite esteja vazio (instalação nova)
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM playlists", [], |row| row.get(0)).unwrap_or(0);
        if count == 0 {
            let default_pl_id = "a0000000-0000-4000-8000-000000000001";
            let default_cover = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80";
            let _ = conn.execute(
                "INSERT OR IGNORE INTO playlists (id, name, description, cover_image_path, is_imported_youtube_playlist)
                 VALUES (?1, ?2, ?3, ?4, 1)",
                params![
                    default_pl_id,
                    "Vibe Coding & Focus",
                    "Batidas imersivas e lo-fi para programar no fluxo contínuo sem anúncios.",
                    default_cover
                ],
            );

            let tracks_to_seed = [
                ("b0000000-0000-4000-8000-000000000001", "jfKfPfyJRdk", "Lofi Hip Hop Radio - Beats to Relax/Study to", "Lofi Girl", "Lofi Girl", 245, "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80"),
                ("b0000000-0000-4000-8000-000000000002", "5qap5aO4i9A", "Midnight City (Synthwave Drive)", "Neon Sunset", "RetroWaves FM", 284, "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80"),
                ("b0000000-0000-4000-8000-000000000003", "DWcJFNfaw9C", "Deep Focus Ambient Sessions", "Aura Sound", "Mind & Code", 360, "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80"),
            ];

            for (pos, (t_id, v_id, title, artist, ch, dur, thumb)) in tracks_to_seed.iter().enumerate() {
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO tracks (id, youtube_video_id, title, artist_guess, channel_name, duration_seconds, thumbnail_path)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![t_id, v_id, title, artist, ch, dur, thumb],
                );
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position)
                     VALUES (?1, ?2, ?3)",
                    params![default_pl_id, t_id, pos as i64],
                );
            }
        }

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Salva ou atualiza uma faixa extraída do YouTube
    pub fn save_track(&self, track: &TrackMetadata) -> Result<TrackDTO, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO tracks (id, youtube_video_id, title, artist_guess, channel_name, duration_seconds, thumbnail_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(youtube_video_id) DO UPDATE SET
                title = excluded.title,
                artist_guess = excluded.artist_guess,
                channel_name = excluded.channel_name,
                duration_seconds = excluded.duration_seconds,
                thumbnail_path = excluded.thumbnail_path",
            params![
                track.id,
                track.youtube_video_id,
                track.title,
                track.artist_guess,
                track.channel_name,
                track.duration_seconds,
                track.thumbnail_url
            ],
        ).map_err(|e| e.to_string())?;

        // Recuperar o ID real salvo (se já existia pelo youtube_video_id)
        let actual_id: String = conn.query_row(
            "SELECT id FROM tracks WHERE youtube_video_id = ?1",
            params![track.youtube_video_id],
            |row| row.get(0),
        ).unwrap_or_else(|_| track.id.clone());

        Ok(TrackDTO {
            id: actual_id,
            youtube_video_id: track.youtube_video_id.clone(),
            title: track.title.clone(),
            artist_guess: track.artist_guess.clone(),
            channel_name: track.channel_name.clone(),
            duration_seconds: track.duration_seconds,
            thumbnail_url: track.thumbnail_url.clone(),
            audio_stream_cached: false,
            added_at: chrono_now(),
            stream_url: format!("http://127.0.0.1:{}/stream/{}", crate::audio_engine::PROXY_PORT, track.youtube_video_id),
        })
    }

    /// Retorna todas as faixas salvas na biblioteca
    pub fn get_tracks(&self) -> Result<Vec<TrackDTO>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, youtube_video_id, title, artist_guess, channel_name, duration_seconds, thumbnail_path, audio_stream_cached, added_at FROM tracks ORDER BY added_at DESC")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let ytid: String = row.get(1)?;
                Ok(TrackDTO {
                    id: row.get(0)?,
                    youtube_video_id: ytid.clone(),
                    title: row.get(2)?,
                    artist_guess: row.get(3)?,
                    channel_name: row.get(4)?,
                    duration_seconds: row.get(5)?,
                    thumbnail_url: row.get(6)?,
                    audio_stream_cached: row.get(7)?,
                    added_at: row.get(8)?,
                    stream_url: format!("http://127.0.0.1:{}/stream/{}", crate::audio_engine::PROXY_PORT, ytid),
                })
            })
            .map_err(|e| e.to_string())?;

        let mut tracks = Vec::new();
        for r in rows {
            if let Ok(t) = r {
                tracks.push(t);
            }
        }
        Ok(tracks)
    }

    /// Retorna todas as faixas de uma playlist específica ordenada por posição
    pub fn get_playlist_tracks(&self, playlist_id: &str) -> Result<Vec<TrackDTO>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT t.id, t.youtube_video_id, t.title, t.artist_guess, t.channel_name, t.duration_seconds, t.thumbnail_path, t.audio_stream_cached, t.added_at
                 FROM tracks t
                 INNER JOIN playlist_tracks pt ON t.id = pt.track_id
                 WHERE pt.playlist_id = ?1
                 ORDER BY pt.position ASC"
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![playlist_id], |row| {
                let ytid: String = row.get(1)?;
                Ok(TrackDTO {
                    id: row.get(0)?,
                    youtube_video_id: ytid.clone(),
                    title: row.get(2)?,
                    artist_guess: row.get(3)?,
                    channel_name: row.get(4)?,
                    duration_seconds: row.get(5)?,
                    thumbnail_url: row.get(6)?,
                    audio_stream_cached: row.get(7)?,
                    added_at: row.get(8)?,
                    stream_url: format!("http://127.0.0.1:{}/stream/{}", crate::audio_engine::PROXY_PORT, ytid),
                })
            })
            .map_err(|e| e.to_string())?;

        let mut tracks = Vec::new();
        for r in rows {
            if let Ok(t) = r {
                tracks.push(t);
            }
        }
        Ok(tracks)
    }

    /// Adiciona uma faixa à playlist
    pub fn add_track_to_playlist(&self, playlist_id: &str, track_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let next_pos: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?1",
                params![playlist_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        conn.execute(
            "INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?1, ?2, ?3)",
            params![playlist_id, track_id, next_pos],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Remove uma faixa da playlist
    pub fn remove_track_from_playlist(&self, playlist_id: &str, track_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
            params![playlist_id, track_id],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Retorna todas as playlists
    pub fn get_playlists(&self) -> Result<Vec<PlaylistDTO>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT p.id, p.name, COALESCE(p.description, ''), p.cover_image_path, p.created_at, p.is_imported_youtube_playlist,
                        COUNT(pt.track_id) as track_count,
                        COALESCE(SUM(t.duration_seconds), 0) as total_duration
                 FROM playlists p
                 LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
                 LEFT JOIN tracks t ON pt.track_id = t.id
                 GROUP BY p.id
                 ORDER BY p.created_at DESC"
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let cover: Option<String> = row.get(3)?;
                Ok(PlaylistDTO {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    cover_image: cover.unwrap_or_else(|| "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80".to_string()),
                    created_at: row.get(4)?,
                    is_imported_youtube_playlist: row.get(5)?,
                    track_count: row.get(6)?,
                    total_duration_seconds: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows {
            if let Ok(p) = r {
                list.push(p);
            }
        }
        Ok(list)
    }

    /// Cria uma nova playlist
    pub fn create_playlist(&self, name: &str, description: &str) -> Result<PlaylistDTO, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let id = uuid::Uuid::new_v4().to_string();
        let default_cover = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80";

        conn.execute(
            "INSERT INTO playlists (id, name, description, cover_image_path) VALUES (?1, ?2, ?3, ?4)",
            params![id, name, description, default_cover],
        ).map_err(|e| e.to_string())?;

        Ok(PlaylistDTO {
            id,
            name: name.to_string(),
            description: description.to_string(),
            cover_image: default_cover.to_string(),
            created_at: chrono_now(),
            is_imported_youtube_playlist: false,
            track_count: 0,
            total_duration_seconds: 0,
        })
    }

    /// Exclui uma playlist
    pub fn delete_playlist(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Atualiza nome, descrição e/ou capa de uma playlist
    pub fn update_playlist(
        &self,
        id: &str,
        name: &str,
        description: &str,
        cover_image: Option<&str>,
    ) -> Result<PlaylistDTO, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        if let Some(cover) = cover_image {
            conn.execute(
                "UPDATE playlists SET name = ?1, description = ?2, cover_image_path = ?3 WHERE id = ?4",
                params![name, description, cover, id],
            ).map_err(|e| e.to_string())?;
        } else {
            conn.execute(
                "UPDATE playlists SET name = ?1, description = ?2 WHERE id = ?3",
                params![name, description, id],
            ).map_err(|e| e.to_string())?;
        }

        let pl = conn.query_row(
            "SELECT p.id, p.name, COALESCE(p.description, ''), p.cover_image_path, p.created_at, p.is_imported_youtube_playlist,
                    COUNT(pt.track_id) as track_count,
                    COALESCE(SUM(t.duration_seconds), 0) as total_duration
             FROM playlists p
             LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
             LEFT JOIN tracks t ON pt.track_id = t.id
             WHERE p.id = ?1
             GROUP BY p.id",
            params![id],
            |row| {
                let cover: Option<String> = row.get(3)?;
                Ok(PlaylistDTO {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    cover_image: cover.unwrap_or_else(|| "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80".to_string()),
                    created_at: row.get(4)?,
                    is_imported_youtube_playlist: row.get(5)?,
                    track_count: row.get(6)?,
                    total_duration_seconds: row.get(7)?,
                })
            },
        ).map_err(|e| e.to_string())?;

        Ok(pl)
    }

    /// Insere ou atualiza uma playlist vinda da nuvem ou local
    pub fn upsert_playlist(&self, pl: &PlaylistDTO) -> Result<PlaylistDTO, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO playlists (id, name, description, cover_image_path, created_at, is_imported_youtube_playlist)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                cover_image_path = excluded.cover_image_path,
                is_imported_youtube_playlist = excluded.is_imported_youtube_playlist",
            params![
                pl.id,
                pl.name,
                pl.description,
                pl.cover_image,
                pl.created_at,
                pl.is_imported_youtube_playlist
            ],
        ).map_err(|e| e.to_string())?;
        Ok(pl.clone())
    }

    /// Salva diretamente um TrackDTO vindo da nuvem (ou importador)
    pub fn save_track_dto(&self, track: &TrackDTO) -> Result<TrackDTO, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO tracks (id, youtube_video_id, title, artist_guess, channel_name, duration_seconds, thumbnail_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(youtube_video_id) DO UPDATE SET
                title = excluded.title,
                artist_guess = excluded.artist_guess,
                channel_name = excluded.channel_name,
                duration_seconds = excluded.duration_seconds,
                thumbnail_path = excluded.thumbnail_path",
            params![
                track.id,
                track.youtube_video_id,
                track.title,
                track.artist_guess,
                track.channel_name,
                track.duration_seconds,
                track.thumbnail_url
            ],
        ).map_err(|e| e.to_string())?;

        let actual_id: String = conn.query_row(
            "SELECT id FROM tracks WHERE youtube_video_id = ?1",
            params![track.youtube_video_id],
            |row| row.get(0),
        ).unwrap_or_else(|_| track.id.clone());

        let mut res = track.clone();
        res.id = actual_id;
        Ok(res)
    }

    /// Substitui todas as faixas de uma playlist com ordenação
    pub fn set_playlist_tracks(&self, playlist_id: &str, track_ids: &[String]) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?1", params![playlist_id])
            .map_err(|e| e.to_string())?;

        let mut stmt = conn.prepare(
            "INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?1, ?2, ?3)"
        ).map_err(|e| e.to_string())?;

        for (i, tid) in track_ids.iter().enumerate() {
            let _ = stmt.execute(params![playlist_id, tid, i as i64]);
        }
        Ok(())
    }

    /// Alterna estado de favorito de uma faixa garantindo integridade
    pub fn toggle_favorite(&self, track_id: &str, track: Option<&TrackDTO>) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let exists: i64 = conn
            .query_row("SELECT COUNT(*) FROM favorites WHERE track_id = ?1", params![track_id], |row| row.get(0))
            .unwrap_or(0);

        if exists > 0 {
            conn.execute("DELETE FROM favorites WHERE track_id = ?1", params![track_id]).map_err(|e| e.to_string())?;
            Ok(false)
        } else {
            // Garantir que a faixa exista em tracks antes de inserir em favorites
            let track_exists: i64 = conn
                .query_row("SELECT COUNT(*) FROM tracks WHERE id = ?1", params![track_id], |row| row.get(0))
                .unwrap_or(0);

            if track_exists == 0 {
                if let Some(t) = track {
                    let _ = conn.execute(
                        "INSERT INTO tracks (id, youtube_video_id, title, artist_guess, channel_name, duration_seconds, thumbnail_path)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                         ON CONFLICT(youtube_video_id) DO NOTHING",
                        params![
                            t.id,
                            t.youtube_video_id,
                            t.title,
                            t.artist_guess,
                            t.channel_name,
                            t.duration_seconds,
                            t.thumbnail_url
                        ],
                    );
                }
            }

            conn.execute("INSERT OR IGNORE INTO favorites (track_id) VALUES (?1)", params![track_id]).map_err(|e| e.to_string())?;
            Ok(true)
        }
    }

    /// Retorna todas as faixas favoritas completas ordenadas pelas mais recentes
    pub fn get_favorite_tracks(&self) -> Result<Vec<TrackDTO>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT t.id, t.youtube_video_id, t.title, t.artist_guess, t.channel_name, t.duration_seconds, t.thumbnail_path, t.audio_stream_cached, t.added_at
                 FROM tracks t
                 INNER JOIN favorites f ON t.id = f.track_id
                 ORDER BY f.created_at DESC"
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let ytid: String = row.get(1)?;
                Ok(TrackDTO {
                    id: row.get(0)?,
                    youtube_video_id: ytid.clone(),
                    title: row.get(2)?,
                    artist_guess: row.get(3)?,
                    channel_name: row.get(4)?,
                    duration_seconds: row.get(5)?,
                    thumbnail_url: row.get(6)?,
                    audio_stream_cached: row.get(7)?,
                    added_at: row.get(8)?,
                    stream_url: format!("http://127.0.0.1:{}/stream/{}", crate::audio_engine::PROXY_PORT, ytid),
                })
            })
            .map_err(|e| e.to_string())?;

        let mut tracks = Vec::new();
        for r in rows {
            if let Ok(t) = r {
                tracks.push(t);
            }
        }
        Ok(tracks)
    }

    /// Retorna IDs de todas as faixas favoritas
    pub fn get_favorite_ids(&self) -> Result<Vec<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT track_id FROM favorites").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| row.get(0)).map_err(|e| e.to_string())?;

        let mut ids = Vec::new();
        for r in rows {
            if let Ok(id) = r {
                ids.push(id);
            }
        }
        Ok(ids)
    }

    /// Salva o estado de reprodução atual (Singleton)
    pub fn save_playback_state(&self, state: &PlaybackStateDTO) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Se current_track_id foi passado, verificar se a faixa realmente existe em tracks local
        let safe_track_id = match &state.current_track_id {
            Some(tid) if !tid.is_empty() => {
                let exists: bool = conn.query_row(
                    "SELECT 1 FROM tracks WHERE id = ?1",
                    params![tid],
                    |_| Ok(true)
                ).unwrap_or(false);
                if exists {
                    Some(tid.clone())
                } else {
                    None
                }
            },
            _ => None,
        };

        conn.execute(
            "UPDATE playback_state SET
                current_track_id = ?1,
                current_playlist_id = ?2,
                position_seconds = ?3,
                volume = ?4,
                shuffle = ?5,
                repeat_mode = ?6,
                video_visible = ?7
             WHERE singleton_id = 1",
            params![
                safe_track_id,
                state.current_playlist_id,
                state.position_seconds,
                state.volume,
                state.shuffle,
                state.repeat_mode,
                state.video_visible
            ],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Carrega o estado de reprodução persistido
    pub fn get_playback_state(&self) -> Result<Option<PlaybackStateDTO>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT current_track_id, current_playlist_id, position_seconds, volume, shuffle, repeat_mode, video_visible
             FROM playback_state WHERE singleton_id = 1"
        ).map_err(|e| e.to_string())?;

        let state = stmt.query_row([], |row| {
            Ok(PlaybackStateDTO {
                current_track_id: row.get(0)?,
                current_playlist_id: row.get(1)?,
                position_seconds: row.get(2)?,
                volume: row.get(3)?,
                shuffle: row.get(4)?,
                repeat_mode: row.get(5)?,
                video_visible: row.get(6)?,
            })
        });

        match state {
            Ok(s) => Ok(Some(s)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    /// Registra que uma faixa foi reproduzida para o histórico recente
    pub fn record_track_played(&self, track_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE tracks SET last_played_at = CURRENT_TIMESTAMP WHERE id = ?1 OR youtube_video_id = ?1",
            params![track_id],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Retorna as faixas tocadas recentemente
    pub fn get_recent_tracks(&self) -> Result<Vec<TrackDTO>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, youtube_video_id, title, artist_guess, channel_name, duration_seconds, thumbnail_path, audio_stream_cached, added_at
                 FROM tracks
                 WHERE last_played_at IS NOT NULL
                 ORDER BY last_played_at DESC
                 LIMIT 30"
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let ytid: String = row.get(1)?;
                Ok(TrackDTO {
                    id: row.get(0)?,
                    youtube_video_id: ytid.clone(),
                    title: row.get(2)?,
                    artist_guess: row.get(3)?,
                    channel_name: row.get(4)?,
                    duration_seconds: row.get(5)?,
                    thumbnail_url: row.get(6)?,
                    audio_stream_cached: row.get(7)?,
                    added_at: row.get(8)?,
                    stream_url: format!("http://127.0.0.1:{}/stream/{}", crate::audio_engine::PROXY_PORT, ytid),
                })
            })
            .map_err(|e| e.to_string())?;

        let mut tracks = Vec::new();
        for r in rows {
            if let Ok(t) = r {
                tracks.push(t);
            }
        }
        Ok(tracks)
    }
    /// Salva uma configuração no banco de dados (key-value)
    pub fn save_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Recupera uma configuração do banco de dados
    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        );

        match result {
            Ok(val) => Ok(Some(val)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now();
    let duration = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    format!("timestamp-{}", duration.as_secs())
}
