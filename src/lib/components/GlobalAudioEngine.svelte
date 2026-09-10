<script lang="ts">
  import { 
    currentTrack, 
    isPlaying, 
    currentTime, 
    duration, 
    volume, 
    isMuted, 
    isBuffering,
    seekRequest,
    shuffle, 
    repeatMode, 
    isVideoVisible,
    playerActions,
    crossfadeSeconds,
    audioNormalization,
    lastFmEnabled,
    lastFmUsername
  } from '../stores/playerStore';
  import { favoriteTrackIds, libraryActions } from '../stores/libraryStore';
  import { safeInvoke, safeListen } from '../api/tauri';
  import { lastFmService } from '../services/lastfm';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  let audioElement: HTMLAudioElement;
  let scrobbledCurrentTrackId = $state<string | null>(null);

  // Escutar ações dos controles de mídia nativos da barra de tarefas do Windows
  onMount(() => {
    let unlisten: (() => void) | undefined;

    safeListen<string>('taskbar-action', (event) => {
      switch (event.payload) {
        case 'play_pause':
          playerActions.togglePlay();
          break;
        case 'next':
          playerActions.next();
          break;
        case 'prev':
          playerActions.previous();
          break;
        case 'toggle_favorite': {
          const track = get(currentTrack);
          if (track) {
            libraryActions.toggleFavorite(track.id, track);
          }
          break;
        }
      }
    }).then((u) => {
      unlisten = u;
    });

    return () => {
      if (unlisten) unlisten();
    };
  });

  // Sincronizar estado da reprodução com a miniatura nativa da barra de tarefas do Windows
  $effect(() => {
    const playing = $isPlaying;
    const hasTrack = !!$currentTrack;
    const isFav = $currentTrack ? $favoriteTrackIds.has($currentTrack.id) : false;

    safeInvoke('update_taskbar_thumbnail', {
      isPlaying: playing,
      hasTrack,
      isFavorite: isFav,
    }).catch(() => {});
  });

  // Sincronizar faixa e stream URL com o elemento nativo de áudio
  $effect(() => {
    if (!audioElement || !$currentTrack) return;
    const targetUrl = $currentTrack.stream_url || `http://127.0.0.1:41235/stream/${$currentTrack.youtube_video_id}`;
    if (audioElement.src !== targetUrl) {
      audioElement.src = targetUrl;
      scrobbledCurrentTrackId = null;
      // Restaurar o volume nominal imediatamente para evitar faixa muda após crossfade
      const baseVol = $isMuted ? 0 : $volume;
      const normFactor = $audioNormalization ? 0.92 : 1.0;
      audioElement.volume = Math.max(0, Math.min(1, baseVol * normFactor));
      if ($isPlaying) {
        audioElement.play().catch(e => console.warn('[GlobalAudioEngine] Play aguardando buffer:', e));
        if ($lastFmEnabled) {
          const artist = $currentTrack.artist || $currentTrack.artist_guess || $currentTrack.channel_name || 'Artista Desconhecido';
          lastFmService.updateNowPlaying(artist, $currentTrack.title || 'Música Desconhecida');
        }
      }
    }
  });

  // Reagir a comandos externos de Seek (Scrubber do desktop, fullscreen ou mini-player)
  $effect(() => {
    if ($seekRequest !== null && audioElement) {
      const targetTime = $seekRequest;
      seekRequest.set(null);
      if (!isNaN(targetTime)) {
        audioElement.currentTime = targetTime;
      }
    }
  });

  // Controle de Play / Pause
  $effect(() => {
    if (!audioElement) return;
    if ($isPlaying) {
      audioElement.play().catch(err => {
        console.warn('[GlobalAudioEngine] Play interrompido ou aguardando:', err);
      });
    } else {
      audioElement.pause();
    }
  });

  // Controle de Volume / Mudo / Normalização
  $effect(() => {
    if (!audioElement) return;
    const baseVol = $isMuted ? 0 : $volume;
    const normFactor = $audioNormalization ? 0.92 : 1.0;
    audioElement.volume = Math.max(0, Math.min(1, baseVol * normFactor));
  });

  // Registrar reprodução recente no SQLite ao iniciar faixa
  $effect(() => {
    if ($currentTrack && $isPlaying) {
      libraryActions.recordTrackPlayed($currentTrack.id);
    }
  });

  // Salvar estado de reprodução persistente no SQLite a cada intervalo
  let saveTimer: any = null;
  $effect(() => {
    const trackId = $currentTrack?.id;
    const vol = $volume;
    const shuf = $shuffle;
    const rep = $repeatMode;
    const vid = $isVideoVisible;
    const pos = $currentTime;

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      safeInvoke('save_playback_state', {
        state: {
          current_track_id: trackId || null,
          current_playlist_id: null,
          position_seconds: pos || 0.0,
          volume: vol,
          shuffle: shuf,
          repeat_mode: rep,
          video_visible: vid,
        }
      }).catch(() => {});
    }, 1200);
  });

  function onAudioTimeUpdate() {
    if (!audioElement || isNaN(audioElement.currentTime)) return;
    const curTime = audioElement.currentTime;
    const dur = audioElement.duration;
    currentTime.set(curTime);

    // Crossfade inteligente estilo Spotify com fade-in e fade-out garantidos
    const crossfade = $crossfadeSeconds;
    const baseVol = $isMuted ? 0 : $volume;
    const normFactor = $audioNormalization ? 0.92 : 1.0;
    const targetNominalVolume = Math.max(0, Math.min(1, baseVol * normFactor));

    if (crossfade > 0 && dur > crossfade * 2) {
      const remaining = dur - curTime;
      if (remaining <= crossfade && remaining > 0) {
        // Fade-out nos últimos segundos da música atual
        const factor = Math.max(0, remaining / crossfade);
        audioElement.volume = targetNominalVolume * factor;
        if (remaining < 0.25) {
          playerActions.next();
        }
      } else if (curTime <= Math.min(crossfade, 2)) {
        // Fade-in suave no início da nova música
        const fadeInDuration = Math.min(crossfade, 2);
        const factor = Math.min(1, Math.max(0.1, curTime / fadeInDuration));
        audioElement.volume = targetNominalVolume * factor;
      } else {
        // Fora das janelas de transição, garantir volume nominal
        if (Math.abs(audioElement.volume - targetNominalVolume) > 0.02) {
          audioElement.volume = targetNominalVolume;
        }
      }
    } else {
      // Se o crossfade estiver desligado, garantir volume nominal
      if (Math.abs(audioElement.volume - targetNominalVolume) > 0.02) {
        audioElement.volume = targetNominalVolume;
      }
    }

    // Integração Scrobbler Last.fm Oficial (após 50% ou 30s da música ouvida)
    if ($lastFmEnabled && $currentTrack && scrobbledCurrentTrackId !== $currentTrack.id) {
      const trackDur = (dur && !isNaN(dur) && dur > 0) ? dur : ($currentTrack.duration_seconds || 60);
      const scrobbleThreshold = Math.min(30, trackDur * 0.5);
      if (curTime >= scrobbleThreshold) {
        scrobbledCurrentTrackId = $currentTrack.id;
        const artist = $currentTrack.artist || $currentTrack.artist_guess || $currentTrack.channel_name || 'Artista Desconhecido';
        const title = $currentTrack.title || 'Música Desconhecida';
        lastFmService.scrobble(artist, title);
      }
    }
  }

  function onAudioLoadedMetadata() {
    if (audioElement && !isNaN(audioElement.duration) && audioElement.duration > 0) {
      duration.set(audioElement.duration);
    }
  }

  function onAudioWaiting() {
    isBuffering.set(true);
  }

  function onAudioPlaying() {
    isBuffering.set(false);
  }

  function onAudioEnded() {
    playerActions.next();
  }
</script>

<!-- Tag de áudio real do navegador persistente em nível de aplicativo -->
<audio
  bind:this={audioElement}
  ontimeupdate={onAudioTimeUpdate}
  onloadedmetadata={onAudioLoadedMetadata}
  onwaiting={onAudioWaiting}
  onplaying={onAudioPlaying}
  onended={onAudioEnded}
  preload="auto"
  class="hidden"
></audio>
