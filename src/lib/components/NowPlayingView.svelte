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
    Image as ImageIcon
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
    isQueueOpen
  } from '../stores/playerStore';
  import { untrack } from 'svelte';
  import { favoriteTrackIds, libraryActions } from '../stores/libraryStore';

  let isDragging = $state(false);
  let dragTime = $state(0);
  let videoIframe = $state<HTMLIFrameElement>();
  let loadedVideoId = $state<string | null>(null);
  let iframeSrc = $state<string>('');

  function sendIframeCommand(func: string, args: any[] = []) {
    if (videoIframe && videoIframe.contentWindow) {
      videoIframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    }
  }

  // Define a URL do iframe apenas quando o ID do vídeo mudar (ou ao ligar o modo de vídeo)
  // Utiliza untrack para NUNCA recriar o iframe a cada tick do áudio, eliminando 100% o flickering preto
  $effect(() => {
    const track = $currentTrack;
    const isVisible = $isVideoVisible;

    if (isVisible && track?.youtube_video_id) {
      if (loadedVideoId !== track.youtube_video_id) {
        loadedVideoId = track.youtube_video_id;
        const initialStart = untrack(() => Math.max(0, Math.floor($currentTime)));
        iframeSrc = `https://www.youtube-nocookie.com/embed/${track.youtube_video_id}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${track.youtube_video_id}&enablejsapi=1&start=${initialStart}`;
      }
    } else if (!isVisible) {
      loadedVideoId = null;
      iframeSrc = '';
    }
  });

  $effect(() => {
    if ($isVideoVisible && videoIframe && iframeSrc) {
      sendIframeCommand($isPlaying ? 'playVideo' : 'pauseVideo');
    }
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
    sendIframeCommand('seekTo', [val, true]);
  }

  function handleVolume(e: Event) {
    const target = e.target as HTMLInputElement;
    playerActions.setVolume(parseFloat(target.value));
  }
</script>

{#if $isNowPlayingOpen && $currentTrack}
  <div class="fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-8 bg-[#09090d]/95 backdrop-blur-3xl text-[#F2EFEA] select-none overflow-y-auto animate-[fade-in_0.3s_cubic-bezier(0.16,1,0.3,1)]">
    <!-- Fundo de iluminação dinâmica (Apple Music Glow) -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none -z-10 opacity-40">
      <div class="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-[#FC7753] blur-[160px] animate-pulse"></div>
      <div class="absolute -bottom-20 right-1/4 w-[550px] h-[550px] rounded-full bg-[#66D7D1] blur-[180px]"></div>
    </div>

    <!-- Top Header -->
    <header class="flex items-center justify-between z-10 shrink-0">
      <button
        onclick={() => isNowPlayingOpen.set(false)}
        class="flex items-center gap-2 px-3.5 py-2 rounded-2xl liquid-glass text-xs font-semibold text-[#F2EFEA] hover:bg-white/[0.12] transition active:scale-95 cursor-pointer shadow-sm"
      >
        <ChevronDown class="w-4 h-4" />
        <span>Minimizar</span>
      </button>

      <span class="text-xs font-bold tracking-widest uppercase text-[#F2EFEA]/60">Reproduzindo Agora</span>

      <div class="flex items-center gap-2.5">
        <button
          onclick={() => playerActions.toggleVideo()}
          class="px-3 py-2 rounded-2xl liquid-glass transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold {$isVideoVisible ? 'bg-[#FC7753]/20 border-[#FC7753]/50 text-[#FC7753]' : 'text-[#F2EFEA]/70 hover:text-white'}"
          title="Alternar Modo Vídeo"
        >
          <Video class="w-4 h-4" />
          <span>{$isVideoVisible ? 'Modo Vídeo Ativo' : 'Ver Vídeo'}</span>
        </button>

        <button
          onclick={() => playerActions.toggleQueue()}
          class="p-2.5 rounded-2xl liquid-glass text-[#F2EFEA]/70 hover:text-white transition cursor-pointer"
          title="Ver Fila"
        >
          <ListOrdered class="w-4 h-4" />
        </button>
      </div>
    </header>

    <!-- Centro: Capa Grande OU Vídeo Real do YouTube -->
    <main class="w-full max-w-xl mx-auto flex flex-col items-center gap-4 sm:gap-6 my-auto z-10 py-4">
      {#if $isVideoVisible}
        <!-- Player de Vídeo Real em 16:9 Sincronizado -->
        <div class="relative aspect-video w-full rounded-3xl overflow-hidden shadow-2xl shadow-black/90 border border-white/[0.16] bg-black group animate-apple-spring">
          <iframe
            bind:this={videoIframe}
            src={iframeSrc}
            title="Vídeo oficial sincronizado"
            allow="autoplay; encrypted-media"
            class="w-full h-full border-0 pointer-events-none select-none scale-[1.02]"
          ></iframe>

          <!-- Overlay Elegante no Topo -->
          <div class="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.12] flex items-center gap-1.5 text-[10px] font-semibold text-[#66D7D1]">
            <span class="w-2 h-2 rounded-full bg-[#66D7D1] animate-ping"></span>
            <span>Vídeo Oficial Sincronizado</span>
          </div>

          <button
            onclick={() => playerActions.toggleVideo()}
            class="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/[0.12] text-[11px] font-medium text-white/80 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
          >
            <ImageIcon class="w-3.5 h-3.5" />
            <span>Voltar para Capa</span>
          </button>
        </div>
      {:else}
        <!-- Capa do Álbum Estilo Apple Music Glass com Restrição Vertical -->
        <div class="relative aspect-square w-56 sm:w-72 md:w-84 max-h-[36vh] rounded-3xl overflow-hidden shadow-2xl shadow-black/80 border border-white/[0.15] group animate-apple-spring">
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

      <!-- Título, Artista e Favoritar -->
      <div class="w-full flex items-center justify-between">
        <div class="flex flex-col min-w-0 pr-4">
          <h2 class="text-xl md:text-2xl font-bold text-[#F2EFEA] truncate tracking-tight">{$currentTrack.title}</h2>
          <p class="text-sm text-[#F2EFEA]/60 truncate font-medium">{$currentTrack.artist_guess || $currentTrack.channel_name}</p>
        </div>

        <button
          onclick={() => {
            if ($currentTrack) libraryActions.toggleFavorite($currentTrack.id, $currentTrack);
          }}
          class="p-3 rounded-2xl liquid-glass hover:bg-white/[0.12] transition cursor-pointer text-[#F2EFEA]/50 shadow-md"
          title="Favoritar"
        >
          <Heart class="w-5 h-5 {$favoriteTrackIds.has($currentTrack.id) ? 'fill-[#DBD56E] text-[#DBD56E]' : ''}" />
        </button>
      </div>

      <!-- Barra de Progresso Grande com Scrubbing Desacoplado -->
      <div class="w-full flex flex-col gap-2">
        <input
          type="range"
          min="0"
          max={$duration || 100}
          value={isDragging ? dragTime : $currentTime}
          onpointerdown={handleSeekPointerDown}
          oninput={handleSeekInput}
          onchange={handleSeekChange}
          class="w-full h-1.5 bg-white/[0.12] rounded-full appearance-none cursor-pointer accent-[#66D7D1] transition"
        />
        <div class="flex justify-between text-xs font-mono text-[#F2EFEA]/50">
          <span>{formatTime(isDragging ? dragTime : $currentTime)}</span>
          <span>{formatTime($duration)}</span>
        </div>
      </div>

      <!-- Controles Centrais -->
      <div class="flex items-center justify-center gap-6 pt-1">
        <button
          onclick={() => playerActions.toggleShuffle()}
          class="p-2.5 transition cursor-pointer {$shuffle ? 'text-[#66D7D1]' : 'text-[#F2EFEA]/40 hover:text-white'}"
          title="Aleatório"
        >
          <Shuffle class="w-5 h-5" />
        </button>

        <button
          onclick={() => playerActions.previous()}
          class="p-3 text-[#F2EFEA] hover:scale-110 active:scale-95 transition cursor-pointer"
          title="Faixa Anterior"
        >
          <SkipBack class="w-7 h-7 fill-current" />
        </button>

        <button
          onclick={() => playerActions.togglePlay()}
          class="w-16 h-16 rounded-full bg-[#F2EFEA] text-[#09090d] flex items-center justify-center shadow-2xl shadow-white/20 hover:scale-105 active:scale-90 transition cursor-pointer"
          title={$isPlaying ? 'Pausar' : 'Reproduzir'}
        >
          {#if $isPlaying}
            <Pause class="w-7 h-7 fill-current" />
          {:else}
            <Play class="w-7 h-7 fill-current ml-1" />
          {/if}
        </button>

        <button
          onclick={() => playerActions.next()}
          class="p-3 text-[#F2EFEA] hover:scale-110 active:scale-95 transition cursor-pointer"
          title="Próxima Faixa"
        >
          <SkipForward class="w-7 h-7 fill-current" />
        </button>

        <button
          onclick={() => playerActions.cycleRepeat()}
          class="p-2.5 transition cursor-pointer {$repeatMode !== 'none' ? 'text-[#66D7D1]' : 'text-[#F2EFEA]/40 hover:text-white'}"
          title="Repetir"
        >
          {#if $repeatMode === 'one'}
            <Repeat1 class="w-5 h-5" />
          {:else}
            <Repeat class="w-5 h-5" />
          {/if}
        </button>
      </div>
    </main>

    <!-- Rodapé: Volume -->
    <footer class="max-w-md w-full mx-auto flex items-center gap-3 z-10 shrink-0 pt-2">
      <button onclick={() => playerActions.toggleMute()} class="text-[#F2EFEA]/50 hover:text-white cursor-pointer">
        {#if $isMuted || $volume === 0}
          <VolumeX class="w-4 h-4 text-[#FC7753]" />
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
        class="w-full h-1 bg-white/[0.15] rounded-full appearance-none cursor-pointer accent-[#F2EFEA]"
      />
    </footer>
  </div>
{/if}
