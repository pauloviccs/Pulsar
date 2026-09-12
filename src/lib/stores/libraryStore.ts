import { writable, derived, get } from 'svelte/store';
import { safeInvoke } from '../api/tauri';
import { currentProfile } from './authStore';
import { getSupabase } from '../api/supabase';
import type { Track, Playlist, ActiveView, PlaylistVisibility } from '../types';

const INITIAL_TRACKS: Track[] = [
  {
    id: 'b0000000-0000-4000-8000-000000000001',
    youtube_video_id: 'jfKfPfyJRdk',
    title: 'Lofi Hip Hop Radio - Beats to Relax/Study to',
    artist_guess: 'Lofi Girl',
    channel_name: 'Lofi Girl',
    duration_seconds: 245,
    thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
    added_at: '2026-09-10',
    stream_url: 'http://127.0.0.1:41235/stream/jfKfPfyJRdk'
  },
  {
    id: 'b0000000-0000-4000-8000-000000000002',
    youtube_video_id: '5qap5aO4i9A',
    title: 'Midnight City (Synthwave Drive)',
    artist_guess: 'Neon Sunset',
    channel_name: 'RetroWaves FM',
    duration_seconds: 284,
    thumbnail_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80',
    added_at: '2026-09-09',
    stream_url: 'http://127.0.0.1:41235/stream/5qap5aO4i9A'
  },
  {
    id: 'b0000000-0000-4000-8000-000000000003',
    youtube_video_id: 'DWcJFNfaw9C',
    title: 'Deep Focus Ambient Sessions',
    artist_guess: 'Aura Sound',
    channel_name: 'Mind & Code',
    duration_seconds: 360,
    thumbnail_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
    added_at: '2026-09-08',
    stream_url: 'http://127.0.0.1:41235/stream/DWcJFNfaw9C'
  }
];

const INITIAL_PLAYLISTS: Playlist[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    name: 'Vibe Coding & Focus',
    description: 'Batidas imersivas para programar no fluxo contínuo sem distrações.',
    cover_image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
    created_at: '2026-09-01',
    is_imported_youtube_playlist: true,
    source_youtube_playlist_id: 'PL-flow-01',
    track_count: 3,
    total_duration_seconds: 889,
    visibility: 'public'
  }
];

export const allTracks = writable<Track[]>(INITIAL_TRACKS);
export const playlists = writable<Playlist[]>(INITIAL_PLAYLISTS);
export const favoriteTrackIds = writable<Set<string>>(new Set(['b0000000-0000-4000-8000-000000000001']));
export const activeView = writable<ActiveView>('home');
export const selectedPlaylist = writable<Playlist | null>(null);
export const selectedPlaylistTracks = writable<Track[]>([]);
export const recentTracks = writable<Track[]>([]);
export const searchQuery = writable<string>('');

export const isSidebarCollapsed = writable<boolean>(
  typeof window !== 'undefined' ? localStorage.getItem('pulsar_sidebar_collapsed') === 'true' : false
);

export const isAddLinkModalOpen = writable<boolean>(false);
export const isNewPlaylistModalOpen = writable<boolean>(false);
export const playlistToDelete = writable<Playlist | null>(null);
export const playlistToEdit = writable<Playlist | null>(null);

export const filteredTracks = derived(
  [allTracks, searchQuery],
  ([$tracks, $query]) => {
    if (!$query.trim()) return $tracks;
    const q = $query.toLowerCase();
    return $tracks.filter(
      t => t.title.toLowerCase().includes(q) ||
           t.artist_guess.toLowerCase().includes(q) ||
           t.channel_name.toLowerCase().includes(q)
    );
  }
);

export const libraryActions = {
  async initFromBackend() {
    try {
      const backendTracks = await safeInvoke<Track[]>('get_library_tracks');
      if (backendTracks && backendTracks.length > 0) {
        allTracks.set(backendTracks);
      }
    } catch (e) {
      console.warn('[Pulsar] Fallback de faixas:', e);
    }

    try {
      const backendPlaylists = await safeInvoke<Playlist[]>('get_playlists');
      if (backendPlaylists && backendPlaylists.length > 0) {
        // Recuperar capas salvas localmente se houver
        const hydrated = backendPlaylists.map(p => {
          try {
            const localCover = localStorage.getItem(`pulsar_cover_${p.id}`);
            if (localCover) {
              return { ...p, cover_image: localCover };
            }
          } catch {}
          return p;
        });
        playlists.set(hydrated);
      }
    } catch (e) {
      console.warn('[Pulsar] Fallback de playlists:', e);
    }

    try {
      const favTracks = await safeInvoke<Track[]>('get_favorite_tracks');
      if (favTracks && favTracks.length > 0) {
        allTracks.update(current => {
          const map = new Map(current.map(t => [t.id, t]));
          for (const ft of favTracks) {
            map.set(ft.id, ft);
          }
          return Array.from(map.values());
        });
        favoriteTrackIds.set(new Set(favTracks.map(t => t.id)));
      } else {
        const favIds = await safeInvoke<string[]>('get_favorites');
        if (favIds) {
          favoriteTrackIds.set(new Set(favIds));
        }
      }
    } catch (e) {
      console.warn('[Pulsar] Fallback de favoritos:', e);
    }

    try {
      const recents = await safeInvoke<Track[]>('get_recent_tracks');
      if (recents && recents.length > 0) {
        recentTracks.set(recents);
      }
    } catch (e) {
      console.warn('[Pulsar] Fallback de faixas recentes:', e);
    }
  },

  async loadPlaylistTracks(playlistId: string) {
    try {
      const tracks = await safeInvoke<Track[]>('get_playlist_tracks', { playlistId });
      if (tracks && tracks.length > 0) {
        selectedPlaylistTracks.set(tracks);
      } else {
        // Se o SQLite não tem faixas (ex: playlist pública da comunidade), busca do Supabase
        const { syncEngine } = await import('../services/syncEngine');
        const cloudTracks = await syncEngine.fetchPlaylistTracks(playlistId);
        selectedPlaylistTracks.set(cloudTracks || []);
      }
    } catch (e) {
      console.error('[Pulsar DB] Erro ao carregar faixas da playlist local, tentando nuvem:', e);
      try {
        const { syncEngine } = await import('../services/syncEngine');
        const cloudTracks = await syncEngine.fetchPlaylistTracks(playlistId);
        selectedPlaylistTracks.set(cloudTracks || []);
      } catch {
        selectedPlaylistTracks.set([]);
      }
    }
  },

  async loadRecentTracks() {
    try {
      const recents = await safeInvoke<Track[]>('get_recent_tracks');
      if (recents) {
        recentTracks.set(recents);
      }
    } catch (e) {
      console.error('[Pulsar DB] Erro ao buscar faixas recentes:', e);
    }
  },

  async recordTrackPlayed(trackId: string) {
    const trk = get(allTracks).find(t => t.id === trackId) || get(recentTracks).find(t => t.id === trackId);
    if (trk) {
      import('../services/syncEngine').then(({ syncEngine }) => {
        syncEngine.pushHistory(trk);
      });
    }

    try {
      await safeInvoke('record_track_played', { trackId });
      this.loadRecentTracks();
    } catch (e) {
      console.warn('[Pulsar DB] Erro ao registrar reprodução:', e);
    }
  },

  async setActiveView(view: ActiveView, playlist: Playlist | null = null) {
    activeView.set(view);
    selectedPlaylist.set(playlist);

    if (view === 'playlist-detail' && playlist) {
      await this.loadPlaylistTracks(playlist.id);
    } else if (view === 'recent') {
      await this.loadRecentTracks();
    }
  },

  async toggleFavorite(trackId: string, trackObj?: Track) {
    favoriteTrackIds.update(favs => {
      const next = new Set(favs);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });

    if (trackObj) {
      allTracks.update(current => {
        if (!current.some(t => t.id === trackObj.id)) {
          return [trackObj, ...current];
        }
        return current;
      });
    }

    const isFav = get(favoriteTrackIds).has(trackId);
    const trk = trackObj || get(allTracks).find(t => t.id === trackId);
    if (trk) {
      import('../services/syncEngine').then(({ syncEngine }) => {
        syncEngine.pushFavorite(trk.youtube_video_id, isFav);
      });
    }

    try {
      await safeInvoke('toggle_favorite', { trackId, track: trackObj || null });
    } catch (e) {
      console.error('[Pulsar DB] Erro ao alternar favorito:', e);
    }
  },

  async createPlaylist(name: string, description: string = '', visibility: PlaylistVisibility = 'public') {
    try {
      const created = await safeInvoke<Playlist>('create_playlist', { name, description });
      const fullPlaylist: Playlist = { ...created, visibility };
      playlists.update(list => [fullPlaylist, ...list]);

      import('../services/syncEngine').then(({ syncEngine }) => {
        syncEngine.pushPlaylist(fullPlaylist);
      });

      return fullPlaylist;
    } catch (e) {
      console.error('[Pulsar DB] Erro ao criar playlist no backend:', e);
      const fallback: Playlist = {
        id: crypto.randomUUID(),
        name,
        description,
        cover_image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        created_at: new Date().toISOString().split('T')[0],
        is_imported_youtube_playlist: false,
        track_count: 0,
        total_duration_seconds: 0,
        visibility
      };
      playlists.update(list => [fallback, ...list]);

      import('../services/syncEngine').then(({ syncEngine }) => {
        syncEngine.pushPlaylist(fallback);
      });

      return fallback;
    }
  },

  async updatePlaylist(id: string, name: string, description: string, coverImage?: string, visibility?: PlaylistVisibility) {
    if (coverImage) {
      try {
        localStorage.setItem(`pulsar_cover_${id}`, coverImage);
      } catch {}
    }

    try {
      const updated = await safeInvoke<Playlist>('update_playlist', {
        id,
        name,
        description,
        cover_image: coverImage || null,
        coverImage: coverImage || null
      });

      const finalPlaylist: Playlist = {
        ...updated,
        cover_image: coverImage || updated.cover_image,
        ...(visibility ? { visibility } : {})
      };

      playlists.update(list => list.map(p => p.id === id ? { ...p, ...finalPlaylist } : p));
      
      selectedPlaylist.update(curr => {
        if (curr && curr.id === id) {
          return { ...curr, ...finalPlaylist };
        }
        return curr;
      });

      import('../services/syncEngine').then(({ syncEngine }) => {
        syncEngine.pushPlaylist(finalPlaylist);
      });

      return finalPlaylist;
    } catch (e) {
      console.error('[Pulsar DB] Erro ao atualizar playlist no backend, aplicando fallback:', e);
      const fallbackUpdated: Partial<Playlist> = {
        name,
        description,
        ...(coverImage ? { cover_image: coverImage } : {})
      };
      playlists.update(list => list.map(p => p.id === id ? { ...p, ...fallbackUpdated } : p));
      selectedPlaylist.update(curr => curr && curr.id === id ? { ...curr, ...fallbackUpdated } : curr);

      const targetPl = get(playlists).find(p => p.id === id);
      if (targetPl) {
        import('../services/syncEngine').then(({ syncEngine }) => {
          syncEngine.pushPlaylist(targetPl);
        });
      }

      return fallbackUpdated as Playlist;
    }
  },

  async addTrackToPlaylist(playlistId: string, trackId: string) {
    try {
      await safeInvoke('add_track_to_playlist', { playlistId, trackId });
      playlists.update(list => list.map(p => {
        if (p.id === playlistId) {
          return { ...p, track_count: p.track_count + 1 };
        }
        return p;
      }));
      
      const updatedTracks = await safeInvoke<Track[]>('get_playlist_tracks', { playlistId });
      if (updatedTracks) {
        selectedPlaylistTracks.set(updatedTracks);
        import('../services/syncEngine').then(({ syncEngine }) => {
          syncEngine.pushPlaylistTracks(playlistId, updatedTracks);
        });
      }
    } catch (e) {
      console.error('[Pulsar DB] Erro ao adicionar faixa à playlist:', e);
    }
  },

  async removeTrackFromPlaylist(playlistId: string, trackId: string) {
    try {
      await safeInvoke('remove_track_from_playlist', { playlistId, trackId });
      playlists.update(list => list.map(p => {
        if (p.id === playlistId) {
          return { ...p, track_count: Math.max(0, p.track_count - 1) };
        }
        return p;
      }));

      const updatedTracks = await safeInvoke<Track[]>('get_playlist_tracks', { playlistId });
      if (updatedTracks) {
        selectedPlaylistTracks.set(updatedTracks);
        import('../services/syncEngine').then(({ syncEngine }) => {
          syncEngine.pushPlaylistTracks(playlistId, updatedTracks);
        });
      }
    } catch (e) {
      console.error('[Pulsar DB] Erro ao remover faixa da playlist:', e);
    }
  },

  async deletePlaylist(id: string) {
    playlists.update(list => list.filter(p => p.id !== id));
    activeView.set('library');
    selectedPlaylist.set(null);

    import('../services/syncEngine').then(({ syncEngine }) => {
      syncEngine.deletePlaylist(id);
    });

    try {
      await safeInvoke('delete_playlist', { id });
    } catch (e) {
      console.error('[Pulsar DB] Erro ao excluir playlist:', e);
    }
  },

  addTrack(track: Track) {
    allTracks.update(list => {
      const exists = list.some(t => t.youtube_video_id === track.youtube_video_id);
      if (exists) return list;
      return [track, ...list];
    });

    import('../services/syncEngine').then(({ syncEngine }) => {
      syncEngine.pushTrackToLibrary(track);
    });
  },

  async addPlaylist(pl: Playlist) {
    playlists.update(list => {
      const exists = list.some(p => p.id === pl.id);
      if (exists) return list;
      return [pl, ...list];
    });

    try {
      const tracks = await safeInvoke<Track[]>('get_playlist_tracks', { playlistId: pl.id });
      if (tracks && tracks.length > 0) {
        allTracks.update(curr => {
          const map = new Map(curr.map(t => [t.youtube_video_id, t]));
          for (const t of tracks) {
            map.set(t.youtube_video_id, t);
          }
          return Array.from(map.values());
        });
      }

      import('../services/syncEngine').then(({ syncEngine }) => {
        syncEngine.pushPlaylist(pl);
        if (tracks && tracks.length > 0) {
          syncEngine.pushPlaylistTracks(pl.id, tracks);
          syncEngine.pushTracksToLibraryBatch(tracks);
        }
      });
    } catch (e) {
      import('../services/syncEngine').then(({ syncEngine }) => {
        syncEngine.pushPlaylist(pl);
      });
    }
  },

  toggleSidebarCollapse() {
    isSidebarCollapsed.update(v => {
      const next = !v;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('pulsar_sidebar_collapsed', String(next));
        } catch {}
      }
      return next;
    });
  }
};
