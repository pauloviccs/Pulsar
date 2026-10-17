import { writable, get } from 'svelte/store';
import type { Track, RepeatMode, VideoPlayerAspectRatio, VideoPlayerScale, VideoQualityPreference, VideoFitMode } from '../types';
import { safeInvoke } from '../api/tauri';

export const currentTrack = writable<Track | null>(null);
export const isPlaying = writable<boolean>(false);
export const currentTime = writable<number>(0);
export const duration = writable<number>(0);
export const volume = writable<number>(0.85);
export const isMuted = writable<boolean>(false);
export const isBuffering = writable<boolean>(false);
export const seekRequest = writable<number | null>(null);

export const shuffle = writable<boolean>(false);
export const repeatMode = writable<RepeatMode>('none');

export const queue = writable<Track[]>([]);
export const queueIndex = writable<number>(-1);
export const activePlaylistId = writable<string | null>(null);

export const isNowPlayingOpen = writable<boolean>(false);
export const isQueueOpen = writable<boolean>(false);
export const isVideoVisible = writable<boolean>(
  typeof window !== 'undefined' ? localStorage.getItem('pulsar_video_visible') === 'true' : false
);
export const videoCaptions = writable<'off' | 'on'>(
  (typeof window !== 'undefined' && (localStorage.getItem('pulsar_video_captions') as 'off' | 'on')) || 'off'
);

// Configurações do Formato de Vídeo (Proporção, Tamanho de Monitor/TV, Qualidade e Enquadramento)
export const videoAspectRatio = writable<VideoPlayerAspectRatio>(
  (typeof window !== 'undefined' && (localStorage.getItem('pulsar_video_aspect') as VideoPlayerAspectRatio)) || '16:9'
);
export const videoScale = writable<VideoPlayerScale>(
  (typeof window !== 'undefined' && (localStorage.getItem('pulsar_video_scale') as VideoPlayerScale)) || 'compact'
);
export const videoQuality = writable<VideoQualityPreference>(
  (typeof window !== 'undefined' && (localStorage.getItem('pulsar_video_quality') as VideoQualityPreference)) || 'auto'
);
export const videoFit = writable<VideoFitMode>(
  (typeof window !== 'undefined' && (localStorage.getItem('pulsar_video_fit') as VideoFitMode)) || 'contain'
);
export const isNativeFullscreen = writable<boolean>(false);

// Mini Player State / Dynamic Island
export const isMiniPlayer = writable<boolean>(false);
export const isMiniPlayerVideo = writable<boolean>(false);
export const hideDynamicIslandOnMinimize = writable<boolean>(
  typeof window !== 'undefined' ? localStorage.getItem('pulsar_hide_dynamic_island_on_minimize') === 'true' : false
);

// Configurações do Player
export const crossfadeSeconds = writable<number>(
  typeof window !== 'undefined' ? parseInt(localStorage.getItem('pulsar_crossfade') || '3') : 3
);
export const audioNormalization = writable<boolean>(
  typeof window !== 'undefined' ? localStorage.getItem('pulsar_normalization') === 'true' : false
);
export const minimizeToTray = writable<boolean>(
  typeof window !== 'undefined' ? localStorage.getItem('pulsar_minimize_tray') !== 'false' : true
);

// Sincronizar preferência do tray com o backend Rust na inicialização
if (typeof window !== 'undefined') {
  const initTray = localStorage.getItem('pulsar_minimize_tray') !== 'false';
  safeInvoke('set_minimize_to_tray', { enabled: initTray }).catch(() => {});
}
export const lastFmEnabled = writable<boolean>(
  typeof window !== 'undefined' ? localStorage.getItem('pulsar_lastfm_enabled') === 'true' : false
);
export const lastFmUsername = writable<string>(
  typeof window !== 'undefined' ? localStorage.getItem('pulsar_lastfm_user') || '' : ''
);

// Format seconds to mm:ss
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function notifyTrackAndPlaylistPlay(track: Track, playlistId?: string | null) {
  import('./libraryStore').then(({ libraryActions }) => {
    libraryActions.recordTrackPlayed(track.id);
    if (playlistId) {
      libraryActions.recordPlaylistPlay(playlistId);
    }
  }).catch(() => {});
}

// Variáveis de controle de transporte (Shuffle sem repetição e Duplo-clique no voltar)
let lastNextCall = 0;
let lastPrevClickTime = 0;
let nextShuffleIdx: number | null = null;

// Player Actions
export const playerActions = {
  playTrack(track: Track, tracksQueue?: Track[], playlistId?: string) {
    currentTrack.set(track);
    currentTime.set(0);
    duration.set(track.duration_seconds);
    isPlaying.set(true);

    if (playlistId !== undefined) {
      activePlaylistId.set(playlistId);
    }

    if (tracksQueue && tracksQueue.length > 0) {
      queue.set(tracksQueue);
      const idx = tracksQueue.findIndex(t => t.id === track.id);
      queueIndex.set(idx >= 0 ? idx : 0);
    } else {
      const q = get(queue);
      const idx = q.findIndex(t => t.id === track.id);
      if (idx === -1) {
        queue.set([...q, track]);
        queueIndex.set(q.length);
      } else {
        queueIndex.set(idx);
      }
    }

    notifyTrackAndPlaylistPlay(track, playlistId ?? get(activePlaylistId));
  },

  togglePlay() {
    isPlaying.update(p => !p);
  },

  seek(seconds: number) {
    currentTime.set(seconds);
    seekRequest.set(seconds);
  },

  next() {
    const now = Date.now();
    if (now - lastNextCall < 350) return;
    lastNextCall = now;

    const q = get(queue);
    const idx = get(queueIndex);
    const isShuffle = get(shuffle);
    const rep = get(repeatMode);

    if (q.length === 0) return;

    if (rep === 'one') {
      currentTime.set(0);
      seekRequest.set(0);
      isPlaying.set(true);
      return;
    }

    let nextIdx = idx + 1;
    if (isShuffle) {
      if (nextShuffleIdx !== null && nextShuffleIdx >= 0 && nextShuffleIdx < q.length && nextShuffleIdx !== idx) {
        nextIdx = nextShuffleIdx;
      } else {
        const candidates = q.map((_, i) => i).filter(i => i !== idx);
        nextIdx = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : 0;
      }
      nextShuffleIdx = null;
    } else if (nextIdx >= q.length) {
      if (rep === 'all') {
        nextIdx = 0;
      } else {
        isPlaying.set(false);
        return;
      }
    }

    queueIndex.set(nextIdx);
    const nextTrack = q[nextIdx];
    if (nextTrack) {
      currentTrack.set(nextTrack);
      currentTime.set(0);
      seekRequest.set(0);
      duration.set(nextTrack.duration_seconds);
      isPlaying.set(true);
      notifyTrackAndPlaylistPlay(nextTrack, get(activePlaylistId));
    }
  },

  peekNextTrack(): Track | null {
    const q = get(queue);
    const idx = get(queueIndex);
    const isShuffle = get(shuffle);
    const rep = get(repeatMode);

    if (q.length === 0) return null;
    if (rep === 'one') return get(currentTrack);

    let nextIdx = idx + 1;
    if (isShuffle) {
      if (nextShuffleIdx === null || nextShuffleIdx === idx || nextShuffleIdx >= q.length) {
        const candidates = q.map((_, i) => i).filter(i => i !== idx);
        nextShuffleIdx = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : 0;
      }
      nextIdx = nextShuffleIdx;
    } else if (nextIdx >= q.length) {
      if (rep === 'all') {
        nextIdx = 0;
      } else {
        return null;
      }
    }

    return q[nextIdx] || null;
  },

  previous() {
    const now = Date.now();
    const time = get(currentTime);
    const isDoubleBack = (now - lastPrevClickTime < 1500);
    lastPrevClickTime = now;

    // Se a música estiver além de 3 segundos E NÃO for um duplo-clique: reinicia a faixa atual do início (0:00)
    if (time > 3 && !isDoubleBack) {
      currentTime.set(0);
      seekRequest.set(0);
      return;
    }

    // Duplo-clique (< 1.5s) OU nos primeiros 3 segundos: volta para a faixa anterior
    const q = get(queue);
    const idx = get(queueIndex);
    if (q.length === 0) return;

    let prevIdx = idx - 1;
    if (prevIdx < 0) {
      prevIdx = q.length - 1;
    }

    queueIndex.set(prevIdx);
    const prevTrack = q[prevIdx];
    if (prevTrack) {
      currentTrack.set(prevTrack);
      currentTime.set(0);
      seekRequest.set(0);
      duration.set(prevTrack.duration_seconds);
      isPlaying.set(true);
      notifyTrackAndPlaylistPlay(prevTrack, get(activePlaylistId));
    }
  },

  setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    volume.set(clamped);
    if (clamped > 0) isMuted.set(false);
    import('../services/syncEngine').then(({ syncEngine }) => {
      syncEngine.pushSettingsDebounced({ volume: clamped });
    });
  },

  toggleMute() {
    isMuted.update(m => !m);
  },

  toggleShuffle() {
    shuffle.update(s => {
      const next = !s;
      import('../services/syncEngine').then(({ syncEngine }) => {
        syncEngine.pushSettingsDebounced({ shuffle: next });
      });
      return next;
    });
  },

  cycleRepeat() {
    repeatMode.update(r => {
      let next: RepeatMode = 'none';
      if (r === 'none') next = 'all';
      else if (r === 'all') next = 'one';
      else next = 'none';

      import('../services/syncEngine').then(({ syncEngine }) => {
        syncEngine.pushSettingsDebounced({ repeat_mode: next });
      });
      return next;
    });
  },

  toggleNowPlaying() {
    isNowPlayingOpen.update(open => !open);
  },

  toggleQueue() {
    isQueueOpen.update(open => !open);
  },

  toggleVideo() {
    isVideoVisible.update(v => {
      const next = !v;
      if (typeof window !== 'undefined') localStorage.setItem('pulsar_video_visible', next.toString());
      return next;
    });
  },

  setVideoVisible(visible: boolean) {
    if (typeof window !== 'undefined') localStorage.setItem('pulsar_video_visible', visible.toString());
    isVideoVisible.set(visible);
  },

  toggleVideoCaptions() {
    videoCaptions.update(c => {
      const next = c === 'on' ? 'off' : 'on';
      if (typeof window !== 'undefined') localStorage.setItem('pulsar_video_captions', next);
      return next;
    });
  },

  setVideoCaptions(mode: 'off' | 'on') {
    if (typeof window !== 'undefined') localStorage.setItem('pulsar_video_captions', mode);
    videoCaptions.set(mode);
  },

  async toggleMiniPlayer(enable?: boolean, videoMode?: boolean) {
    const current = get(isMiniPlayer);
    const nextState = enable !== undefined ? enable : !current;
    isMiniPlayer.set(nextState);

    const isVid = videoMode !== undefined ? videoMode : get(isMiniPlayerVideo);
    if (videoMode !== undefined) {
      isMiniPlayerVideo.set(videoMode);
    }

    try {
      await safeInvoke('toggle_mini_player', { enable: nextState, videoMode: isVid });
    } catch (e) {
      console.warn('[Pulsar MiniPlayer] Erro ao redimensionar janela:', e);
    }
  },

  async toggleMiniPlayerVideo() {
    const nextVid = !get(isMiniPlayerVideo);
    isMiniPlayerVideo.set(nextVid);
    if (get(isMiniPlayer)) {
      try {
        await safeInvoke('toggle_mini_player', { enable: true, videoMode: nextVid });
      } catch (e) {
        console.warn('[Pulsar MiniPlayer] Erro ao ajustar tamanho do vídeo:', e);
      }
    }
  },

  async setHideDynamicIslandOnMinimize(hide: boolean) {
    hideDynamicIslandOnMinimize.set(hide);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pulsar_hide_dynamic_island_on_minimize', hide.toString());
    }
    try {
      await safeInvoke('set_hide_dynamic_island', { hide });
    } catch {}
  },

  async initDynamicIslandSettings() {
    try {
      const isHidden = await safeInvoke<boolean>('get_hide_dynamic_island');
      if (typeof isHidden === 'boolean') {
        hideDynamicIslandOnMinimize.set(isHidden);
        if (typeof window !== 'undefined') {
          localStorage.setItem('pulsar_hide_dynamic_island_on_minimize', isHidden.toString());
        }
      }
    } catch {}
  },

  addToQueue(track: Track) {
    queue.update(q => [...q, track]);
  },

  removeFromQueue(index: number) {
    queue.update(q => q.filter((_, i) => i !== index));
  },

  setCrossfade(sec: number) {
    const clamped = Math.max(0, Math.min(12, sec));
    crossfadeSeconds.set(clamped);
    if (typeof window !== 'undefined') localStorage.setItem('pulsar_crossfade', clamped.toString());
  },

  toggleNormalization() {
    audioNormalization.update(v => {
      const next = !v;
      if (typeof window !== 'undefined') localStorage.setItem('pulsar_normalization', next.toString());
      return next;
    });
  },

  toggleMinimizeToTray() {
    minimizeToTray.update(v => {
      const next = !v;
      if (typeof window !== 'undefined') localStorage.setItem('pulsar_minimize_tray', next.toString());
      safeInvoke('set_minimize_to_tray', { enabled: next }).catch(() => {});
      return next;
    });
  },

  setLastFm(enabled: boolean, user: string) {
    lastFmEnabled.set(enabled);
    lastFmUsername.set(user);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pulsar_lastfm_enabled', enabled.toString());
      localStorage.setItem('pulsar_lastfm_user', user);
    }
  },

  setVideoAspectRatio(ratio: VideoPlayerAspectRatio) {
    videoAspectRatio.set(ratio);
    if (typeof window !== 'undefined') localStorage.setItem('pulsar_video_aspect', ratio);
  },

  setVideoScale(scale: VideoPlayerScale) {
    videoScale.set(scale);
    if (typeof window !== 'undefined') localStorage.setItem('pulsar_video_scale', scale);
  },

  setVideoQuality(quality: VideoQualityPreference) {
    videoQuality.set(quality);
    if (typeof window !== 'undefined') localStorage.setItem('pulsar_video_quality', quality);
  },

  setVideoFit(fit: VideoFitMode) {
    videoFit.set(fit);
    if (typeof window !== 'undefined') localStorage.setItem('pulsar_video_fit', fit);
  },

  async toggleNativeFullscreen() {
    try {
      const isFs = await safeInvoke<boolean | null>('toggle_window_fullscreen');
      if (typeof isFs === 'boolean') {
        isNativeFullscreen.set(isFs);
        return;
      }
    } catch {
      // Fallback para Web / Preview
    }

    if (typeof document !== 'undefined') {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          isNativeFullscreen.set(true);
        } else {
          await document.exitFullscreen();
          isNativeFullscreen.set(false);
        }
      } catch (err) {
        console.warn('[Pulsar Fullscreen] Erro ao alternar tela cheia nativa:', err);
      }
    }
  }
};

