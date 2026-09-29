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
import { allTracks, playlists, favoriteTrackIds, recentTracks, selectedPlaylistTracks } from '../stores/libraryStore';
import { volume, shuffle, repeatMode, isVideoVisible, lastFmUsername } from '../stores/playerStore';
import { currentLocale } from '../i18n';
import type { Track, Playlist, CloudSyncState, UserSettings, RepeatMode, CommunityTrendingPlaylist } from '../types';

export const cloudSyncState = writable<CloudSyncState>('idle');
export const lastSyncTimestamp = writable<Date | null>(null);
export const syncErrorMessage = writable<string | null>(null);

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let autoSyncIntervalTimer: ReturnType<typeof setInterval> | null = null;
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos de sincronização automática silenciosa

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
   * Inicia o ciclo de sincronização automática periódica e silenciosa em segundo plano (a cada 5 minutos)
   */
  startAutoSync(userId: string) {
    if (isGuestUser(userId)) return;
    this.stopAutoSync();
    console.log(`[Pulsar SyncEngine] Sincronização automática em segundo plano ativada (a cada 5 min) para: ${userId}`);
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

  /**
   * Puxa todos os dados do Supabase para o usuário logado e hidrata o SQLite local e as stores reativas.
   * Se houver dados locais não presentes na nuvem, efetua sincronização bidirecional.
   */
  async hydrateFromCloud(userId: string) {
    if (isGuestUser(userId)) {
      cloudSyncState.set('idle');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      cloudSyncState.set('offline');
      return;
    }

    cloudSyncState.set('syncing');
    syncErrorMessage.set(null);

    try {
      console.log(`[Pulsar SyncEngine] Iniciando hidratação em nuvem para user: ${userId}...`);

      // 1. Carregar playlists na nuvem
      // 1. Carregar playlists na nuvem criadas pelo usuário
      const { data: cloudPlaylists, error: plErr } = await supabase
        .from('cloud_playlists')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (plErr) throw plErr;

      // 1.1 Buscar IDs de playlists seguidas pelo usuário
      let followedPlIds: string[] = [];
      try {
        const { data: followedData } = await supabase
          .from('playlist_follows')
          .select('playlist_id')
          .eq('user_id', userId);
        if (followedData) {
          followedPlIds = followedData.map(f => f.playlist_id);
        }
      } catch (err) {
        console.warn('[Pulsar SyncEngine] Falha ao consultar playlist_follows:', err);
      }
      const followedIdSet = new Set(followedPlIds);

      // 2. Se há playlists na nuvem, buscar todas as faixas associadas
      const plList = cloudPlaylists || [];
      const plIds = plList.map(p => p.id);

      let cloudTracksByPlaylist: Record<string, any[]> = {};
      if (plIds.length > 0) {
        const { data: allPlaylistTracks, error: trkErr } = await supabase
          .from('cloud_playlist_tracks')
          .select('*')
          .in('playlist_id', plIds)
          .order('position', { ascending: true });

        if (!trkErr && allPlaylistTracks) {
          for (const t of allPlaylistTracks) {
            if (!cloudTracksByPlaylist[t.playlist_id]) {
              cloudTracksByPlaylist[t.playlist_id] = [];
            }
            cloudTracksByPlaylist[t.playlist_id].push(t);
          }
        }
      }

      // 2.1 Buscar playlists seguidas de terceiros
      const externalFollowedIds = followedPlIds.filter(id => !plIds.includes(id));
      let externalFollowedList: any[] = [];
      if (externalFollowedIds.length > 0) {
        try {
          const { data: extPls } = await supabase
            .from('cloud_playlists')
            .select(`
              *,
              profiles:user_id (
                username,
                display_name,
                avatar_url
              )
            `)
            .in('id', externalFollowedIds);
          if (extPls) {
            externalFollowedList = extPls;
          }
        } catch {}
      }

      // 3. Carregar faixas da biblioteca pessoal (user_library_tracks)
      const { data: cloudLibTracks } = await supabase
        .from('user_library_tracks')
        .select('*')
        .eq('user_id', userId)
        .order('added_at', { ascending: false });

      // 4. Carregar favoritos (user_favorites)
      const { data: cloudFavorites } = await supabase
        .from('user_favorites')
        .select('youtube_video_id')
        .eq('user_id', userId);

      // 5. Carregar histórico recente (user_history)
      const { data: cloudHistory } = await supabase
        .from('user_history')
        .select('*')
        .eq('user_id', userId)
        .order('played_at', { ascending: false })
        .limit(40);

      // 6. Carregar configurações do usuário (user_settings)
      const { data: cloudSettings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // ==============================================================================
      // PROCESSAMENTO & HIDRATAÇÃO LOCAL NO SQLITE E STORES
      // ==============================================================================

      // A. Hidratação de Playlists
      const hydratedPlaylists: Playlist[] = [];

      if (plList.length > 0) {
        for (const cp of plList) {
          const tracksForPl = cloudTracksByPlaylist[cp.id] || [];
          const totalDuration = tracksForPl.reduce((acc, t) => acc + (t.duration_seconds || 0), 0);
          const prof = (cp as any).profiles;

          const playlistObj: Playlist = {
            id: cp.id,
            name: cp.name,
            description: cp.description || '',
            cover_image: cp.cover_image_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
            created_at: cp.created_at ? cp.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            is_imported_youtube_playlist: cp.is_imported_youtube_playlist || false,
            source_youtube_playlist_id: cp.source_youtube_playlist_id || null,
            track_count: tracksForPl.length,
            total_duration_seconds: totalDuration,
            visibility: cp.visibility || 'public',
            user_id: cp.user_id,
            owner_name: prof?.display_name || prof?.username || cp.owner_name || null,
            owner_username: prof?.username || cp.owner_username || null,
            owner_avatar_url: prof?.avatar_url || cp.owner_avatar_url || null,
            is_followed: followedIdSet.has(cp.id),
            play_count: cp.play_count || 0
          };

          // Salvar/atualizar no SQLite local
          try {
            await safeInvoke('upsert_playlist', { playlist: playlistObj });
            
            // Salvar cada faixa no SQLite e vincular à playlist
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
          } catch (e) {
            console.warn(`[Pulsar SyncEngine] Fallback ao persistir playlist ${cp.name} no SQLite:`, e);
          }

          hydratedPlaylists.push(playlistObj);
        }
      }

      // Hidratar playlists seguidas de outros usuários
      if (externalFollowedList.length > 0) {
        for (const fp of externalFollowedList) {
          const prof = (fp as any).profiles;
          const fpObj: Playlist = {
            id: fp.id,
            name: fp.name,
            description: fp.description || '',
            cover_image: fp.cover_image_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
            created_at: fp.created_at ? fp.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            is_imported_youtube_playlist: fp.is_imported_youtube_playlist || false,
            source_youtube_playlist_id: fp.source_youtube_playlist_id || null,
            track_count: fp.track_count || 0,
            total_duration_seconds: fp.total_duration_seconds || 0,
            visibility: fp.visibility || 'public',
            user_id: fp.user_id,
            owner_name: prof?.display_name || prof?.username || fp.owner_name || null,
            owner_username: prof?.username || fp.owner_username || null,
            owner_avatar_url: prof?.avatar_url || fp.owner_avatar_url || null,
            is_followed: true,
            play_count: fp.play_count || 0
          };
          try {
            await safeInvoke('upsert_playlist', { playlist: fpObj });
          } catch (e) {
            console.warn('[Pulsar SyncEngine] Falha ao persistir playlist seguida no SQLite:', e);
          }
          hydratedPlaylists.push(fpObj);
        }
      }

      // Sincronizar playlists locais não presentes na nuvem (bidirecional e seguro)
      const cloudPlIdSet = new Set(plList.map(p => toCanonicalUuid(p.id)));
      const localPlaylists = get(playlists);
      for (const lp of localPlaylists) {
        const canonicalLpId = toCanonicalUuid(lp.id);

        // Se já está na nuvem deste usuário ou nas seguidas, pula
        if (cloudPlIdSet.has(canonicalLpId) || followedIdSet.has(canonicalLpId)) {
          continue;
        }

        // Se a playlist pertence a outro usuário no PC e NÃO é seguida, isola completamente
        if (lp.user_id && lp.user_id !== userId && !isGuestUser(lp.user_id)) {
          continue;
        }

        // Playlist starter default
        if (lp.id.startsWith('a0000000')) {
          hydratedPlaylists.push(lp);
          continue;
        }

        // Se a playlist local está sem dono (legada), verifica se pertence a outro usuário na nuvem
        try {
          const { data: extCloud } = await supabase
            .from('cloud_playlists')
            .select('user_id, name, profiles:user_id(username, display_name, avatar_url)')
            .eq('id', canonicalLpId)
            .maybeSingle();

          if (extCloud && extCloud.user_id && extCloud.user_id !== userId) {
            // Essa playlist é de outra conta! Atualiza o SQLite local com o autor real
            const prof = (extCloud as any).profiles;
            const updatedLp = {
              ...lp,
              user_id: extCloud.user_id,
              owner_name: prof?.display_name || prof?.username || null,
              owner_username: prof?.username || null,
              owner_avatar_url: prof?.avatar_url || null,
              is_followed: false
            };
            await safeInvoke('upsert_playlist', { playlist: updatedLp });
            // NÃO adiciona à biblioteca do usuário atual
            continue;
          }
        } catch {}

        // Se é realmente uma playlist nova criada localmente pelo usuário atual
        console.log(`[Pulsar SyncEngine] Enviando playlist local nova '${lp.name}' para a nuvem...`);
        lp.id = canonicalLpId;
        lp.user_id = userId;
        const currentProf = get(currentProfile);
        lp.owner_name = currentProf?.display_name || currentProf?.username || 'Você';
        lp.owner_username = currentProf?.username;
        lp.owner_avatar_url = currentProf?.avatar_url;
        await this.pushPlaylist(lp);
        const tracks = await safeInvoke<Track[]>('get_playlist_tracks', { playlistId: lp.id }).catch(() => []);
        if (tracks && tracks.length > 0) {
          await this.pushPlaylistTracks(canonicalLpId, tracks);
        }
        await safeInvoke('upsert_playlist', { playlist: lp });
        hydratedPlaylists.push(lp);
      }

      if (hydratedPlaylists.length > 0) {
        playlists.set(hydratedPlaylists);
      }

      // B. Hidratação de Faixas da Biblioteca (allTracks)
      if (cloudLibTracks && cloudLibTracks.length > 0) {
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

      // Garantir que faixas locais existentes também sejam enviadas para a nuvem
      const localTracks = get(allTracks);
      if (localTracks && localTracks.length > 0) {
        await this.pushTracksToLibraryBatch(localTracks);
      }

      // C. Hidratação de Favoritos
      if (cloudFavorites && cloudFavorites.length > 0) {
        const favVideoIds = new Set(cloudFavorites.map(f => f.youtube_video_id));
        
        const currentTracks = get(allTracks);
        const favIdSet = new Set<string>();
        for (const t of currentTracks) {
          if (favVideoIds.has(t.youtube_video_id)) {
            favIdSet.add(t.id);
            await safeInvoke('toggle_favorite', { trackId: t.id, track: t }).catch(() => {});
          }
        }
        if (favIdSet.size > 0) {
          favoriteTrackIds.set(favIdSet);
        }
      }

      // D. Hidratação de Configurações do Usuário
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
        if (typeof cloudSettings.video_visible === 'boolean') {
          isVideoVisible.set(cloudSettings.video_visible);
        }
        if (cloudSettings.locale) {
          currentLocale.set(cloudSettings.locale as any);
        }
        if (cloudSettings.lastfm_username) {
          lastFmUsername.set(cloudSettings.lastfm_username);
        }
      }

      cloudSyncState.set('synced');
      lastSyncTimestamp.set(new Date());
      console.log(`[Pulsar SyncEngine] ✅ Hidratação em nuvem concluída com sucesso!`);
    } catch (err: any) {
      console.error('[Pulsar SyncEngine] ❌ Erro ao sincronizar da nuvem:', err);
      cloudSyncState.set('error');
      syncErrorMessage.set(err?.message || 'Falha na sincronização em nuvem');
    }
  },

  /**
   * Força a sincronização de todas as playlists, faixas e configurações locais para o Supabase
   */
  async syncAllLocalToCloud(): Promise<void> {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;

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

    const supabase = getSupabase();
    if (!supabase) return;

    const canonicalId = toCanonicalUuid(playlist.id);
    playlist.id = canonicalId;

    try {
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
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('cloud_playlists')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;
      console.log(`[Pulsar SyncEngine] Playlist '${playlist.name}' salva no Supabase (ID: ${canonicalId}).`);
    } catch (err) {
      console.warn('[Pulsar SyncEngine] Erro ao salvar playlist no Supabase:', err);
    }
  },

  /**
   * Exclui uma playlist na nuvem
   */
  async deletePlaylist(playlistId: string) {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;

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
      console.log(`[Pulsar SyncEngine] Playlist '${canonicalId}' removida do Supabase.`);
    } catch (err) {
      console.warn('[Pulsar SyncEngine] Erro ao remover playlist do Supabase:', err);
    }
  },

  /**
   * Sincroniza a lista de faixas de uma playlist no Supabase
   */
  async pushPlaylistTracks(playlistId: string, tracks: Track[]) {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const canonicalPlId = toCanonicalUuid(playlistId);

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
      await supabase
        .from('cloud_playlists')
        .update({
          track_count: tracks.length,
          total_duration_seconds: tracks.reduce((acc, t) => acc + (t.duration_seconds || 0), 0),
          updated_at: new Date().toISOString()
        })
        .eq('id', canonicalPlId);

      // 4. Também sincronizar cada faixa na biblioteca pessoal (user_library_tracks)
      await this.pushTracksToLibraryBatch(tracks);

      console.log(`[Pulsar SyncEngine] ${tracks.length} faixas sincronizadas para a playlist ${canonicalPlId}.`);
    } catch (err) {
      console.warn('[Pulsar SyncEngine] Erro ao sincronizar faixas da playlist no Supabase:', err);
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

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const rows = tracks.map(track => ({
        user_id: prof.id,
        youtube_video_id: track.youtube_video_id,
        title: track.title,
        artist_guess: track.artist_guess || track.artist || '',
        channel_name: track.channel_name || '',
        duration_seconds: track.duration_seconds || 0,
        thumbnail_url: track.thumbnail_url || track.thumbnail || '',
        source_platform: track.source_platform || 'youtube',
        added_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('user_library_tracks')
        .upsert(rows, { onConflict: 'user_id,youtube_video_id' });

      if (error) throw error;
      console.log(`[Pulsar SyncEngine] ${rows.length} faixas salvas em user_library_tracks.`);
    } catch (err) {
      console.warn('[Pulsar SyncEngine] Erro ao salvar faixas em lote na biblioteca em nuvem:', err);
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
    } catch (err) {
      console.warn('[Pulsar SyncEngine] Erro ao alternar favorito na nuvem:', err);
    }
  },

  /**
   * Registra histórico recente no Supabase
   */
  async pushHistory(track: Track) {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;

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
    } catch (err) {
      console.warn('[Pulsar SyncEngine] Erro ao registrar histórico na nuvem:', err);
    }
  },

  /**
   * Salva configurações do usuário com amortecimento (debounce de 800ms)
   */
  pushSettingsDebounced(settings: Partial<UserSettings>) {
    const prof = get(currentProfile);
    if (!prof || isGuestUser(prof.id)) return;

    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
    }

    syncDebounceTimer = setTimeout(async () => {
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

        await supabase
          .from('user_settings')
          .upsert(payload, { onConflict: 'user_id' });

        console.log('[Pulsar SyncEngine] Configurações do usuário sincronizadas no Supabase.');
      } catch (err) {
        console.warn('[Pulsar SyncEngine] Erro ao sincronizar configurações:', err);
      }
    }, 800);
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
            .select('user_id, title')
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
              message: `@${prof.username} começou a seguir sua playlist "${plData.title}"!`,
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
    } catch (err) {
      console.warn('[Pulsar SyncEngine] Erro ao sincronizar follow de playlist no Supabase:', err);
    }
  },

  /**
   * Incrementa o contador de execuções de uma playlist no Supabase
   */
  async incrementPlaylistPlay(playlistId: string): Promise<void> {
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
