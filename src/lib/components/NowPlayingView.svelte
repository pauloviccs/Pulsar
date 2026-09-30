<script lang="ts">
  import { 
    ChevronDown, 
    Play, 
    Pause, 
    SkipBack, 
    SkipForward, 
    Shuffle, 
    Repeat, 
    Repeat1, 
    Volume2, 
    VolumeX, 
    Heart, 
    Video, 
    ListOrdered, 
    Sparkles, 
    Image as ImageIcon,
    Minimize2 
  } from '@lucide/svelte';
  import { 
    currentTrack, 
    isPlaying, 
    currentTime, 
    duration, 
    volume, 
    isMuted, 
    shuffle, 
    repeatMode, 
    playerActions, 
    formatTime,
    isNowPlayingOpen,
    isVideoVisible,
    isQueueOpen,
    videoAspectRatio,
    videoScale,
    videoQuality,
    videoFit,
    isNativeFullscreen
  } from '../stores/playerStore';
  import { untrack, onMount } from 'svelte';
  import { favoriteTrackIds, libraryActions } from '../stores/libraryStore';
  import VideoFormatDropdown from './VideoFormatDropdown.svelte';
  import type { VideoQualityPreference } from '../types';

  let isDragging = $state(false);
  let dragTime = $state(0);
  let videoIframe = $state<HTMLIFrameElement>();
  let loadedVideoId = $state<string | null>(null);
  let iframeSrc = $state<string>('');
  let lastSyncTime = 0;

  const ytQualityMap: Record<VideoQualityPreference, string> = {
    '2160p': 'hd2160',
    '1440p': 'hd1440',
    '1080p': 'hd1080',
    '720p': 'hd720',
    'auto': 'default'
  };

  let mainWidthClass = $derived.by(() => {
    if (!$isVideoVisible) return 'max-w-xl';
    switch ($videoScale) {
      case 'compact': return 'max-w-xl';
      case 'monitor-24': return 'max-w-3xl';
      case 'monitor-32': return 'max-w-4xl';
      case 'ultrawide': return 'max-w-5xl';
      case 'tv-large': return 'max-w-[88vw]';
      default: return 'max-w-xl';
    }
  });

  let videoAspectClass = $derived.by(() => {
    switch ($videoAspectRatio) {
      case '16:9': return 'aspect-video';
      case '16:10': return 'aspect-[16/10]';
      case '19.5:9': return 'aspect-[19.5/9]';
      case '21:9': return 'aspect-[21/9]';
      case '32:9': return 'aspect-[32/9]';
      default: return 'aspect-video';
    }
  });

  let videoMaxHeightClass = $derived.by(() => {
    switch ($videoScale) {
      case 'compact': return 'max-h-[36vh] sm:max-h-[40vh]';
      case 'monitor-24': return 'max-h-[40vh] sm:max-h-[44vh]';
      case 'monitor-32': return 'max-h-[44vh] sm:max-h-[48vh]';
      case 'ultrawide': return 'max-h-[44vh] sm:max-h-[48vh]';
      case 'tv-large': return 'max-h-[48vh] sm:max-h-[52vh]';
      default: return 'max-h-[42vh]';
    }
  });

  let videoScaleClass = $derived.by(() => {
    if ($videoFit === 'contain') return 'scale-[1.01]';
    switch ($videoAspectRatio) {
      case '16:10': return 'scale-[1.10]';
      case '19.5:9': return 'scale-[1.22]';
      case '21:9': return 'scale-[1.32]';
      case '32:9': return 'scale-[1.78]';
      default: return 'scale-[1.01]';
    }
  });

  function sendIframeCommand(func: string, args: any[] = []) {
    if (videoIframe && videoIframe.contentWindow) {
      videoIframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    }
  }

  // Handshake ao carregar o iframe para ativar a API e forçar estado síncrono com áudio
  function handleIframeLoad() {
    if (!videoIframe || !videoIframe.contentWindow) return;
    videoIframe.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*');

    if (!$isPlaying) {
      sendIframeCommand('pauseVideo');
    } else {
      sendIframeCommand('playVideo');
      const cur = untrack(() => $currentTime);
      sendIframeCommand('seekTo', [cur, true]);
    }
  }

  // Ouvinte de mensagens da API do YouTube para sincronização de drift e contenção de reprodução fantasma
  function handleWindowMessage(e: MessageEvent) {
    if (!$isVideoVisible || !videoIframe) return;
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (!data) return;

      if (data.event === 'infoDelivery' && data.info) {
        const ytState = data.info.playerState;
        const ytTime = data.info.currentTime;

        // FIX 3: Se o áudio está pausado mas o YouTube reporta reprodução (1 = playing ou 3 = buffering)
        if (!$isPlaying && (ytState === 1 || ytState === 3)) {
          sendIframeCommand('pauseVideo');
          return;
        }

        // FIX 2: Sincronização contínua de buffer e eliminação de atraso
        if ($isPlaying && typeof ytTime === 'number' && !isDragging) {
          const audioTime = $currentTime;
          const drift = audioTime - ytTime;
          const now = Date.now();

          // Se houver defasagem maior que 300ms entre áudio e vídeo, ressincroniza com throttle de 1.2s
          if (Math.abs(drift) > 0.3 && (now - lastSyncTime > 1200)) {
            lastSyncTime = now;
            sendIframeCommand('seekTo', [Math.max(0, audioTime), true]);
          }
        }
      }
    } catch {}
  }

  onMount(() => {
    window.addEventListener('message', handleWindowMessage);
    return () => {
      window.removeEventListener('message', handleWindowMessage);
    };
  });

  $effect(() => {
    const track = $currentTrack;
    const isVisible = $isVideoVisible;
    const qPref = $videoQuality;
    const ytQuality = ytQualityMap[qPref] || 'default';
    const vqParam = ytQuality !== 'default' ? `&vq=${ytQuality}` : '';

    if (isVisible && track?.youtube_video_id) {
      if (loadedVideoId !== track.youtube_video_id) {
        loadedVideoId = track.youtube_video_id;
        const initialStart = untrack(() => Math.max(0, Math.floor($currentTime)));
        const autoplayParam = untrack(() => $isPlaying) ? 1 : 0;
        iframeSrc = `https://www.youtube-nocookie.com/embed/${track.youtube_video_id}?autoplay=${autoplayParam}&mute=1&controls=0&modestbranding=1&loop=1&playlist=${track.youtube_video_id}&enablejsapi=1&start=${initialStart}${vqParam}`;
      }
    } else if (!isVisible) {
      loadedVideoId = null;
      iframeSrc = '';
    }
  });

  $effect(() => {
    const qPref = $videoQuality;
    const ytQuality = ytQualityMap[qPref] || 'default';
    if ($isVideoVisible && videoIframe && iframeSrc) {
      sendIframeCommand('setPlaybackQualityRange', [ytQuality, ytQuality]);
      sendIframeCommand('setPlaybackQuality', [ytQuality]);
    }
  });

  $effect(() => {
    const playing = $isPlaying;
    if ($isVideoVisible && videoIframe && iframeSrc) {
      if (playing) {
        sendIframeCommand('playVideo');
        const cur = untrack(() => $currentTime);
        sendIframeCommand('seekTo', [cur, true]);
      } else {
        sendIframeCommand('pauseVideo');
      }
    }
  });

  // Heartbeat de verificação de tempo a cada 1 segundo enquanto o vídeo está ativo
  $effect(() => {
    if (!$isVideoVisible || !$isPlaying) return;

    const interval = setInterval(() => {
      if (videoIframe && videoIframe.contentWindow && $isPlaying && !isDragging) {
        videoIframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'getCurrentTime', args: [] }),
          '*'
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  });

  function handleSeekPointerDown() {
    isDragging = true;
    dragTime = $currentTime;
  }

  function handleSeekInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    dragTime = val;
  }

  function handleSeekChange(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    playerActions.seek(val);
    isDragging = false;
    lastSyncTime = Date.now();
    sendIframeCommand('seekTo', [val, true]);
  }

  function handleVolume(e: Event) {
    const target = e.target as HTMLInputElement;
    playerActions.setVolume(parseFloat(target.value));
  }
</script>

{#if $isNowPlayingOpen && $currentTrack}
  <div class="fixed inset-0 z-50 flex flex-col justify-between p-3 sm:p-5 md:p-6 bg-[#0B1020]/95 backdrop-blur-3xl text-[#F0F0F5] select-none overflow-hidden animate-[fade-in_0.3s_cubic-bezier(0.16,1,0.3,1)]">
    <!-- Fundo de iluminação dinâmica (Ambient Glow Coral & Teal) -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none -z-10 opacity-35">
      <div class="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-[#EF7D4B] blur-[160px] animate-pulse"></div>
      <div class="absolute -bottom-20 right-1/4 w-[550px] h-[550px] rounded-full bg-[#3093AA] blur-[180px]"></div>
    </div>

    <!-- Top Header com Z-Index 40 garantido sobre o conteúdo do player -->
    <header class="flex items-center justify-between z-40 shrink-0 relative">
      <div class="flex items-center gap-2">
        <button
          onclick={() => isNowPlayingOpen.set(false)}
          class="flex items-center gap-2 px-4 py-2 rounded-full lq-glass-pill text-xs font-semibold text-[#F0F0F5] hover:bg-white/[0.12] transition active:scale-95 cursor-pointer shadow-sm"
        >
          <ChevronDown class="w-4 h-4" />
          <span>Minimizar</span>
        </button>

        {#if $isNativeFullscreen}
          <button
            type="button"
            onclick={() => playerActions.toggleNativeFullscreen()}
            class="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#EF7D4B]/20 border border-[#EF7D4B]/50 text-[#EF7D4B] text-xs font-semibold hover:bg-[#EF7D4B]/30 transition active:scale-95 cursor-pointer shadow-sm"
            title="Sair da Tela Cheia Nativa (Esc)"
          >
            <Minimize2 class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Sair Tela Cheia</span>
          </button>
        {/if}
      </div>

      <span class="text-xs font-bold tracking-widest uppercase text-white/50">Reproduzindo Agora</span>

      <div class="flex items-center gap-2.5">
        <button
          onclick={() => playerActions.toggleVideo()}
          class="px-3.5 py-2 rounded-full lq-glass-pill transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold {$isVideoVisible ? 'bg-[#EF7D4B]/20 border-[#EF7D4B]/50 text-[#EF7D4B]' : 'text-white/70 hover:text-white'}"
          title="Alternar Modo Vídeo"
        >
          <Video class="w-4 h-4" />
          <span>{$isVideoVisible ? 'Modo Vídeo Ativo' : 'Modo Vídeo'}</span>
        </button>

        {#if $isVideoVisible}
          <VideoFormatDropdown />
        {/if}

        <button
          onclick={() => playerActions.toggleQueue()}
          class="p-2.5 rounded-full lq-glass-pill text-white/70 hover:text-white transition cursor-pointer"
          title="Ver Fila"
        >
          <ListOrdered class="w-4 h-4" />
        </button>
      </div>
    </header>

    <!-- Centro: Capa Grande OU Vídeo Real do YouTube Redimensionável -->
    <main class="w-full {mainWidthClass} mx-auto flex-1 flex flex-col items-center justify-center gap-2.5 sm:gap-4 z-10 py-1 min-h-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
      {#if $isVideoVisible}
        <!-- Player de Vídeo Real Redimensionável com Proporção Dinâmica -->
        <div class="relative {videoAspectClass} {videoMaxHeightClass} w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-black/90 border border-white/[0.16] bg-black group transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] shrink min-h-0 flex items-center justify-center">
          <iframe
            bind:this={videoIframe}
            src={iframeSrc}
            onload={handleIframeLoad}
            title="Vídeo oficial sincronizado"
            allow="autoplay; encrypted-media"
            class="w-full h-full border-0 pointer-events-none select-none transition-transform duration-500 ease-out {videoScaleClass}"
          ></iframe>

          <!-- Overlay Elegante no Topo com Badges de Vídeo, Formato e Qualidade -->
          <div class="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex items-center gap-2 pointer-events-none">
            <div class="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.12] flex items-center gap-1.5 text-[10px] font-semibold text-[#3093AA]">
              <span class="w-2 h-2 rounded-full bg-[#3093AA] animate-ping"></span>
              <span>Vídeo Sincronizado</span>
            </div>

            <div class="hidden sm:flex px-2 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.12] items-center gap-1 text-[10px] font-mono text-white/80">
              <span class="text-[#EF7D4B] font-semibold">{$videoAspectRatio}</span>
              <span class="text-white/40">•</span>
              <span class="text-[#3093AA] font-semibold">{$videoQuality.toUpperCase()}</span>
            </div>
          </div>

          <!-- Ações do Overlay no Rodapé do Vídeo -->
          <div class="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 flex items-center gap-2">
            <button
              onclick={() => playerActions.toggleVideo()}
              class="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/[0.12] text-[10px] sm:text-[11px] font-medium text-white/80 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <ImageIcon class="w-3.5 h-3.5" />
              <span>Voltar para Capa</span>
            </button>
          </div>
        </div>
      {:else}
        <!-- Capa do Álbum Estilo Apple Music Glass com Restrição Vertical -->
        <div class="relative aspect-square w-48 sm:w-64 md:w-76 max-h-[34vh] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-black/80 border border-white/[0.15] group animate-apple-spring shrink min-h-0">
          <img
            src={$currentTrack.thumbnail_url}
            alt={$currentTrack.title}
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
            <span class="text-[11px] text-white/80 font-medium">Capa de Alta Fidelidade</span>
          </div>
        </div>
      {/if}

      <!-- Bloco de Controles Centralizados com Proporção Perfeita (Apple TV Style) -->
      <div class="w-full max-w-xl sm:max-w-2xl mx-auto flex flex-col items-center gap-2 sm:gap-3 transition-all shrink-0">
        <!-- Título, Artista e Favoritar -->
        <div class="w-full flex items-center justify-between">
          <div class="flex flex-col min-w-0 pr-4">
            <h2 class="text-lg sm:text-xl md:text-2xl font-bold text-[#F0F0F5] truncate tracking-tight">{$currentTrack.title}</h2>
            <p class="text-xs sm:text-sm text-white/60 truncate font-medium">{$currentTrack.artist_guess || $currentTrack.channel_name}</p>
          </div>

          <button
            onclick={() => {
              if ($currentTrack) libraryActions.toggleFavorite($currentTrack.id, $currentTrack);
            }}
            class="p-2.5 sm:p-3 rounded-2xl lq-glass-frost hover:bg-white/[0.12] transition cursor-pointer text-white/50 shadow-md shrink-0"
            title="Favoritar"
          >
            <Heart class="w-5 h-5 {$favoriteTrackIds.has($currentTrack.id) ? 'fill-[#F3B044] text-[#F3B044]' : ''}" />
          </button>
        </div>

        <!-- Barra de Progresso Grande com Scrubbing Desacoplado -->
        <div class="w-full flex flex-col gap-1.5">
          <input
            type="range"
            min="0"
            max={$duration || 100}
            value={isDragging ? dragTime : $currentTime}
            onpointerdown={handleSeekPointerDown}
            oninput={handleSeekInput}
            onchange={handleSeekChange}
            class="w-full h-1.5 bg-white/[0.12] rounded-full appearance-none cursor-pointer accent-[#EF7D4B] transition"
          />
          <div class="flex justify-between text-[11px] font-mono text-white/50">
            <span>{formatTime(isDragging ? dragTime : $currentTime)}</span>
            <span>{formatTime($duration)}</span>
          </div>
        </div>

        <!-- Controles Centrais -->
        <div class="flex items-center justify-center gap-5 sm:gap-6 pt-0.5">
          <button
            onclick={() => playerActions.toggleShuffle()}
            class="p-2 transition cursor-pointer {$shuffle ? 'text-[#3093AA]' : 'text-white/40 hover:text-white'}"
            title="Aleatório"
          >
            <Shuffle class="w-4.5 h-4.5" />
          </button>

          <button
            onclick={() => playerActions.previous()}
            class="p-2.5 text-[#F0F0F5] hover:scale-110 active:scale-95 transition cursor-pointer"
            title="Faixa Anterior"
          >
            <SkipBack class="w-6 h-6 fill-current" />
          </button>

          <!-- Botão Play Principal: Coral da Marca com Glow Pulsar -->
          <button
            onclick={() => playerActions.togglePlay()}
            class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#EF7D4B] text-white flex items-center justify-center shadow-2xl shadow-[#EF7D4B]/35 hover:scale-105 active:scale-90 transition cursor-pointer"
            title={$isPlaying ? 'Pausar' : 'Reproduzir'}
          >
            {#if $isPlaying}
              <Pause class="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
            {:else}
              <Play class="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-1" />
            {/if}
          </button>

          <button
            onclick={() => playerActions.next()}
            class="p-2.5 text-[#F0F0F5] hover:scale-110 active:scale-95 transition cursor-pointer"
            title="Próxima Faixa"
          >
            <SkipForward class="w-6 h-6 fill-current" />
          </button>

          <button
            onclick={() => playerActions.cycleRepeat()}
            class="p-2 transition cursor-pointer {$repeatMode !== 'none' ? 'text-[#3093AA]' : 'text-white/40 hover:text-white'}"
            title="Repetir"
          >
            {#if $repeatMode === 'one'}
              <Repeat1 class="w-4.5 h-4.5" />
            {:else}
              <Repeat class="w-4.5 h-4.5" />
            {/if}
          </button>
        </div>
      </div>
    </main>

    <!-- Rodapé: Volume -->
    <footer class="max-w-md w-full mx-auto flex items-center gap-3 z-10 shrink-0 pt-1">
      <button onclick={() => playerActions.toggleMute()} class="text-white/50 hover:text-white cursor-pointer">
        {#if $isMuted || $volume === 0}
          <VolumeX class="w-4 h-4 text-[#EF7D4B]" />
        {:else}
          <Volume2 class="w-4 h-4" />
        {/if}
      </button>

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={$isMuted ? 0 : $volume}
        oninput={handleVolume}
        class="w-full h-1 bg-white/[0.15] rounded-full appearance-none cursor-pointer accent-[#3093AA]"
      />
    </footer>
  </div>
{/if}
