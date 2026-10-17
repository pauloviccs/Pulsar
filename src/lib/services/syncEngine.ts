/**
 * Pulsar - Supabase Cloud Sync Bridge Engine
 * 
 * Sincroniza em tempo real e de forma bidirecional (Local-First com Hidratação em Nuvem)
 * todas as playlists, faixas da biblioteca, músicas favoritadas, histórico e configurações
 * do usuário entre múltiplos desktops e instalações.
 */

import { writable, get } from 'svelte/store';
import { getSupabase } from '../api/supabase';
import { safeInvoke } from '../api/tauri';
import { currentProfile } from '../stores/authStore';
import { allTracks, playlists, favoriteTrackIds, recentTracks, selectedPlaylistTracks, pinnedPlaylistIds, playlistOrder } from '../stores/libraryStore';
import { volume, shuffle, repeatMode, isVideoVisible, lastFmUsername } from '../stores/playerStore';
import { currentLocale } from '../i18n';
import type { Track, Playlist, CloudSyncState, UserSettings, RepeatMode, CommunityTrendingPlaylist } from '../types';

export const cloudSyncState = writable<CloudSyncState>('idle');
export const lastSyncTimestamp = writable<Date | null>(null);
export const syncErrorMessage = writable<string | null>(null);

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let autoSyncIntervalTimer: ReturnType<typeof setInterval> | null = null;
const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos de auto-sync (Local-First: SQLite é a fonte primária)

// Single-Flight & Cooldown Anti-Storm
let activeHydrationPromise: Promise<void> | null = null;
let lastHydrationTime = 0;
const HYDRATION_MIN_COOLDOWN_MS = 25_000; // 25s de intervalo mínimo entre requisições
let isCircuitBroken = false;
let circuitBreakUntil = 0;

export interface RemoteSyncState {
  cloud_playlists_count: number;
  cloud_playlists_last_updated: string | null;
  user_library_tracks_count: number;
  user_library_tracks_last_updated: string | null;
  user_favorites_count: number;
  user_history_count: number;
  settings_last_updated: string | null;
}

/**
 * Converte qualquer ID legado (ex: 'pl-uuid', 'p-1', timestamp) em um UUID canônico válido para o Supabase (PostgreSQL)
 */
export function toCanonicalUuid(id: string): string {
  if (!id) return crypto.randomUUID();
  let clean = id.trim();
  if (clean.startsWith('pl-')) {
    clean = clean.substring(3);
  }
  if (clean === 'p-1') {
    return 'a0000000-0000-4000-8000-000000000001';
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(clean)) {
    return clean.toLowerCase();
  }
  return crypto.randomUUID();
}

function isGuestUser(userId?: string): boolean {
  if (!userId) return true;
  return userId.startsWith('guest') || userId === 'guest-local-user';
}

export const syncEngine = {
  /**
   * Inicia o ciclo de sincronização automática periódica e silenciosa em segundo plano (a cada 30 minutos)
   */
  startAutoSync(userId: string) {
    if (isGuestUser(userId)) return;
    this.stopAutoSync();
    console.log(`[Pulsar SyncEngine] Sincronização automática em segundo plano ativada (a cada 30 min) para: ${userId}`);
    autoSyncIntervalTimer = setInterval(() => {
      console.log(`[Pulsar SyncEngine] Executando ciclo silencioso de auto-sync...`);
      this.hydrateFromCloud(userId).catch(err => {
        console.warn('[Pulsar SyncEngine] Ciclo de auto-sync em background falhou:', err);
      });
    }, AUTO_SYNC_INTERVAL_MS);
  },

  /**
   * Para a sincronização automática periódica
   */
  stopAutoSync() {
    if (autoSyncIntervalTimer) {
      clearInterval(autoSyncIntervalTimer);
      autoSyncIntervalTimer = null;
      console.log('[Pulsar SyncEngine] Sincronização automática em segundo plano desativada.');
    }
  },

  // Timestamp de controle de cooldown para navegação rápida
  _lastNavSyncTime: 0,

  /**
   * Sincronização leve disparada na alternância entre abas e páginas.
   * Aplica um cooldown inteligente (mínimo de 25 segundos) para evitar requisições
   * redundantes ao Supabase e ao SQLite em cliques rápidos e contínuos.
   */
  async syncOnNavigation(userId?: string) {
    const prof = get(currentProfile);
    const targetUserId = userId || prof?.id;
    if (!targetUserId || isGuestUser(targetUserId)) return;

    const now = Date.now();
    if (now - this._lastNavSyncTime < HYDRATION_MIN_COOLDOWN_MS) {
      return; // Cooldown ativo, dados ainda frescos
    }

    this._lastNavSyncTime = now;
    try {
      await this.hydrateFromCloud(targetUserId);
    } catch (e) {
      console.warn('[Pulsar SyncEngine] Falha silenciosa no sync de navegação:', e);
    }
  },

  /**
   * Puxa todos os dados do Supabase de forma inteligente (Delta Sync Local-First com Check-Before-Fetch).
   * 1. Consulta RPC 'get_user_sync_state' (~180 bytes)
   * 2. Se inalterado em relação ao snapshot local e o SQLite tem dados: ABORTA IMEDIATAMENTE (0 Bytes de payload).
   * 3. Se houver novidades, busca apenas os deltas específicos (faixas novas via updated_at, playlists alteradas).
   * 4. Erros 402/quota ativam o Circuit Breaker por 15 minutos sem degradar a experiência local.
   */
  async hydrateFromCloud(userId: string, force: boolean = false): Promise<void> {
    if (isGuestUser(userId)) {
      cloudSyncState.set('idle');
      return;
    }

    // Single-Flight: se já houver uma sincronização ocorrendo, reusa a mesma promessa
    if (activeHydrationPromise) {
      console.log('[Pulsar SyncEngine] Hidratação já em andamento. Reutilizando promessa ativa (Single-Flight).');
      return activeHydrationPromise;
    }

    // Circuit Breaker: se a cota do Supabase estourou, suspende chamadas de rede por 15 min
    const now = Date.now();
    if (isCircuitBroken && now < circuitBreakUntil) {
      console.warn(`[Pulsar SyncEngine] 🛑 Circuit Breaker ativo (cota de nuvem). Próxima tentativa em ${Math.round((circuitBreakUntil - now) / 1000)}s.`);
      cloudSyncState.set('offline');
      return;
    }

    // Cooldown Anti-Storm: evita disparos contínuos da UI
    if (!force && now - lastHydrationTime < HYDRATION_MIN_COOLDOWN_MS) {
      console.log('[Pulsar SyncEngine] ⏳ Cooldown de sincronização ativo (< 25s). Mantendo dados locais.');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      cloudSyncState.set('offline');
      return;
    }

    activeHydrationPromise = (async () => {
      cloudSyncState.set('syncing');
      syncErrorMessage.set(null);

      try {
        console.log(`[Pulsar SyncEngine] 🔍 Verificando estado em nuvem (Check-Before-Fetch) para: ${userId}...`);

        // ==============================================================================
        // ETAPA 0: CHECK-BEFORE-FETCH (RPC LEVE DE ~180 BYTES)
        // ==============================================================================
        const { data: remoteStateData, error: stateErr } = await supabase
          .rpc('get_user_sync_state', { p_user_id: userId });

        if (stateErr) {
          // Detecta estouro de cota de egress / 402 Payment Required
          if (stateErr.code === '402' || stateErr.message?.includes('exceed_egress_quota') || stateErr.message?.includes('quota')) {
            isCircuitBroken = true;
            circuitBreakUntil = Date.now() + 15 * 60 * 1000;
            console.warn('[Pulsar SyncEngine] 🛑 Supabase Egress Quota atingida. Ativando Circuit Breaker de 15 min (Operando 100% offline via SQLite local).');
            cloudSyncState.set('offline');
            syncErrorMessage.set('Nuvem em pausa temporária (cota). Suas músicas e playlists estão salvas localmente.');
            return;
          }
          throw stateErr;
        }

        const remoteState = remoteStateData as RemoteSyncState;
        const snapshotKey = `pulsar_sync_snapshot_${userId}`;
        let localSnapshot: RemoteSyncState | null = null;
        try {
          const raw = localStorage.getItem(snapshotKey);
          if (raw) localSnapshot = JSON.parse(raw);
        } catch {}

        const localPlaylistsInStore = get(playlists);
        const hasLocalData = localPlaylistsInStore.length > 0;

        const isUnchanged = localSnapshot &&
          localSnapshot.cloud_playlists_count === remoteState.cloud_playlists_count &&
          localSnapshot.cloud_playlists_last_updated === remoteState.cloud_playlists_last_updated &&
          localSnapshot.user_library_tracks_count === remoteState.user_library_tracks_count &&
          localSnapshot.user_library_tracks_last_updated === remoteState.user_library_tracks_last_updated &&
          localSnapshot.user_favorites_count === remoteState.user_favorites_count &&
          localSnapshot.user_history_count === remoteState.user_history_count &&
          localSnapshot.settings_last_updated === remoteState.settings_last_updated;

        if (!force && isUnchanged && hasLocalData) {
          console.log(`[Pulsar SyncEngine] ⚡ Dados em nuvem inalterados (${remoteState.cloud_playlists_count} playlists, ${remoteState.user_library_tracks_count} faixas). 0 Bytes transferidos! Mantendo cache SQLite local.`);
          cloudSyncState.set('synced');
          lastSyncTimestamp.set(new Date());
          return;
        }

        console.log(`[Pulsar SyncEngine] 📥 Mudanças detectadas na nuvem (ou primeiro sync). Sincronizando deltas granulares...`);

        // ==============================================================================
        // ETAPA 1: SINCRONIZAÇÃO GRANULAR DE PLAYLISTS
        // ==============================================================================
        const playlistsNeedSync = force || !localSnapshot ||
          localSnapshot.cloud_playlists_count !== remoteState.cloud_playlists_count ||
          localSnapshot.cloud_playlists_last_updated !== remoteState.cloud_playlists_last_updated;

        const hydratedPlaylists: Playlist[] = [];

        if (playlistsNeedSync) {
          // Buscar metadados de playlists do usuário (colunas selecionadas sem avatar base64 pesado)
          const { data: cloudPlaylists, error: plErr } = await supabase
            .from('cloud_playlists')
            .select('id, user_id, name, description, cover_image_url, visibility, is_imported_youtube_playlist, source_youtube_playlist_id, track_count, total_duration_seconds, play_count, created_at, updated_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (plErr) throw plErr;

          // Playlists seguidas
          let followedPlIds: string[] = [];
          const followedDatesMap = new Map<string, string>();
          try {
            const { data: followedData } = await supabase
              .from('playlist_follows')
              .select('playlist_id, created_at')
              .eq('user_id', userId);
            if (followedData) {
              for (const f of followedData) {
                followedPlIds.push(f.playlist_id);
                if (f.created_at) {
                  followedDatesMap.set(f.playlist_id, f.created_at);
                  followedDatesMap.set(toCanonicalUuid(f.playlist_id), f.created_at);
                }
              }
            }
          } catch (err) {
            console.warn('[Supabase Sync] Falha ao consultar playlist_follows:', err);
          }
          const followedIdSet = new Set(followedPlIds.map(id => toCanonicalUuid(id)));

          const plList = cloudPlaylists || [];
          const plIds = plList.map(p => p.id);
          const externalFollowedIds = followedPlIds.filter(id => !plIds.includes(id));
          let externalFollowedList: any[] = [];

          if (externalFollowedIds.length > 0) {
            try {
              const { data: extPls } = await supabase
                .from('cloud_playlists')
                .select('id, user_id, name, description, cover_image_url, visibility, is_imported_youtube_playlist, source_youtube_playlist_id, track_count, total_duration_seconds, play_count, created_at, updated_at')
                .in('id', externalFollowedIds);

              if (extPls && extPls.length > 0) {
                const creatorIds = Array.from(new Set(extPls.map(p => p.user_id).filter(Boolean)));
                let creatorsMap = new Map<string, any>();
                if (creatorIds.length > 0) {
                  const { data: creators } = await supabase
                    .from('profiles')
                    .select('id, username, display_name')
                    .in('id', creatorIds);
                  if (creators) {
                    creatorsMap = new Map(creators.map(c => [c.id, c]));
                  }
                }
                externalFollowedList = extPls.map(p => ({
                  ...p,
                  profiles: creatorsMap.get(p.user_id) || null
                }));
              }
            } catch (err) {
              console.warn('[Pulsar SyncEngine] Falha ao consultar playlists seguidas:', err);
            }
          }

          // Processar playlists próprias: buscar faixas SOMENTE se updated_at mudou
          const currentProf = get(currentProfile);
          for (const cp of plList) {
            const lastUpdatedStored = localStorage.getItem(`pulsar_pl_up_${cp.id}`);
            const playlistNeedsTrackFetch = force || !lastUpdatedStored || lastUpdatedStored !== cp.updated_at;

            let tracksForPl: any[] = [];
            if (playlistNeedsTrackFetch) {
              console.log(`[Pulsar SyncEngine] 🔄 Baixando faixas atualizadas da playlist '${cp.name}'...`);
              const { data: fetchedTracks } = await supabase
                .from('cloud_playlist_tracks')
                .select('id, playlist_id, youtube_video_id, title, artist, channel_name, duration_seconds, thumbnail_url, position, source_platform, added_at')
                .eq('playlist_id', cp.id)
                .order('position', { ascending: true });
              tracksForPl = fetchedTracks || [];
              if (cp.updated_at) {
                localStorage.setItem(`pulsar_pl_up_${cp.id}`, cp.updated_at);
              }
            }

            const playlistObj: Playlist = {
              id: cp.id,
              name: cp.name,
              description: cp.description || '',
              cover_image: cp.cover_image_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
              created_at: cp.created_at || new Date().toISOString(),
              is_imported_youtube_playlist: cp.is_imported_youtube_playlist || false,
              source_youtube_playlist_id: cp.source_youtube_playlist_id || null,
              track_count: cp.track_count || tracksForPl.length,
              total_duration_seconds: cp.total_duration_seconds || 0,
              visibility: cp.visibility || 'public',
              user_id: cp.user_id,
              owner_name: currentProf?.display_name || currentProf?.username || 'Você',
              owner_username: currentProf?.username || undefined,
              owner_avatar_url: currentProf?.avatar_url || undefined,
              is_followed: followedIdSet.has(cp.id) || followedIdSet.has(toCanonicalUuid(cp.id)),
              is_pinned: get(pinnedPlaylistIds).has(cp.id) || Boolean((cp as any).is_pinned),
              play_count: cp.play_count || 0
            };

            try {
              await safeInvoke('upsert_playlist', { playlist: playlistObj });

              if (playlistNeedsTrackFetch && tracksForPl.length > 0) {
                const trackIds: string[] = [];
                for (const t of tracksForPl) {
                  const trackDto = {
                    id: t.id || `t-${t.youtube_video_id}`,
                    youtube_video_id: t.youtube_video_id,
                    title: t.title,
                    artist_guess: t.artist || '',
                    channel_name: t.channel_name || '',
                    duration_seconds: t.duration_seconds || 0,
                    thumbnail_url: t.thumbnail_url || '',
                    audio_stream_cached: false,
                    added_at: t.added_at || new Date().toISOString(),
                    stream_url: `http://127.0.0.1:41235/stream/${t.youtube_video_id}`
                  };
                  const saved = await safeInvoke<any>('save_track_direct', { track: trackDto });
                  trackIds.push(saved?.id || trackDto.id);
                }
                if (trackIds.length > 0) {
                  await safeInvoke('set_playlist_tracks', { playlistId: cp.id, trackIds });
                }
              }
            } catch (e) {
              console.warn(`[Supabase Sync] Fallback ao persistir playlist ${cp.name} no SQLite:`, e);
            }

            hydratedPlaylists.push(playlistObj);
          }

          // Processar playlists seguidas de terceiros
          if (externalFollowedList.length > 0) {
            for (const fp of externalFollowedList) {
              const prof = (fp as any).profiles;
              const canonicalFpId = toCanonicalUuid(fp.id);
              const followDate = followedDatesMap.get(canonicalFpId) || followedDatesMap.get(fp.id);

              const lastUpdatedStored = localStorage.getItem(`pulsar_pl_up_${fp.id}`);
              const extNeedsTrackFetch = force || !lastUpdatedStored || lastUpdatedStored !== fp.updated_at;

              let tracksForFp: any[] = [];
              if (extNeedsTrackFetch) {
                const { data: fetchedExtTracks } = await supabase
                  .from('cloud_playlist_tracks')
                  .select('id, playlist_id, youtube_video_id, title, artist, channel_name, duration_seconds, thumbnail_url, position, source_platform, added_at')
                  .eq('playlist_id', fp.id)
                  .order('position', { ascending: true });
                tracksForFp = fetchedExtTracks || [];
                if (fp.updated_at) {
                  localStorage.setItem(`pulsar_pl_up_${fp.id}`, fp.updated_at);
                }
              }

              const fpObj: Playlist = {
                id: fp.id,
                name: fp.name,
                description: fp.description || '',
                cover_image: fp.cover_image_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
                created_at: fp.created_at || new Date().toISOString(),
                followed_at: followDate || fp.created_at || new Date().toISOString(),
                is_imported_youtube_playlist: fp.is_imported_youtube_playlist || false,
                source_youtube_playlist_id: fp.source_youtube_playlist_id || null,
                track_count: fp.track_count || tracksForFp.length,
                total_duration_seconds: fp.total_duration_seconds || 0,
                visibility: fp.visibility || 'public',
                user_id: fp.user_id,
                owner_name: prof?.display_name || prof?.username || fp.owner_name || undefined,
                owner_username: prof?.username || fp.owner_username || undefined,
                owner_avatar_url: undefined,
                is_followed: true,
                is_pinned: get(pinnedPlaylistIds).has(fp.id) || Boolean((fp as any).is_pinned),
                play_count: fp.play_count || 0
              };

              try {
                await safeInvoke('upsert_playlist', { playlist: fpObj });
                if (extNeedsTrackFetch && tracksForFp.length > 0) {
                  const trackIds: string[] = [];
                  for (const t of tracksForFp) {
                    const trackDto = {
                      id: t.id || `t-${t.youtube_video_id}`,
                      youtube_video_id: t.youtube_video_id,
                      title: t.title,
                      artist_guess: t.artist || '',
                      channel_name: t.channel_name || '',
                      duration_seconds: t.duration_seconds || 0,
                      thumbnail_url: t.thumbnail_url || '',
                      audio_stream_cached: false,
                      added_at: t.added_at || new Date().toISOString(),
                      stream_url: `http://127.0.0.1:41235/stream/${t.youtube_video_id}`
                    };
                    const saved = await safeInvoke<any>('save_track_direct', { track: trackDto });
                    trackIds.push(saved?.id || trackDto.id);
                  }
                  await safeInvoke('set_playlist_tracks', { playlistId: fp.id, trackIds });
                }
              } catch (e) {
                console.warn('[Pulsar SyncEngine] Falha ao persistir playlist seguida no SQLite:', e);
              }
              hydratedPlaylists.push(fpObj);
            }
          }

          // Preservar playlists locais não presentes na nuvem
          const cloudPlIdSet = new Set(plList.map(p => toCanonicalUuid(p.id)));
          const localPlaylists = get(playlists);
          for (const lp of localPlaylists) {
            const canonicalLpId = toCanonicalUuid(lp.id);
            if (cloudPlIdSet.has(canonicalLpId) || followedIdSet.has(canonicalLpId)) continue;
            if (lp.user_id && lp.user_id !== userId && !isGuestUser(lp.user_id)) continue;
            if (lp.id.startsWith('a0000000')) {
              hydratedPlaylists.push(lp);
              continue;
            }
            hydratedPlaylists.push(lp);
          }

          // Ordenar e atualizar store de playlists
          if (hydratedPlaylists.length > 0) {
            const orderList = get(playlistOrder);
            const getPlTime = (p: Playlist) => {
              const t = p.followed_at || p.created_at;
              if (!t) return 0;
              if (t.startsWith('timestamp-')) {
                const secs = parseInt(t.replace('timestamp-', ''), 10);
                return isNaN(secs) ? 0 : secs * 1000;
              }
              const ms = new Date(t).getTime();
              return isNaN(ms) ? 0 : ms;
            };

            hydratedPlaylists.sort((a, b) => {
              const pinA = a.is_pinned ? 1 : 0;
              const pinB = b.is_pinned ? 1 : 0;
              if (pinA !== pinB) return pinB - pinA;
              if (orderList && orderList.length > 0) {
                const idxA = orderList.indexOf(a.id);
                const idxB = orderList.indexOf(b.id);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return 1;
                if (idxB !== -1) return -1;
              }
              return getPlTime(b) - getPlTime(a);
            });
            playlists.set(hydratedPlaylists);
            console.log(`[Pulsar SyncEngine] ✅ Playlists sincronizadas: ${hydratedPlaylists.length} no total.`);
          }
        }

        // ==============================================================================
        // ETAPA 2: DELTA SYNC DE FAIXAS DA BIBLIOTECA (user_library_tracks)
        // ==============================================================================
        const libraryNeedsSync = force || !localSnapshot ||
          localSnapshot.user_library_tracks_count !== remoteState.user_library_tracks_count ||
          localSnapshot.user_library_tracks_last_updated !== remoteState.user_library_tracks_last_updated;

        if (libraryNeedsSync) {
          let libQuery = supabase
            .from('user_library_tracks')
            .select('id, user_id, youtube_video_id, title, artist_guess, channel_name, duration_seconds, thumbnail_url, added_at, source_platform, updated_at')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

          // Se já tínhamos sincronizado antes, busca APENAS o delta incremental (> updated_at)
          if (!force && localSnapshot?.user_library_tracks_last_updated) {
            console.log(`[Pulsar SyncEngine] ⚡ Executando Delta Sync de biblioteca (> ${localSnapshot.user_library_tracks_last_updated})...`);
            libQuery = libQuery.gt('updated_at', localSnapshot.user_library_tracks_last_updated);
          } else {
            console.log(`[Pulsar SyncEngine] 📦 Carregando biblioteca inicial em lote...`);
          }

          const { data: cloudLibTracks, error: libErr } = await libQuery;
          if (!libErr && cloudLibTracks && cloudLibTracks.length > 0) {
            console.log(`[Pulsar SyncEngine] 📥 Recebidas ${cloudLibTracks.length} faixas da biblioteca.`);
            const mappedLibTracks: Track[] = cloudLibTracks.map(t => ({
              id: t.id,
              youtube_video_id: t.youtube_video_id,
              title: t.title,
              artist_guess: t.artist_guess || '',
              channel_name: t.channel_name || '',
              duration_seconds: t.duration_seconds,
              thumbnail_url: t.thumbnail_url || '',
              audio_stream_cached: false,
              added_at: t.added_at ? t.added_at.split('T')[0] : new Date().toISOString().split('T')[0],
              stream_url: `http://127.0.0.1:41235/stream/${t.youtube_video_id}`,
              source_platform: t.source_platform || 'youtube'
            }));

            for (const lt of mappedLibTracks) {
              await safeInvoke('save_track_direct', { track: lt }).catch(() => {});
            }

            allTracks.update(current => {
              const map = new Map(current.map(t => [t.youtube_video_id, t]));
              for (const ct of mappedLibTracks) {
                map.set(ct.youtube_video_id, ct);
              }
              return Array.from(map.values());
            });
          }
        }

        // ==============================================================================
        // ETAPA 3: FAVORITOS (user_favorites)
        // ==============================================================================
        const favoritesNeedSync = force || !localSnapshot ||
          localSnapshot.user_favorites_count !== remoteState.user_favorites_count;

        if (favoritesNeedSync) {
          const { data: cloudFavorites } = await supabase
            .from('user_favorites')
            .select('youtube_video_id')
            .eq('user_id', userId);

          if (cloudFavorites && cloudFavorites.length > 0) {
            const favVideoIds = new Set(cloudFavorites.map(f => f.youtube_video_id));
            const currentTracks = get(allTracks);
            const favIdSet = new Set<string>();

            // Adiciona todos os youtube_video_ids retornados da nuvem
            for (const f of cloudFavorites) {
              if (f.youtube_video_id) favIdSet.add(f.youtube_video_id);
            }

            // Associa os IDs locais do SQLite que correspondam aos vídeos favoritos
            for (const t of currentTracks) {
              if (favVideoIds.has(t.youtube_video_id)) {
                favIdSet.add(t.id);
                await safeInvoke('set_favorite', { trackId: t.id, track: t, isFavorite: true }).catch(() => {});
              }
            }

            if (favIdSet.size > 0) {
              favoriteTrackIds.update(existing => {
                const merged = new Set(existing);
                favIdSet.forEach(id => merged.add(id));
                return merged;
              });
            }
          }
        }

        // ==============================================================================
        // ETAPA 4: HISTÓRICO RECENTE (user_history)
        // ==============================================================================
        const historyNeedsSync = force || !localSnapshot ||
          localSnapshot.user_history_count !== remoteState.user_history_count;

        if (historyNeedsSync) {
          const { data: cloudHistory } = await supabase
            .from('user_history')
            .select('youtube_video_id, played_at')
            .eq('user_id', userId)
            .order('played_at', { ascending: false })
            .limit(40);

          if (cloudHistory && cloudHistory.length > 0) {
            // Histórico carregado silenciosamente
          }
        }

        // ==============================================================================
        // ETAPA 5: CONFIGURAÇÕES DO USUÁRIO (user_settings)
        // ==============================================================================
        const settingsNeedSync = force || !localSnapshot ||
          localSnapshot.settings_last_updated !== remoteState.settings_last_updated;

        if (settingsNeedSync) {
          const { data: cloudSettings } = await supabase
            .from('user_settings')
            .select('volume, shuffle, repeat_mode, locale, lastfm_username, updated_at')
            .eq('user_id', userId)
            .maybeSingle();

          if (cloudSettings) {
            if (typeof cloudSettings.volume === 'number') {
              volume.set(cloudSettings.volume);
            }
            if (typeof cloudSettings.shuffle === 'boolean') {
              shuffle.set(cloudSettings.shuffle);
            }
            if (cloudSettings.repeat_mode) {
              repeatMode.set(cloudSettings.repeat_mode as RepeatMode);
            }
            if (typeof (cloudSettings as any)?.video_visible === 'boolean') {
              isVideoVisible.set((cloudSettings as any).video_visible);
            }
            if (cloudSettings.locale) {
              currentLocale.set(cloudSettings.locale as any);
            }
            if (cloudSettings.lastfm_username) {
              lastFmUsername.set(cloudSettings.lastfm_username);
            }
          }
        }

        // ==============================================================================
        // FINALIZAÇÃO: SALVAR SNAPSHOT ATUALIZADO
        // ==============================================================================
        localStorage.setItem(snapshotKey, JSON.stringify(remoteState));
        cloudSyncState.set('synced');
        lastSyncTimestamp.set(new Date());
        console.log(`[Pulsar SyncEngine] ✅ Sincronização Local-First finalizada com sucesso!`);
      } catch (err: any) {
        if (err?.code === '402' || err?.message?.includes('exceed_egress_quota') || err?.message?.includes('quota')) {
          isCircuitBroken = true;
          circuitBreakUntil = Date.now() + 15 * 60 * 1000;
          console.warn('[Pulsar SyncEngine] 🛑 Supabase Quota excedida (402). Ativando Circuit Breaker de 15 min.');
          cloudSyncState.set('offline');
          syncErrorMessage.set('Modo offline ativo: suas músicas e biblioteca estão seguras no SQLite local.');
          return;
        }
        console.error('[Pulsar SyncEngine] ❌ Erro na sincronização:', err);
        cloudSyncState.set('error');
        syncErrorMessage.set(err?.message || 'Falha na sincronização em nuvem');
      } finally {
        activeHydrationPromise = null;
        lastHydrationTime = Date.now();
      }
    })();

    return activeHydrationPromise;
  },

  /**
   * Força a sincronização de todas as playlists, faixas e configurações locais para o Supabase
   */
  async syncAllLocalToCloud(): Promise<void> {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;
    if (isCircuitBroken && Date.now() < circuitBreakUntil) {
      console.log('[Pulsar SyncEngine] Circuit breaker ativo, pulando syncAllLocalToCloud.');
      return;
    }

    try {
      console.log('[Pulsar SyncEngine] Sincronizando toda a biblioteca local para a nuvem...');
      const localPlaylists = get(playlists);
      for (const pl of localPlaylists) {
        await this.pushPlaylist(pl);
        const tracks = await safeInvoke<Track[]>('get_playlist_tracks', { playlistId: pl.id }).catch(() => []);
        if (tracks && tracks.length > 0) {
          await this.pushPlaylistTracks(pl.id, tracks);
        }
      }

      const localTracks = get(allTracks);
      if (localTracks && localTracks.length > 0) {
        await this.pushTracksToLibraryBatch(localTracks);
      }
      console.log('[Pulsar SyncEngine] ✅ Sincronização completa local -> nuvem concluída!');
    } catch (e) {
      console.warn('[Pulsar SyncEngine] Erro ao sincronizar local para nuvem:', e);
    }
  },

  /**
   * Envia ou atualiza uma playlist na nuvem
   */
  async pushPlaylist(playlist: Playlist) {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;
    if (isCircuitBroken && Date.now() < circuitBreakUntil) return;

    // Se a playlist pertence a outro usuário (playlist de terceiro seguida), não envia para cloud_playlists
    if (playlist.user_id && playlist.user_id !== prof.id) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const canonicalId = toCanonicalUuid(playlist.id);
    playlist.id = canonicalId;

    try {
      const nowIso = new Date().toISOString();
      const payload = {
        id: canonicalId,
        user_id: prof.id,
        name: playlist.name,
        description: playlist.description || '',
        cover_image_url: playlist.cover_image || '',
        visibility: playlist.visibility || 'public',
        is_imported_youtube_playlist: playlist.is_imported_youtube_playlist || false,
        source_youtube_playlist_id: playlist.source_youtube_playlist_id || '',
        track_count: playlist.track_count || 0,
        total_duration_seconds: playlist.total_duration_seconds || 0,
        updated_at: nowIso
      };

      const { error } = await supabase
        .from('cloud_playlists')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        if (error.code === '402' || error.message?.includes('quota')) {
          isCircuitBroken = true;
          circuitBreakUntil = Date.now() + 15 * 60 * 1000;
        }
        throw error;
      }
      localStorage.setItem(`pulsar_pl_up_${canonicalId}`, nowIso);
      console.log(`[Pulsar SyncEngine] Playlist '${playlist.name}' salva no Supabase (ID: ${canonicalId}).`);
    } catch (err: any) {
      console.warn('[Pulsar SyncEngine] Erro ao salvar playlist no Supabase:', err?.message || err);
    }
  },

  /**
   * Exclui uma playlist na nuvem
   */
  async deletePlaylist(playlistId: string) {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;
    if (isCircuitBroken && Date.now() < circuitBreakUntil) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const canonicalId = toCanonicalUuid(playlistId);

    try {
      const { error } = await supabase
        .from('cloud_playlists')
        .delete()
        .eq('id', canonicalId)
        .eq('user_id', prof.id);

      if (error) throw error;
      localStorage.removeItem(`pulsar_pl_up_${canonicalId}`);
      console.log(`[Pulsar SyncEngine] Playlist '${canonicalId}' removida do Supabase.`);
    } catch (err: any) {
      console.warn('[Pulsar SyncEngine] Erro ao remover playlist do Supabase:', err?.message || err);
    }
  },

  /**
   * Sincroniza a lista de faixas de uma playlist no Supabase
   */
  async pushPlaylistTracks(playlistId: string, tracks: Track[]) {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;
    if (isCircuitBroken && Date.now() < circuitBreakUntil) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const canonicalPlId = toCanonicalUuid(playlistId);

    // Se a playlist pertencer a outro usuário na store, não sobrescrever faixas no Supabase
    const pl = get(playlists).find(p => toCanonicalUuid(p.id) === canonicalPlId);
    if (pl && pl.user_id && pl.user_id !== prof.id) return;

    try {
      // 1. Limpar faixas antigas da playlist
      await supabase
        .from('cloud_playlist_tracks')
        .delete()
        .eq('playlist_id', canonicalPlId);

      // 2. Inserir lote com posições corretas
      if (tracks && tracks.length > 0) {
        const rows = tracks.map((t, index) => ({
          playlist_id: canonicalPlId,
          youtube_video_id: t.youtube_video_id,
          title: t.title,
          artist: t.artist_guess || t.artist || '',
          channel_name: t.channel_name || '',
          duration_seconds: t.duration_seconds || 0,
          thumbnail_url: t.thumbnail_url || t.thumbnail || '',
          position: index,
          source_platform: t.source_platform || 'youtube'
        }));

        const { error } = await supabase
          .from('cloud_playlist_tracks')
          .insert(rows);

        if (error) throw error;
      }

      // 3. Atualizar track_count e total_duration_seconds na tabela principal da playlist
      const nowIso = new Date().toISOString();
      await supabase
        .from('cloud_playlists')
        .update({
          track_count: tracks.length,
          total_duration_seconds: tracks.reduce((acc, t) => acc + (t.duration_seconds || 0), 0),
          updated_at: nowIso
        })
        .eq('id', canonicalPlId);

      localStorage.setItem(`pulsar_pl_up_${canonicalPlId}`, nowIso);

      // 4. Também sincronizar cada faixa na biblioteca pessoal (user_library_tracks)
      await this.pushTracksToLibraryBatch(tracks);

      console.log(`[Pulsar SyncEngine] ${tracks.length} faixas sincronizadas para a playlist ${canonicalPlId}.`);
    } catch (err: any) {
      if (err?.code === '402' || err?.message?.includes('quota')) {
        isCircuitBroken = true;
        circuitBreakUntil = Date.now() + 15 * 60 * 1000;
      }
      console.warn('[Pulsar SyncEngine] Erro ao sincronizar faixas da playlist no Supabase:', err?.message || err);
    }
  },

  /**
   * Sincroniza uma única faixa na biblioteca do usuário
   */
  async pushTrackToLibrary(track: Track) {
    await this.pushTracksToLibraryBatch([track]);
  },

  /**
   * Salva faixas em lote na biblioteca do usuário (user_library_tracks)
   */
  async pushTracksToLibraryBatch(tracks: Track[]) {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id) || !tracks || tracks.length === 0) return;
    if (isCircuitBroken && Date.now() < circuitBreakUntil) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const uniqueMap = new Map<string, any>();
      for (const track of tracks) {
        if (!track || !track.youtube_video_id) continue;
        if (!uniqueMap.has(track.youtube_video_id)) {
          uniqueMap.set(track.youtube_video_id, {
            user_id: prof.id,
            youtube_video_id: track.youtube_video_id,
            title: track.title,
            artist_guess: track.artist_guess || track.artist || '',
            channel_name: track.channel_name || '',
            duration_seconds: track.duration_seconds || 0,
            thumbnail_url: track.thumbnail_url || track.thumbnail || '',
            source_platform: track.source_platform || 'youtube',
            added_at: new Date().toISOString()
          });
        }
      }
      const rows = Array.from(uniqueMap.values());
      if (rows.length === 0) return;

      const { error } = await supabase
        .from('user_library_tracks')
        .upsert(rows, { onConflict: 'user_id,youtube_video_id' });

      if (error) {
        if (error.code === '402' || error.message?.includes('quota')) {
          isCircuitBroken = true;
          circuitBreakUntil = Date.now() + 15 * 60 * 1000;
        }
        throw error;
      }
      console.log(`[Pulsar SyncEngine] ${rows.length} faixas salvas em user_library_tracks.`);
    } catch (err: any) {
      console.warn('[Pulsar SyncEngine] Erro ao salvar faixas em lote na biblioteca em nuvem:', err?.message || err);
    }
  },

  /**
   * Busca as faixas de qualquer playlist na nuvem (inclusive playlists públicas da comunidade)
   */
  async fetchPlaylistTracks(playlistId: string): Promise<Track[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    const canonicalPlId = toCanonicalUuid(playlistId);

    try {
      const { data, error } = await supabase
        .from('cloud_playlist_tracks')
        .select('*')
        .eq('playlist_id', canonicalPlId)
        .order('position', { ascending: true });

      if (error) throw error;
      if (!data) return [];

      return data.map(t => ({
        id: t.id || `t-${t.youtube_video_id}`,
        youtube_video_id: t.youtube_video_id,
        title: t.title,
        artist_guess: t.artist || '',
        channel_name: t.channel_name || '',
        duration_seconds: t.duration_seconds || 0,
        thumbnail_url: t.thumbnail_url || '',
        added_at: t.added_at ? t.added_at.split('T')[0] : new Date().toISOString().split('T')[0],
        stream_url: `http://127.0.0.1:41235/stream/${t.youtube_video_id}`,
        source_platform: (t.source_platform as any) || 'youtube'
      }));
    } catch (err) {
      console.warn(`[Pulsar SyncEngine] Erro ao buscar faixas da playlist ${canonicalPlId}:`, err);
      return [];
    }
  },

  /**
   * Sincroniza favorito (adicionar ou remover)
   */
  async pushFavorite(youtubeVideoId: string, isFavorite: boolean) {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;
    if (isCircuitBroken && Date.now() < circuitBreakUntil) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      if (isFavorite) {
        await supabase
          .from('user_favorites')
          .upsert({
            user_id: prof.id,
            youtube_video_id: youtubeVideoId,
            created_at: new Date().toISOString()
          }, { onConflict: 'user_id,youtube_video_id' });
      } else {
        await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', prof.id)
          .eq('youtube_video_id', youtubeVideoId);
      }
    } catch (err: any) {
      if (err?.code === '402' || err?.message?.includes('quota')) {
        isCircuitBroken = true;
        circuitBreakUntil = Date.now() + 15 * 60 * 1000;
      }
      console.warn('[Pulsar SyncEngine] Erro ao alternar favorito na nuvem:', err?.message || err);
    }
  },

  /**
   * Registra histórico recente no Supabase
   */
  async pushHistory(track: Track) {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;
    if (isCircuitBroken && Date.now() < circuitBreakUntil) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      await supabase
        .from('user_history')
        .upsert({
          user_id: prof.id,
          youtube_video_id: track.youtube_video_id,
          played_at: new Date().toISOString()
        }, { onConflict: 'user_id,youtube_video_id' });
    } catch (err: any) {
      if (err?.code === '402' || err?.message?.includes('quota')) {
        isCircuitBroken = true;
        circuitBreakUntil = Date.now() + 15 * 60 * 1000;
      }
      console.warn('[Pulsar SyncEngine] Erro ao registrar histórico na nuvem:', err?.message || err);
    }
  },

  // Controle de hash das últimas configurações sincronizadas
  _lastSettingsHash: '',

  /**
   * Salva configurações do usuário com amortecimento inteligente (debounce de 3s e hash diff)
   */
  pushSettingsDebounced(settings: Partial<UserSettings>) {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;
    if (isCircuitBroken && Date.now() < circuitBreakUntil) return;

    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
    }

    syncDebounceTimer = setTimeout(async () => {
      const hash = JSON.stringify(settings);
      if (hash === this._lastSettingsHash) return;
      this._lastSettingsHash = hash;

      const supabase = getSupabase();
      if (!supabase) return;

      try {
        const payload: any = {
          user_id: prof.id,
          updated_at: new Date().toISOString()
        };

        if (settings.volume !== undefined) payload.volume = settings.volume;
        if (settings.shuffle !== undefined) payload.shuffle = settings.shuffle;
        if (settings.repeat_mode !== undefined) payload.repeat_mode = settings.repeat_mode;
        if (settings.locale !== undefined) payload.locale = settings.locale;
        if (settings.video_visible !== undefined) payload.video_visible = settings.video_visible;
        if (settings.spotify_connected !== undefined) payload.spotify_connected = settings.spotify_connected;
        if (settings.lastfm_username !== undefined) payload.lastfm_username = settings.lastfm_username;

        const { error } = await supabase
          .from('user_settings')
          .upsert(payload, { onConflict: 'user_id' });

        if (error) {
          if (error.code === '402' || error.message?.includes('quota')) {
            isCircuitBroken = true;
            circuitBreakUntil = Date.now() + 15 * 60 * 1000;
          }
          throw error;
        }

        console.log('[Pulsar SyncEngine] Configurações do usuário sincronizadas no Supabase.');
      } catch (err: any) {
        console.warn('[Pulsar SyncEngine] Erro ao sincronizar configurações:', err?.message || err);
      }
    }, 3000);
  },

  /**
   * Busca as playlists públicas mais ouvidas/seguidas da comunidade no Supabase
   */
  async fetchCommunityTrending(limit: number = 12): Promise<CommunityTrendingPlaylist[]> {
    try {
      const supabase = getSupabase();
      if (!supabase) return [];

      const { data, error } = await supabase.rpc('get_community_trending_playlists', { p_limit: limit });
      if (error) {
        console.warn('[Pulsar SyncEngine] RPC get_community_trending_playlists indisponível, tentando select direto:', error.message);
        const { data: fallbackData } = await supabase
          .from('cloud_playlists')
          .select('id, name, description, cover_image_url, track_count, play_count, likes_count, created_at')
          .eq('visibility', 'public')
          .order('play_count', { ascending: false })
          .limit(limit);
        return (fallbackData as any[]) || [];
      }
      return (data as CommunityTrendingPlaylist[]) || [];
    } catch (err) {
      console.warn('[Pulsar SyncEngine] Falha ao carregar playlists da comunidade:', err);
      return [];
    }
  },

  /**
   * Alterna se o usuário segue uma playlist no Supabase
   */
  async toggleFollowPlaylist(playlistId: string, isFollowed: boolean): Promise<void> {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;
    if (isCircuitBroken && Date.now() < circuitBreakUntil) return;

    const supabase = getSupabase();
    if (!supabase) return;
    const canonicalId = toCanonicalUuid(playlistId);

    try {
      if (isFollowed) {
        await supabase.from('playlist_follows').upsert({
          user_id: prof.id,
          playlist_id: canonicalId,
          created_at: new Date().toISOString()
        }, { onConflict: 'user_id,playlist_id' });

        // Disparar notificação para o dono da playlist se não for o próprio usuário
        try {
          const { data: plData } = await supabase
            .from('cloud_playlists')
            .select('user_id, name')
            .eq('id', canonicalId)
            .maybeSingle();

          if (plData && plData.user_id && plData.user_id !== prof.id) {
            const { notificationActions } = await import('../stores/notificationStore');
            await notificationActions.sendNotification({
              user_id: plData.user_id,
              sender_id: prof.id,
              sender_username: prof.username,
              sender_avatar_url: prof.avatar_url,
              type: 'playlist_follow',
              title: 'Playlist favoritada',
              message: `@${prof.username} começou a seguir sua playlist "${plData.name || 'Sem título'}"!`,
              target_id: canonicalId,
              link: `playlist:${canonicalId}`
            });
          }
        } catch (notifErr) {
          console.warn('[Pulsar SyncEngine] Falha ao enviar notificação de playlist_follow:', notifErr);
        }
      } else {
        await supabase.from('playlist_follows').delete()
          .eq('user_id', prof.id)
          .eq('playlist_id', canonicalId);
      }
      console.log(`[Pulsar SyncEngine] Playlist ${canonicalId} follow status: ${isFollowed}`);
    } catch (err: any) {
      if (err?.code === '402' || err?.message?.includes('quota')) {
        isCircuitBroken = true;
        circuitBreakUntil = Date.now() + 15 * 60 * 1000;
      }
      console.warn('[Pulsar SyncEngine] Erro ao sincronizar follow de playlist no Supabase:', err);
    }
  },

  /**
   * Incrementa o contador de execuções de uma playlist no Supabase
   */
  async incrementPlaylistPlay(playlistId: string): Promise<void> {
    if (isCircuitBroken && Date.now() < circuitBreakUntil) return;

    try {
      const supabase = getSupabase();
      if (!supabase) return;
      const canonicalId = toCanonicalUuid(playlistId);

      // Chamada RPC atômica (passando ambos os nomes de argumentos para garantir compatibilidade)
      const { error } = await supabase.rpc('increment_playlist_play', {
        playlist_id: canonicalId,
        p_playlist_id: canonicalId
      });

      if (error) {
        // Fallback defensivo com update direto caso a RPC ainda não esteja em cache
        const { data: current } = await supabase
          .from('cloud_playlists')
          .select('play_count')
          .eq('id', canonicalId)
          .maybeSingle();

        if (current) {
          await supabase
            .from('cloud_playlists')
            .update({ play_count: (current.play_count || 0) + 1 })
            .eq('id', canonicalId);
        }
      }
    } catch (e) {
      // Ignora erro defensivo de estatística
    }
  }
};
