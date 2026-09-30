<script lang="ts">
  import { 
    Play, 
    Pause, 
    SkipBack, 
    SkipForward, 
    Shuffle, 
    Repeat, 
    Repeat1, 
    Volume2, 
    VolumeX, 
    Maximize2, 
    ListOrdered, 
    Video, 
    Heart, 
    Music,
    PictureInPicture2,
    Radio,
    Headphones,
    Laptop,
    Loader2
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
    isQueueOpen,
    isVideoVisible,
    queue
  } from '../stores/playerStore';
  import { favoriteTrackIds, libraryActions } from '../stores/libraryStore';
  import { cloudSyncState } from '../services/syncEngine';
  import { audioRouter } from '../audio/AudioRouter';
  import PulsarConnectModal from './PulsarConnectModal.svelte';
  import { t } from '../i18n';

  const activeDevice = audioRouter.activeDevice;
  let isConnectModalOpen = $state(false);

  let isDragging = $state(false);
  let dragTime = $state(0);

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
  }

  function handleVolume(e: Event) {
    const target = e.target as HTMLInputElement;
    playerActions.setVolume(parseFloat(target.value));
  }

  function handleToggleVideo() {
    const nextVid = !$isVideoVisible;
    playerActions.setVideoVisible(nextVid);
    if (nextVid && !$isNowPlayingOpen) {
      isNowPlayingOpen.set(true);
    }
  }
</script>

<div class="w-full pointer-events-none z-40 px-2 sm:px-4 py-2 flex justify-center">
  <div class="pointer-events-auto w-full max-w-5xl px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between lq-capsule-dock text-[#F0F0F5] select-none border border-white/[0.18] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)]">
    <!-- Esquerda: Info da Faixa Atual com Badge Hi-Fi -->
    <div class="flex items-center gap-2.5 sm:gap-3.5 w-auto max-w-[34%] sm:w-1/4 min-w-0">
      {#if $currentTrack}
        <button 
          onclick={() => isNowPlayingOpen.set(true)}
          class="relative group w-11 h-11 sm:w-12 sm:h-12 rounded-2xl overflow-hidden shadow-lg shrink-0 cursor-pointer border border-white/[0.16] transition-transform duration-300 group-hover:scale-105"
        >
          <img 
            src={$currentTrack.thumbnail_url} 
            alt={$currentTrack.title} 
            class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
            <Maximize2 class="w-4 h-4 text-white" />
          </div>
        </button>

        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              class="text-left text-xs font-semibold text-[#F0F0F5] truncate hover:text-[#3093AA] transition-colors cursor-pointer bg-transparent border-0 p-0"
              onclick={() => isNowPlayingOpen.set(true)}
            >
              {$currentTrack.title}
            </button>
            <span class="hidden lg:inline-flex px-1.5 py-0.2 rounded-full bg-white/[0.08] border border-white/[0.14] text-[8px] font-black tracking-widest text-[#3093AA] uppercase shrink-0">
              LOSSLESS
            </span>
          </div>
          <span class="text-[11px] text-[#F0F0F5]/60 truncate font-medium">
            {$currentTrack.artist_guess || $currentTrack.channel_name}
          </span>
        </div>

        <button
          onclick={() => {
            if ($currentTrack) libraryActions.toggleFavorite($currentTrack.id, $currentTrack);
          }}
          class="p-1.5 rounded-xl text-white/40 hover:text-[#F3B044] hover:bg-white/[0.06] transition cursor-pointer shrink-0"
          title="{$t('trackList.favorite')}"
        >
          <Heart 
            class="w-4 h-4 {$favoriteTrackIds.has($currentTrack.id) ? 'fill-[#F3B044] text-[#F3B044]' : ''}" 
          />
        </button>
      {:else}
        <div class="flex items-center gap-2.5 text-white/40">
          <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <Music class="w-4 h-4 text-white/30" />
          </div>
          <div class="text-xs">
            <p class="font-medium text-white/70">{$t('player.noTrackPlaying')}</p>
            <p class="text-[10px] text-white/40">{$t('player.selectSong')}</p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Centro: Controles de Reprodução & Scrubber Líquido -->
    <div class="flex flex-col items-center gap-1 flex-1 max-w-lg mx-2 sm:mx-4 min-w-0">
      <div class="flex items-center gap-3 sm:gap-4">
        <!-- Shuffle -->
        <button
          onclick={() => playerActions.toggleShuffle()}
          class="p-1.5 rounded-full transition cursor-pointer {$shuffle ? 'text-[#3093AA] bg-white/[0.08]' : 'text-white/40 hover:text-white hover:bg-white/[0.06]'}"
          title="{$t('player.shuffle')}"
        >
          <Shuffle class="w-3.5 h-3.5" />
        </button>

        <!-- Previous -->
        <button
          onclick={() => playerActions.previous()}
          class="p-1.5 rounded-full text-white/75 hover:text-white hover:bg-white/[0.06] active:scale-95 transition cursor-pointer"
          title="{$t('player.previous')}"
        >
          <SkipBack class="w-4 h-4" />
        </button>

        <!-- Play / Pause Principal (Coral da Marca Pulsar com Glow Especular) -->
        <button
          onclick={() => playerActions.togglePlay()}
          class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#EF7D4B] via-[#EF7D4B] to-[#F3B044] text-white flex items-center justify-center shadow-lg shadow-[#EF7D4B]/35 border border-white/25 active:scale-90 hover:scale-105 transition-all cursor-pointer shrink-0"
          title={$isPlaying ? $t('common.confirm') : $t('playlistDetail.play')}
        >
          {#if $isPlaying}
            <Pause class="w-4 h-4 fill-current" />
          {:else}
            <Play class="w-4 h-4 fill-current ml-0.5" />
          {/if}
        </button>

        <!-- Next -->
        <button
          onclick={() => playerActions.next()}
          class="p-1.5 rounded-full text-white/75 hover:text-white hover:bg-white/[0.06] active:scale-95 transition cursor-pointer"
          title="{$t('player.next')}"
        >
          <SkipForward class="w-4 h-4" />
        </button>

        <!-- Repeat -->
        <button
          onclick={() => playerActions.cycleRepeat()}
          class="p-1.5 rounded-full transition cursor-pointer {$repeatMode !== 'none' ? 'text-[#3093AA] bg-white/[0.08]' : 'text-white/40 hover:text-white hover:bg-white/[0.06]'}"
          title="{$t('player.repeat')}"
        >
          {#if $repeatMode === 'one'}
            <Repeat1 class="w-3.5 h-3.5" />
          {:else}
            <Repeat class="w-3.5 h-3.5" />
          {/if}
        </button>
      </div>

      <!-- Barra de Progresso com Scrubber Líquido com Respiro de Tempo -->
      <div class="w-full flex items-center gap-2 text-[10px] font-mono text-white/50 px-1">
        <span class="w-8 text-right tabular-nums shrink-0">{formatTime(isDragging ? dragTime : $currentTime)}</span>
        
        <div class="relative flex-1 flex items-center group py-1 min-w-0">
          <input
            type="range"
            min="0"
            max={$duration || 100}
            value={isDragging ? dragTime : $currentTime}
            onpointerdown={handleSeekPointerDown}
            oninput={handleSeekInput}
            onchange={handleSeekChange}
            class="w-full h-1 bg-white/[0.14] group-hover:h-1.5 rounded-full appearance-none cursor-pointer accent-[#EF7D4B] transition-all"
          />
        </div>

        <span class="w-8 tabular-nums shrink-0">{formatTime($duration)}</span>
      </div>
    </div>

    <!-- Direita: Volume & Ferramentas Táteis em Vidro com Tamanhos Padronizados -->
    <div class="flex items-center justify-end gap-1 sm:gap-1.5 shrink-0 pl-1 sm:pl-3">
      <!-- Indicador Sutil de Sincronização em Nuvem (Cloud Sync Spinner sem texto) -->
      {#if $cloudSyncState === 'syncing'}
        <div 
          class="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-xl lq-glass-pill text-[#3093AA] animate-fade-in shrink-0 shadow-sm"
          title="Sincronizando biblioteca com a nuvem..."
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 class="w-3.5 h-3.5 text-[#3093AA] animate-spin" />
        </div>
      {/if}

      <!-- Toggle Vídeo (Tamanho Fixo sem Estufar) -->
      <button
        onclick={handleToggleVideo}
        class="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-xl transition cursor-pointer shrink-0 {$isVideoVisible ? 'bg-white/[0.12] text-[#EF7D4B] border border-[#EF7D4B]/30' : 'text-white/50 hover:text-white hover:bg-white/[0.06]'}"
        title="{$t('player.videoMode')}"
      >
        <Video class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      <!-- Fila Drawer com Badge Pílula -->
      <button
        onclick={() => playerActions.toggleQueue()}
        class="relative w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-xl transition cursor-pointer shrink-0 {$isQueueOpen ? 'bg-white/[0.12] text-[#3093AA] border border-[#3093AA]/30' : 'text-white/50 hover:text-white hover:bg-white/[0.06]'}"
        title="{$t('player.queue')}"
      >
        <ListOrdered class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        {#if $queue.length > 0}
          <span class="absolute -top-1 -right-1 min-w-[1.1rem] h-3.5 px-1 rounded-full bg-[#3093AA] text-[8px] font-black text-white flex items-center justify-center shadow-md">
            {$queue.length}
          </span>
        {/if}
      </button>

      <!-- Pulsar Connect (Seletor de Saída de Áudio) -->
      <button
        onclick={() => isConnectModalOpen = true}
        class="relative w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-xl transition cursor-pointer shrink-0 {$activeDevice.type !== 'local' ? 'bg-[#3093AA]/20 text-[#3093AA] border border-[#3093AA]/40 shadow-[0_0_12px_rgba(48,147,170,0.35)]' : 'text-white/50 hover:text-white hover:bg-white/[0.06]'}"
        title="{$t('player.connect')}"
      >
        {#if $activeDevice.type === 'bluetooth'}
          <Headphones class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        {:else if $activeDevice.type === 'upnp'}
          <Radio class="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
        {:else}
          <Radio class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        {/if}

        {#if $activeDevice.type !== 'local'}
          <span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#3093AA] shadow-sm animate-ping"></span>
          <span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#3093AA] shadow-sm"></span>
        {/if}
      </button>

      <!-- Controle de Volume -->
      <div class="hidden md:flex items-center gap-1.5 group pl-1">
        <button
          onclick={() => playerActions.toggleMute()}
          class="text-white/50 hover:text-white transition cursor-pointer"
          title={$isMuted ? $t('player.unmute') : $t('player.mute')}
        >
          {#if $isMuted || $volume === 0}
            <VolumeX class="w-3.5 h-3.5 text-[#EF7D4B]" />
          {:else}
            <Volume2 class="w-3.5 h-3.5" />
          {/if}
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={$isMuted ? 0 : $volume}
          oninput={handleVolume}
          class="w-14 lg:w-18 h-1 bg-white/[0.14] rounded-full appearance-none cursor-pointer accent-[#3093AA] group-hover:h-1.5 transition-all"
        />
      </div>

      <!-- Mini Player Flutuante (PiP) -->
      <button
        onclick={() => playerActions.toggleMiniPlayer(true)}
        class="hidden sm:block p-1.5 sm:p-2 rounded-xl text-white/40 hover:text-[#3093AA] hover:bg-white/[0.06] transition cursor-pointer"
        title="{$t('player.miniPlayer')}"
      >
        <PictureInPicture2 class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      <!-- Expandir Now Playing -->
      <button
        onclick={() => playerActions.toggleNowPlaying()}
        class="p-1.5 sm:p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
        title="{$t('player.nowPlaying')}"
      >
        <Maximize2 class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  </div>
</div>

<!-- Modal Seletor de Saída Liquid Glass (Pulsar Connect) -->
<PulsarConnectModal bind:isOpen={isConnectModalOpen} />
