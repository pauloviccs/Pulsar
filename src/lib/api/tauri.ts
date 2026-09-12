/**
 * Pulsar - Camada de Integração Segura com o Tauri IPC
 * 
 * Previne falhas do tipo `TypeError: Cannot read properties of undefined (reading 'invoke')`
 * quando a aplicação é executada ou inspecionada em navegadores web padrão (Chrome, Edge, etc.)
 * ou antes do Tauri runtime estar totalmente anexado à janela.
 */

import { invoke } from '@tauri-apps/api/core';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

/**
 * Invoca um comando Tauri de forma segura, com fallback defensivo para modo web/browser.
 */
export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  if (isTauri()) {
    try {
      return await invoke<T>(cmd, args);
    } catch (err) {
      console.error(`[Pulsar Tauri IPC] Erro no comando '${cmd}':`, err);
      throw err;
    }
  }

  // Modo Browser / Preview Web
  console.info(`[Pulsar Web Preview] Simulando comando nativo '${cmd}' (Tauri não detectado no browser).`);
  
  if (fallback !== undefined) {
    return fallback;
  }

  // Mocks amigáveis para manter o fluxo interativo no navegador
  if (cmd === 'get_app_version') {
    return '0.2.5' as unknown as T;
  }
  if (cmd === 'get_library_tracks' || cmd === 'get_playlist_tracks' || cmd === 'get_recent_tracks' || cmd === 'get_favorite_tracks') {
    return ([] as unknown) as T;
  }
  if (cmd === 'get_playlists') {
    return ([] as unknown) as T;
  }
  if (cmd === 'get_favorites') {
    return ([] as unknown) as T;
  }
  if (cmd === 'toggle_favorite') {
    return (true as unknown) as T;
  }
  if (cmd === 'resolve_track') {
    const url = (args?.url as string) || '';
    const fakeId = 'mock-' + Math.random().toString(36).substring(2, 8);
    return ({
      id: fakeId,
      youtube_video_id: 'dQw4w9WgXcQ',
      title: 'Modo Web Preview: Link YouTube Recebido',
      artist_guess: 'Pulsar Desktop Native Player',
      channel_name: 'Executar via app Tauri para extração real',
      duration_seconds: 212,
      thumbnail_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
      audio_stream_cached: false,
      added_at: new Date().toISOString(),
      stream_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
    } as unknown) as T;
  }
  if (cmd === 'resolve_playlist') {
    const fakeId = 'mock-pl-' + Math.random().toString(36).substring(2, 8);
    return ({
      id: fakeId,
      name: 'Playlist Importada (Web Preview)',
      description: 'Execute no app Pulsar desktop para extração completa via yt-dlp.',
      cover_image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString(),
      is_imported_youtube_playlist: true,
      track_count: 5,
      total_duration_seconds: 1200
    } as unknown) as T;
  }
  if (cmd === 'create_playlist') {
    const name = (args?.name as string) || 'Nova Playlist';
    const description = (args?.description as string) || '';
    return ({
      id: 'pl-' + Date.now(),
      name,
      description,
      cover_image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString().split('T')[0],
      is_imported_youtube_playlist: false,
      track_count: 0,
      total_duration_seconds: 0
    } as unknown) as T;
  }
  if (cmd === 'update_playlist') {
    const id = (args?.id as string) || 'pl-1';
    const name = (args?.name as string) || 'Playlist Atualizada';
    const description = (args?.description as string) || '';
    const cover_image = (args?.cover_image as string) || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80';
    return ({
      id,
      name,
      description,
      cover_image,
      created_at: new Date().toISOString().split('T')[0],
      is_imported_youtube_playlist: false,
      track_count: 0,
      total_duration_seconds: 0
    } as unknown) as T;
  }
  if (cmd === 'upsert_playlist') {
    return (args?.playlist || {}) as T;
  }
  if (cmd === 'save_track_direct') {
    return (args?.track || {}) as T;
  }
  if (cmd === 'set_playlist_tracks') {
    return (null as unknown) as T;
  }
  if (cmd === 'get_app_version') {
    return ('0.2.6' as unknown) as T;
  }
  if (cmd === 'toggle_mini_player') {
    return (null as unknown) as T;
  }

  return (null as unknown) as T;
}

import { listen, type UnlistenFn, type EventCallback } from '@tauri-apps/api/event';

export async function safeListen<T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn> {
  if (isTauri()) {
    try {
      return await listen<T>(event, handler);
    } catch (err) {
      console.warn(`[Pulsar Tauri Event] Erro ao escutar evento '${event}':`, err);
    }
  }
  return () => {};
}
