import { writable, derived, get } from 'svelte/store';
import { safeInvoke } from '../api/tauri';
import { currentProfile } from './authStore';
import { getSupabase } from '../api/supabase';
import type { Track, Playlist, ActiveView, PlaylistVisibility } from '../types';

const INITIAL_TRACKS: Track[] = [];

const INITIAL_PLAYLISTS: Playlist[] = [];

export const allTracks = writable<Track[]>(INITIAL_TRACKS);
export const playlists = writable<Playlist[]>(INITIAL_PLAYLISTS);

function loadPinnedSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('pulsar_pinned_playlists');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function loadPlaylistOrder(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('pulsar_playlist_order');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const pinnedPlaylistIds = writable<Set<string>>(loadPinnedSet());
export const playlistOrder = writable<string[]>(loadPlaylistOrder());

export function parsePlaylistTime(timeStr?: string | null): number {
  if (!timeStr) return 0;
  if (timeStr.startsWith('timestamp-')) {
    const secs = parseInt(timeStr.replace('timestamp-', ''), 10);
    return isNaN(secs) ? 0 : secs * 1000;
  }
  const ms = new Date(timeStr).getTime();
  return isNaN(ms) ? 0 : ms;
}

// Playlists da biblioteca do usuário ativo (criadas por ele ou seguidas, isolando outras contas)
// 1. Playlists fixadas (is_pinned) SEMPRE no topo absoluto!
// 2. Playlists novas ou seguidas recentemente no topo das não-fixadas.
// 3. Ordem manual (Drag & Drop) preservada.
export const userLibraryPlaylists = derived(
  [playlists, currentProfile, pinnedPlaylistIds, playlistOrder],
  ([$playlists, $profile, $pinnedIds, $order]) => {
    const isGuest = !$profile || $profile.id.startsWith('guest');
    const filtered = $playlists.filter(pl => {
      // Ignora a playlist legada mock caso ainda resida em algum cache local
      if (pl.id === 'a0000000-0000-4000-8000-000000000001') return false;
      // 1. Usuário logado
      if (!isGuest && $profile) {
        if (pl.user_id && pl.user_id === $profile.id) return true;
        if (pl.is_followed) return true;
        return false;
      }
      // 2. Convidado / offline
      if (!pl.user_id || pl.user_id === 'guest-local-user') return true;
      if (pl.is_followed) return true;
      return false;
    });

    const withPin = filtered.map(p => ({
      ...p,
      is_pinned: $pinnedIds.has(p.id)
    }));

    const pinned = withPin.filter(p => p.is_pinned);
    const unpinned = withPin.filter(p => !p.is_pinned);

    const sortGroup = (group: Playlist[]) => {
      const getPlaylistTime = (p: Playlist) => {
        return parsePlaylistTime(p.followed_at || p.created_at);
      };

      if (!$order || $order.length === 0) {
        return [...group].sort((a, b) => getPlaylistTime(b) - getPlaylistTime(a));
      }
      return [...group].sort((a, b) => {
        const idxA = $order.indexOf(a.id);
        const idxB = $order.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA === -1 && idxB !== -1) return -1;
        if (idxA !== -1 && idxB === -1) return 1;
        return getPlaylistTime(b) - getPlaylistTime(a);
      });
    };

    return [...sortGroup(pinned), ...sortGroup(unpinned)];
  }
);

export const favoriteTrackIds = writable<Set<string>>(new Set());
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
        const pinnedSet = get(pinnedPlaylistIds);
        const hydrated = backendPlaylists.map(p => {
          const isPinned = pinnedSet.has(p.id) || Boolean(p.is_pinned);
          if (isPinned && !pinnedSet.has(p.id)) {
            pinnedSet.add(p.id);
          }
          try {
            const localCover = localStorage.getItem(`pulsar_cover_${p.id}`);
            if (localCover) {
              return { ...p, is_pinned: isPinned, cover_image: localCover };
            }
          } catch {}
          return { ...p, is_pinned: isPinned };
        });
        pinnedPlaylistIds.set(pinnedSet);
        try {
          localStorage.setItem('pulsar_pinned_playlists', JSON.stringify(Array.from(pinnedSet)));
        } catch {}
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

    // Enriquecimento dinâmico em background com dados reais do criador no Supabase
    try {
      const currPl = get(selectedPlaylist);
      const supabase = getSupabase();
      if (currPl && supabase) {
        if (currPl.user_id && (!currPl.owner_name || !currPl.owner_avatar_url)) {
          supabase
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('id', currPl.user_id)
            .maybeSingle()
            .then(({ data: prof }) => {
              if (prof) {
                selectedPlaylist.update(p => p ? {
                  ...p,
                  owner_name: prof.display_name || prof.username || p.owner_name,
                  owner_username: prof.username || p.owner_username,
                  owner_avatar_url: prof.avatar_url || p.owner_avatar_url
                } : null);
              }
            });
        } else if (!currPl.user_id) {
          supabase
            .from('cloud_playlists')
            .select('user_id, play_count, profiles:user_id(username, display_name, avatar_url)')
            .eq('id', currPl.id)
            .maybeSingle()
            .then(({ data: cData }) => {
              if (cData) {
                const prof = (cData as any).profiles;
                selectedPlaylist.update(p => p ? {
                  ...p,
                  user_id: cData.user_id,
                  owner_name: prof?.display_name || prof?.username || p.owner_name,
                  owner_username: prof?.username || p.owner_username,
                  owner_avatar_url: prof?.avatar_url || p.owner_avatar_url,
                  play_count: Math.max(p.play_count || 0, cData.play_count || 0)
                } : null);
              }
            });
        }
      }
    } catch {}
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
    const prof = get(currentProfile);
    const userId = prof?.id;
    const ownerName = prof?.display_name || prof?.username;
    const ownerUsername = prof?.username;
    const ownerAvatarUrl = prof?.avatar_url;

    try {
      const created = await safeInvoke<Playlist>('create_playlist', {
        name,
        description,
        userId: userId || null,
        user_id: userId || null,
        ownerName: ownerName || null,
        owner_name: ownerName || null,
        ownerUsername: ownerUsername || null,
        owner_username: ownerUsername || null,
        visibility,
        ownerAvatarUrl: ownerAvatarUrl || null,
        owner_avatar_url: ownerAvatarUrl || null
      });
      const fullPlaylist: Playlist = {
        ...created,
        visibility,
        user_id: userId,
        owner_name: ownerName,
        owner_username: ownerUsername,
        owner_avatar_url: ownerAvatarUrl,
        is_followed: false,
        play_count: 0,
        is_pinned: false
      };
      playlists.update(list => [fullPlaylist, ...list]);
      playlistOrder.update(order => [fullPlaylist.id, ...order.filter(id => id !== fullPlaylist.id)]);
      try {
        localStorage.setItem('pulsar_playlist_order', JSON.stringify(get(playlistOrder)));
      } catch {}

      console.log(`[Frontend] [Playlist] Nova playlist criada: "${fullPlaylist.name}" (${fullPlaylist.id}) posicionada no topo.`);

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
        created_at: new Date().toISOString(),
        is_imported_youtube_playlist: false,
        track_count: 0,
        total_duration_seconds: 0,
        visibility,
        user_id: userId,
        owner_name: ownerName,
        owner_username: ownerUsername,
        is_followed: false,
        play_count: 0,
        is_pinned: false
      };
      playlists.update(list => [fallback, ...list]);
      playlistOrder.update(order => [fallback.id, ...order.filter(id => id !== fallback.id)]);
      try {
        localStorage.setItem('pulsar_playlist_order', JSON.stringify(get(playlistOrder)));
      } catch {}

      console.log(`[Frontend] [Playlist] Fallback: Nova playlist criada: "${fallback.name}" (${fallback.id}) posicionada no topo.`);

      import('../services/syncEngine').then(({ syncEngine }) => {
        syncEngine.pushPlaylist(fallback);
      });

      return fallback;
    }
  },

  async toggleFollowPlaylist(playlistId: string) {
    const pl = get(playlists).find(p => p.id === playlistId) || get(selectedPlaylist);
    if (!pl) return;
    const nextVal = !pl.is_followed;
    const nowIso = new Date().toISOString();
    const updatedPl: Playlist = { 
      ...pl, 
      is_followed: nextVal,
      followed_at: nextVal ? nowIso : undefined
    };

    if (nextVal) {
      // Playlist seguida recentemente vai para o topo absoluto da ordem imediatamente
      playlistOrder.update(order => [playlistId, ...order.filter(id => id !== playlistId)]);
      try {
        localStorage.setItem('pulsar_playlist_order', JSON.stringify(get(playlistOrder)));
      } catch {}
    }

    console.log(`[Frontend] [PlaylistFollow] Playlist ${playlistId} follow alternado para: ${nextVal}. Topo: ${nextVal}`);

    // 1. Atualizar a store playlists garantindo que fique no topo da lista local!
    playlists.update(list => {
      const remaining = list.filter(p => p.id !== playlistId);
      if (nextVal) {
        // Se seguiu, coloca no TOPO da lista de playlists!
        return [updatedPl, ...remaining];
      } else {
        // Se for playlist de terceiro e deixou de seguir, remove da biblioteca local
        if (pl.user_id && pl.user_id !== get(currentProfile)?.id) {
          return remaining;
        }
        return [updatedPl, ...remaining];
      }
    });

    // 2. Atualizar a visualização detalhada atual
    selectedPlaylist.update(curr => {
      if (curr && curr.id === playlistId) {
        return updatedPl;
      }
      return curr;
    });

    // 3. Persistir no SQLite local nativo
    try {
      if (nextVal) {
        await safeInvoke('upsert_playlist', { playlist: updatedPl });
        const selTracks = get(selectedPlaylistTracks);
        if (selTracks && selTracks.length > 0) {
          const trackIds: string[] = [];
          for (const t of selTracks) {
            const saved = await safeInvoke<any>('save_track_direct', { track: t }).catch(() => null);
            trackIds.push(saved?.id || t.id);
          }
          await safeInvoke('set_playlist_tracks', { playlistId, trackIds }).catch(() => {});
        }
      } else {
        await safeInvoke('toggle_follow_playlist', { playlistId, follow: false });
      }
    } catch (e) {
      console.warn('[Pulsar DB] Erro ao alternar follow da playlist localmente:', e);
    }

    // 4. Sincronizar com o Supabase (gravar em playlist_follows e notificar criador)
    import('../services/syncEngine').then(({ syncEngine }) => {
      syncEngine.toggleFollowPlaylist(playlistId, nextVal);
    });
  },

  async togglePinPlaylist(playlistId: string, forceState?: boolean): Promise<boolean> {
    if (!playlistId) return false;
    let nextState = false;

    // 1. Atualizar pinnedPlaylistIds store e localStorage
    pinnedPlaylistIds.update(set => {
      const copy = new Set(set);
      if (forceState !== undefined) {
        nextState = forceState;
      } else {
        nextState = !copy.has(playlistId);
      }
      if (nextState) {
        copy.add(playlistId);
      } else {
        copy.delete(playlistId);
      }
      try {
        localStorage.setItem('pulsar_pinned_playlists', JSON.stringify(Array.from(copy)));
      } catch {}
      return copy;
    });

    // 2. Atualizar store playlists
    playlists.update(list => list.map(p => {
      if (p.id === playlistId) {
        return { ...p, is_pinned: nextState };
      }
      return p;
    }));

    // 3. Atualizar selectedPlaylist se for a playlist em foco
    selectedPlaylist.update(curr => {
      if (curr && curr.id === playlistId) {
        return { ...curr, is_pinned: nextState };
      }
      return curr;
    });

    // 4. Se fixada, promove imediatamente para o topo absoluto da ordem
    if (nextState) {
      playlistOrder.update(order => [playlistId, ...order.filter(id => id !== playlistId)]);
      try {
        localStorage.setItem('pulsar_playlist_order', JSON.stringify(get(playlistOrder)));
      } catch {}
    }

    console.log(`[Frontend] [PlaylistPin] Playlist ${playlistId} agora está: ${nextState ? 'FIXADA NO TOPO' : 'DESAFIXADA'}`);

    // 5. Se for playlist externa que ainda não era seguida e foi fixada, segue automaticamente
    const pl = get(playlists).find(p => p.id === playlistId);
    const prof = get(currentProfile);
    if (nextState && pl && pl.user_id && pl.user_id !== prof?.id && !pl.is_followed) {
      await this.toggleFollowPlaylist(playlistId);
    }

    // 6. Persistir no SQLite local nativo
    try {
      await safeInvoke('toggle_pin_playlist', { 
        playlistId, 
        playlist_id: playlistId, 
        isPinned: nextState, 
        is_pinned: nextState 
      });
    } catch (e) {
      console.warn('[Pulsar DB] Erro ao salvar status de pin no SQLite:', e);
    }

    return nextState;
  },

  async reorderPlaylists(orderedIds: string[]) {
    if (!orderedIds || orderedIds.length === 0) return;

    // 1. Atualizar store playlistOrder e localStorage
    playlistOrder.set(orderedIds);
    try {
      localStorage.setItem('pulsar_playlist_order', JSON.stringify(orderedIds));
    } catch {}

    // 2. Reordenar a store playlists mantendo a consistência
    playlists.update(list => {
      const map = new Map(list.map(p => [p.id, p]));
      const reordered: Playlist[] = [];
      for (const id of orderedIds) {
        const item = map.get(id);
        if (item) {
          reordered.push(item);
          map.delete(id);
        }
      }
      for (const remaining of map.values()) {
        reordered.push(remaining);
      }
      return reordered;
    });

    console.log(`[Frontend] [PlaylistOrder] Nova ordem definida com ${orderedIds.length} playlists. Topo: ${orderedIds[0]}`);

    // 3. Persistir nova ordem no SQLite nativo
    try {
      await safeInvoke('save_playlist_order', { 
        playlistIds: orderedIds, 
        playlist_ids: orderedIds 
      });
    } catch (e) {
      console.warn('[Pulsar DB] Erro ao salvar ordem de playlists no SQLite:', e);
    }
  },

  async movePlaylistUp(playlistId: string) {
    const list = get(userLibraryPlaylists);
    const ids = list.map(p => p.id);
    const idx = ids.indexOf(playlistId);
    if (idx <= 0) return;
    const temp = ids[idx];
    ids[idx] = ids[idx - 1];
    ids[idx - 1] = temp;
    console.log(`[Frontend] [PlaylistOrder] Movendo playlist ${playlistId} uma posição acima.`);
    await this.reorderPlaylists(ids);
  },

  async movePlaylistDown(playlistId: string) {
    const list = get(userLibraryPlaylists);
    const ids = list.map(p => p.id);
    const idx = ids.indexOf(playlistId);
    if (idx === -1 || idx >= ids.length - 1) return;
    const temp = ids[idx];
    ids[idx] = ids[idx + 1];
    ids[idx + 1] = temp;
    console.log(`[Frontend] [PlaylistOrder] Movendo playlist ${playlistId} uma posição abaixo.`);
    await this.reorderPlaylists(ids);
  },

  async recordPlaylistPlay(playlistId: string) {
    if (!playlistId) return;

    playlists.update(list => list.map(p => {
      if (p.id === playlistId) {
        return { ...p, play_count: (p.play_count || 0) + 1 };
      }
      return p;
    }));

    selectedPlaylist.update(curr => {
      if (curr && curr.id === playlistId) {
        return { ...curr, play_count: (curr.play_count || 0) + 1 };
      }
      return curr;
    });

    try {
      await safeInvoke('increment_playlist_play', { playlistId });
    } catch (e) {
      // Ignora erro em contagem local
    }

    import('../services/syncEngine').then(({ syncEngine }) => {
      syncEngine.incrementPlaylistPlay(playlistId);
    });
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
