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
    Laptop
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
</script>

<div class="h-20 w-full px-3 sm:px-6 flex items-center justify-between border-t border-white/[0.08] bg-[#16161d]/85 backdrop-blur-2xl text-[#F2EFEA] select-none z-40 relative">
  <!-- Esquerda: Info da Faixa Atual -->
  <div class="flex items-center gap-2.5 sm:gap-3.5 w-auto max-w-[32%] sm:w-1/4 min-w-0">
    {#if $currentTrack}
      <button 
        onclick={() => isNowPlayingOpen.set(true)}
        class="relative group w-12 h-12 rounded-xl overflow-hidden shadow-md shrink-0 cursor-pointer border border-white/[0.06]"
      >
        <img 
          src={$currentTrack.thumbnail_url} 
          alt={$currentTrack.title} 
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Maximize2 class="w-4 h-4 text-white" />
        </div>
      </button>

      <div class="flex flex-col min-w-0">
        <button
          type="button"
          class="text-left text-xs font-semibold text-[#F2EFEA] truncate hover:underline cursor-pointer bg-transparent border-0 p-0"
          onclick={() => isNowPlayingOpen.set(true)}
        >
          {$currentTrack.title}
        </button>
        <span class="text-[11px] text-[#F2EFEA]/60 truncate">
          {$currentTrack.artist_guess || $currentTrack.channel_name}
        </span>
      </div>

      <button
        onclick={() => {
          if ($currentTrack) libraryActions.toggleFavorite($currentTrack.id, $currentTrack);
        }}
        class="p-1.5 rounded-lg text-white/40 hover:text-[#DBD56E] transition cursor-pointer"
        title="{$t('trackList.favorite')}"
      >
        <Heart 
          class="w-4 h-4 {$favoriteTrackIds.has($currentTrack.id) ? 'fill-[#DBD56E] text-[#DBD56E]' : ''}" 
        />
      </button>
    {:else}
      <div class="flex items-center gap-3 text-[#F2EFEA]/40">
        <div class="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
          <Music class="w-5 h-5" />
        </div>
        <div class="text-xs">
          <p class="font-medium">{$t('player.noTrackPlaying')}</p>
          <p class="text-[10px] text-[#F2EFEA]/30">{$t('player.selectSong')}</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- Centro: Controles de Reprodução & Barra de Progresso -->
  <div class="flex flex-col items-center gap-1.5 w-2/4 max-w-xl">
    <div class="flex items-center gap-4">
      <!-- Shuffle -->
      <button
        onclick={() => playerActions.toggleShuffle()}
        class="p-1.5 rounded-md transition cursor-pointer {$shuffle ? 'text-[#66D7D1]' : 'text-[#F2EFEA]/40 hover:text-[#F2EFEA]'}"
        title="{$t('player.shuffle')}"
      >
        <Shuffle class="w-4 h-4" />
      </button>

      <!-- Previous -->
      <button
        onclick={() => playerActions.previous()}
        class="p-1.5 rounded-md text-[#F2EFEA]/80 hover:text-[#F2EFEA] active:scale-95 transition cursor-pointer"
        title="{$t('player.previous')}"
      >
        <SkipBack class="w-4 h-4" />
      </button>

      <!-- Play / Pause Principal -->
      <button
        onclick={() => playerActions.togglePlay()}
        class="w-10 h-10 rounded-full bg-[#F2EFEA] hover:bg-[#F2EFEA]/90 text-[#121216] flex items-center justify-center shadow-lg shadow-white/10 active:scale-90 transition-transform cursor-pointer"
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
        class="p-1.5 rounded-md text-[#F2EFEA]/80 hover:text-[#F2EFEA] active:scale-95 transition cursor-pointer"
        title="{$t('player.next')}"
      >
        <SkipForward class="w-4 h-4" />
      </button>

      <!-- Repeat -->
      <button
        onclick={() => playerActions.cycleRepeat()}
        class="p-1.5 rounded-md transition cursor-pointer {$repeatMode !== 'none' ? 'text-[#66D7D1]' : 'text-[#F2EFEA]/40 hover:text-[#F2EFEA]'}"
        title="{$t('player.repeat')}"
      >
        {#if $repeatMode === 'one'}
          <Repeat1 class="w-4 h-4" />
        {:else}
          <Repeat class="w-4 h-4" />
        {/if}
      </button>
    </div>

    <!-- Barra de Progresso com Scrubbing Suave -->
    <div class="w-full flex items-center gap-2.5 text-[11px] font-mono text-[#F2EFEA]/50">
      <span class="w-8 text-right">{formatTime(isDragging ? dragTime : $currentTime)}</span>
      
      <div class="relative flex-1 flex items-center group py-1">
        <input
          type="range"
          min="0"
          max={$duration || 100}
          value={isDragging ? dragTime : $currentTime}
          onpointerdown={handleSeekPointerDown}
          oninput={handleSeekInput}
          onchange={handleSeekChange}
          class="w-full h-1 bg-white/[0.1] group-hover:h-1.5 rounded-full appearance-none cursor-pointer accent-[#66D7D1] transition-all"
        />
      </div>

      <span class="w-8">{formatTime($duration)}</span>
    </div>
  </div>

  <!-- Direita: Volume & Painéis Adicionais -->
  <div class="flex items-center justify-end gap-1.5 sm:gap-3 w-auto max-w-[32%] sm:w-1/4 shrink-0">
    <!-- Toggle Vídeo -->
    <button
      onclick={() => playerActions.toggleVideo()}
      class="p-1.5 sm:p-2 rounded-lg transition cursor-pointer {$isVideoVisible ? 'bg-white/[0.08] text-[#FC7753]' : 'text-[#F2EFEA]/40 hover:text-[#F2EFEA] hover:bg-white/[0.04]'}"
      title="{$t('player.videoMode')}"
    >
      <Video class="w-4 h-4" />
    </button>

    <!-- Fila Drawer com Badge Pílula que não vaza -->
    <button
      onclick={() => playerActions.toggleQueue()}
      class="relative p-1.5 sm:p-2 rounded-lg transition cursor-pointer {$isQueueOpen ? 'bg-white/[0.08] text-[#66D7D1]' : 'text-[#F2EFEA]/40 hover:text-[#F2EFEA] hover:bg-white/[0.04]'}"
      title="{$t('player.queue')}"
    >
      <ListOrdered class="w-4 h-4" />
      {#if $queue.length > 0}
        <span class="absolute -top-1 -right-1 min-w-[1.25rem] h-4 px-1 rounded-full bg-[#66D7D1] text-[9px] font-bold text-[#121216] flex items-center justify-center shadow-md">
          {$queue.length}
        </span>
      {/if}
    </button>

    <!-- Pulsar Connect (Seletor de Saída de Áudio) -->
    <button
      onclick={() => isConnectModalOpen = true}
      class="relative p-1.5 sm:p-2 rounded-lg transition cursor-pointer {$activeDevice.type !== 'local' ? 'bg-[#66D7D1]/15 text-[#66D7D1] shadow-[0_0_12px_rgba(102,215,209,0.25)]' : 'text-[#F2EFEA]/40 hover:text-[#F2EFEA] hover:bg-white/[0.04]'}"
      title="{$t('player.connect')}"
    >
      {#if $activeDevice.type === 'bluetooth'}
        <Headphones class="w-4 h-4" />
      {:else if $activeDevice.type === 'upnp'}
        <Radio class="w-4 h-4 animate-pulse" />
      {:else}
        <Radio class="w-4 h-4" />
      {/if}

      {#if $activeDevice.type !== 'local'}
        <span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#66D7D1] shadow-sm animate-ping"></span>
        <span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#66D7D1] shadow-sm"></span>
      {/if}
    </button>

    <!-- Controle de Volume (Oculto em telas estreitas para não espremer os controles de reprodução) -->
    <div class="hidden md:flex items-center gap-2 group">
      <button
        onclick={() => playerActions.toggleMute()}
        class="text-[#F2EFEA]/50 hover:text-[#F2EFEA] transition cursor-pointer"
        title={$isMuted ? $t('player.unmute') : $t('player.mute')}
      >
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
        class="w-16 xl:w-20 h-1 bg-white/[0.1] rounded-full appearance-none cursor-pointer accent-[#F2EFEA] group-hover:h-1.5 transition-all"
      />
    </div>

    <!-- Mini Player Flutuante (PiP) -->
    <button
      onclick={() => playerActions.toggleMiniPlayer(true)}
      class="hidden sm:block p-1.5 sm:p-2 rounded-lg text-[#F2EFEA]/40 hover:text-[#66D7D1] hover:bg-white/[0.04] transition cursor-pointer"
      title="{$t('player.miniPlayer')}"
    >
      <PictureInPicture2 class="w-4 h-4" />
    </button>

    <!-- Expandir Now Playing -->
    <button
      onclick={() => playerActions.toggleNowPlaying()}
      class="p-1.5 sm:p-2 rounded-lg text-[#F2EFEA]/40 hover:text-[#F2EFEA] hover:bg-white/[0.04] transition cursor-pointer"
      title="{$t('player.nowPlaying')}"
    >
      <Maximize2 class="w-4 h-4" />
    </button>
  </div>
</div>

<!-- Modal Seletor de Saída Liquid Glass (Pulsar Connect) -->
<PulsarConnectModal bind:isOpen={isConnectModalOpen} />

