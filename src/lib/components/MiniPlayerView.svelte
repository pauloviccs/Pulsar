<script lang="ts">
  import { 
    Play, 
    Pause, 
    SkipBack, 
    SkipForward, 
    Maximize2, 
    Video, 
    Music, 
    Volume2, 
    VolumeX,
    Minus,
    X,
    Heart
  } from '@lucide/svelte';
  import { 
    currentTrack, 
    isPlaying, 
    currentTime, 
    duration, 
    playerActions, 
    formatTime, 
    isMiniPlayer, 
    isMiniPlayerVideo,
    volume,
    isMuted
  } from '../stores/playerStore';
  import { favoriteTrackIds, libraryActions } from '../stores/libraryStore';
  import { safeInvoke, isTauri } from '../api/tauri';
  import { untrack } from 'svelte';

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
  $effect(() => {
    const track = $currentTrack;
    const isVideo = $isMiniPlayerVideo;

    if (isVideo && track?.youtube_video_id) {
      if (loadedVideoId !== track.youtube_video_id) {
        loadedVideoId = track.youtube_video_id;
        const initialStart = untrack(() => Math.max(0, Math.floor($currentTime)));
        iframeSrc = `https://www.youtube-nocookie.com/embed/${track.youtube_video_id}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${track.youtube_video_id}&enablejsapi=1&start=${initialStart}`;
      }
    } else if (!isVideo) {
      loadedVideoId = null;
      iframeSrc = '';
    }
  });

  $effect(() => {
    if ($isMiniPlayerVideo && videoIframe && iframeSrc) {
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

  async function handleWindowDrag(e: MouseEvent) {
    // Evita acionar drag ao clicar em botões, inputs ou links
    if ((e.target as HTMLElement).closest('button, input, iframe, a')) return;
    if (isTauri()) {
      try {
        await safeInvoke('drag_window');
      } catch (err) {
        console.warn('[Pulsar MiniPlayer] Erro ao arrastar janela:', err);
      }
    }
  }

  async function minimizeWindow() {
    if (isTauri()) {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const win = getCurrentWebviewWindow();
        await win.minimize();
      } catch (e) {
        console.warn('[Pulsar MiniPlayer] Erro ao minimizar:', e);
      }
    }
  }

  function restoreMainPlayer() {
    playerActions.toggleMiniPlayer(false);
  }

  let isFav = $derived(
    $currentTrack ? $favoriteTrackIds.has($currentTrack.id) : false
  );

  let artistDisplay = $derived(
    $currentTrack ? ($currentTrack.artist || $currentTrack.artist_guess || $currentTrack.channel_name || 'Desconhecido') : ''
  );
</script>

<!-- Container Principal do Mini Player: Apple Liquid Glass com materiais multicamadas -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  role="application"
  tabindex="-1"
  data-tauri-drag-region
  onmousedown={handleWindowDrag}
  class="w-full h-full flex flex-col justify-between select-none overflow-hidden relative group cursor-grab active:cursor-grabbing p-3 text-[#F2EFEA]
         bg-[#0b0c13]/70 backdrop-blur-3xl 
         border-t border-white/[0.22] border-x border-white/[0.08] border-b border-black/40
         shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_20px_50px_rgba(0,0,0,0.8)]"
>
  <!-- Iluminação Difusa Traseira (Aura de Vidro Dinâmica Apple visionOS) -->
  <div class="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
    {#if $currentTrack?.thumbnail_url}
      <img
        src={$currentTrack.thumbnail_url}
        alt=""
        class="w-full h-full object-cover scale-150 blur-3xl opacity-25 filter saturate-150"
      />
    {:else}
      <div class="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-[#FC7753] blur-3xl opacity-20"></div>
      <div class="absolute -bottom-12 -right-12 w-48 h-48 rounded-full bg-[#66D7D1] blur-3xl opacity-20"></div>
    {/if}
    <div class="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-black/40"></div>
  </div>

  <!-- Barra Superior: Drag Handle Estilo Apple + Botões de Janela em Cápsulas Líquidas -->
  <div class="w-full flex items-center justify-between pb-1.5 shrink-0" data-tauri-drag-region>
    <!-- Grip & Branding Apple Glass -->
    <div class="flex items-center gap-2" data-tauri-drag-region>
      <div class="w-2 h-2 rounded-full bg-[#66D7D1] shadow-sm shadow-[#66D7D1]/60"></div>
      <span class="text-[10px] font-bold tracking-wider uppercase text-white/50" data-tauri-drag-region>Pulsar</span>
      <!-- Grab Bar Tátil estilo iOS Sheet Grabber -->
      <div class="w-12 h-1 rounded-full bg-white/20 hover:bg-white/40 transition-colors ml-1" data-tauri-drag-region></div>
    </div>

    <!-- Botões de Controle de Janela -->
    <div class="flex items-center gap-0.5">
      {#if $currentTrack}
        <button
          onclick={() => playerActions.toggleMiniPlayerVideo()}
          class="p-1 rounded-lg hover:bg-white/[0.1] text-white/60 hover:text-[#FC7753] transition-all cursor-pointer active:scale-95"
          title={$isMiniPlayerVideo ? "Alternar para Modo Capa" : "Alternar para Modo Vídeo"}
        >
          {#if $isMiniPlayerVideo}
            <Music class="w-3.5 h-3.5 text-[#66D7D1]" />
          {:else}
            <Video class="w-3.5 h-3.5" />
          {/if}
        </button>
      {/if}

      <button
        onclick={minimizeWindow}
        class="p-1 rounded-lg hover:bg-white/[0.1] text-white/60 hover:text-white transition-all cursor-pointer active:scale-95"
        title="Minimizar Janela"
      >
        <Minus class="w-3.5 h-3.5" />
      </button>

      <button
        onclick={restoreMainPlayer}
        class="p-1 rounded-lg hover:bg-white/[0.1] text-white/60 hover:text-white transition-all cursor-pointer active:scale-95"
        title="Restaurar Janela Principal"
      >
        <Maximize2 class="w-3.5 h-3.5" />
      </button>

      <button
        onclick={restoreMainPlayer}
        class="p-1 rounded-lg hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all cursor-pointer active:scale-95"
        title="Fechar Mini Player"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>

  <!-- Conteúdo Central: Modo Áudio vs Modo Vídeo -->
  {#if $isMiniPlayerVideo && $currentTrack}
    <!-- MODO VÍDEO COMPACTO COM MOLDURA DE VIDRO -->
    <div class="flex-1 w-full relative rounded-xl overflow-hidden bg-black/80 my-1 border border-white/[0.1] shadow-inner">
      <iframe
        bind:this={videoIframe}
        src={iframeSrc}
        title={$currentTrack.title}
        class="w-full h-full border-0 pointer-events-auto"
        allow="autoplay; encrypted-media"
      ></iframe>
    </div>
  {:else}
    <!-- MODO CAPA / ÁUDIO: Liquid Glass Music Card -->
    <div class="flex items-center gap-3 py-1" data-tauri-drag-region>
      <!-- Capa do Álbum com Borda de Vidro e Sombra Profunda -->
      {#if $currentTrack?.thumbnail_url}
        <div class="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-white/[0.15]">
          <img
            src={$currentTrack.thumbnail_url}
            alt={$currentTrack.title}
            class="w-full h-full object-cover"
          />
        </div>
      {:else}
        <div class="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center shrink-0">
          <Music class="w-5 h-5 text-white/30" />
        </div>
      {/if}

      <!-- Metadados da Música -->
      <div class="flex-1 min-w-0 flex flex-col justify-center" data-tauri-drag-region>
        <h3 class="text-xs font-bold text-[#F2EFEA] truncate leading-tight" title={$currentTrack?.title || 'Nenhuma faixa'}>
          {$currentTrack?.title || 'Nenhuma música tocando'}
        </h3>
        <p class="text-[11px] text-white/50 truncate leading-normal">
          {artistDisplay}
        </p>
      </div>

      <!-- Botão Rápido de Favoritar no Mini Player -->
      {#if $currentTrack}
        <button
          onclick={() => libraryActions.toggleFavorite($currentTrack.id, $currentTrack)}
          class="p-2 rounded-xl hover:bg-white/[0.1] text-white/40 hover:text-white transition-all cursor-pointer active:scale-95 shrink-0"
          title={isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
        >
          <Heart class="w-4 h-4 {isFav ? 'fill-[#FC7753] text-[#FC7753]' : ''}" />
        </button>
      {/if}
    </div>
  {/if}

  <!-- Barra Inferior: Scrubber de Progresso + Controles de Transporte Líquidos -->
  <div class="flex flex-col gap-1.5 pt-1 shrink-0" data-tauri-drag-region>
    <!-- Scrubber Deslizante Apple com Gradiente Coral/Ciano -->
    <div class="flex items-center gap-2">
      <span class="text-[9px] font-mono text-white/40 w-6 text-right tabular-nums">
        {formatTime(isDragging ? dragTime : $currentTime)}
      </span>

      <div class="relative flex-1 flex items-center h-2 group/seek">
        <input
          type="range"
          min="0"
          max={$duration || 100}
          step="1"
          value={isDragging ? dragTime : $currentTime}
          onpointerdown={handleSeekPointerDown}
          oninput={handleSeekInput}
          onchange={handleSeekChange}
          class="w-full h-1 bg-white/[0.12] rounded-full appearance-none cursor-pointer accent-[#FC7753] group-hover/seek:h-1.5 transition-all"
        />
      </div>

      <span class="text-[9px] font-mono text-white/40 w-6 tabular-nums">
        {formatTime($duration)}
      </span>
    </div>

    <!-- Controles de Reprodução em Cápsulas Líquidas Apple -->
    <div class="flex items-center justify-between px-1" data-tauri-drag-region>
      <!-- Controle de Volume / Mudo -->
      <button
        onclick={() => playerActions.toggleMute()}
        class="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer active:scale-95"
        title={$isMuted ? "Ativar Áudio" : "Silenciar Áudio"}
      >
        {#if $isMuted || $volume === 0}
          <VolumeX class="w-3.5 h-3.5 text-red-400" />
        {:else}
          <Volume2 class="w-3.5 h-3.5" />
        {/if}
      </button>

      <!-- Botões Centrais de Transporte -->
      <div class="flex items-center gap-1.5">
        <button
          onclick={() => playerActions.previous()}
          class="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/[0.1] transition-all cursor-pointer active:scale-90"
          title="Faixa Anterior"
        >
          <SkipBack class="w-4 h-4 fill-current" />
        </button>

        <button
          onclick={() => playerActions.togglePlay()}
          class="p-2.5 rounded-2xl bg-gradient-to-tr from-[#FC7753] to-[#ff8f70] text-[#0b0c13] shadow-md shadow-[#FC7753]/30 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          title={$isPlaying ? "Pausar" : "Reproduzir"}
        >
          {#if $isPlaying}
            <Pause class="w-4 h-4 fill-current text-[#0b0c13]" />
          {:else}
            <Play class="w-4 h-4 fill-current text-[#0b0c13] ml-0.5" />
          {/if}
        </button>

        <button
          onclick={() => playerActions.next()}
          class="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/[0.1] transition-all cursor-pointer active:scale-90"
          title="Próxima Faixa"
        >
          <SkipForward class="w-4 h-4 fill-current" />
        </button>
      </div>

      <!-- Espaçador de Equilíbrio Visual -->
      <div class="w-7"></div>
    </div>
  </div>
</div>
