<script lang="ts">
  import { Play, Pause, Heart, Plus, Clock, Disc3, ListPlus, Trash2, Check } from '@lucide/svelte';
  import type { Track } from '../types';
  import { currentTrack, isPlaying, playerActions, formatTime } from '../stores/playerStore';
  import { favoriteTrackIds, libraryActions, activeView, selectedPlaylist, playlists } from '../stores/libraryStore';
  import { t } from '../i18n';

  let { tracks = [] }: { tracks: Track[] } = $props();

  let hoveredTrackId = $state<string | null>(null);
  let openPlaylistMenuTrackId = $state<string | null>(null);

  function handlePlayTrack(track: Track) {
    if ($currentTrack?.id === track.id) {
      playerActions.togglePlay();
    } else {
      playerActions.playTrack(track, tracks);
    }
  }

  function togglePlaylistMenu(e: MouseEvent, trackId: string) {
    e.stopPropagation();
    openPlaylistMenuTrackId = openPlaylistMenuTrackId === trackId ? null : trackId;
  }

  function handleAddToPlaylist(e: MouseEvent, playlistId: string, trackId: string) {
    e.stopPropagation();
    libraryActions.addTrackToPlaylist(playlistId, trackId);
    openPlaylistMenuTrackId = null;
  }

  function handleRemoveFromCurrentPlaylist(e: MouseEvent, trackId: string) {
    e.stopPropagation();
    if ($selectedPlaylist) {
      libraryActions.removeTrackFromPlaylist($selectedPlaylist.id, trackId);
    }
  }
</script>

<svelte:window onclick={() => openPlaylistMenuTrackId = null} />

<div class="w-full select-none">
  <!-- Table Header -->
  <div class="grid grid-cols-[48px_1fr_200px_100px_130px] items-center px-4 py-2.5 border-b border-white/[0.06] text-[11px] font-medium uppercase tracking-wider text-[#F2EFEA]/40">
    <span class="text-center">{$t('trackList.colNumber')}</span>
    <span>{$t('trackList.colTitle')}</span>
    <span>{$t('trackList.colChannel')}</span>
    <span class="flex items-center gap-1.5"><Clock class="w-3.5 h-3.5" /> {$t('trackList.colDuration')}</span>
    <span class="text-right pr-2">{$t('trackList.colActions')}</span>
  </div>

  <!-- Rows -->
  <div class="flex flex-col divide-y divide-white/[0.02]">
    {#each tracks as track, index (track.id)}
      {@const isCurrent = $currentTrack?.id === track.id}
      {@const isTrackPlaying = isCurrent && $isPlaying}

      <div
        role="button"
        tabindex="0"
        onmouseenter={() => hoveredTrackId = track.id}
        onmouseleave={() => hoveredTrackId = null}
        ondblclick={() => handlePlayTrack(track)}
        onkeydown={(e) => { if (e.key === 'Enter') handlePlayTrack(track); }}
        class="grid grid-cols-[48px_1fr_200px_100px_130px] items-center px-4 py-2.5 rounded-xl transition-all cursor-pointer group relative {isCurrent ? 'bg-white/[0.06] text-[#66D7D1]' : 'hover:bg-white/[0.03] text-[#F2EFEA]'}"
      >
        <!-- # ou Botão de Play -->
        <div class="flex items-center justify-center">
          {#if hoveredTrackId === track.id || isCurrent}
            <button
              onclick={(e) => { e.stopPropagation(); handlePlayTrack(track); }}
              class="w-7 h-7 rounded-full flex items-center justify-center transition {isCurrent ? 'bg-[#66D7D1] text-[#121216]' : 'bg-white/[0.1] text-white hover:bg-[#FC7753] hover:text-white'}"
            >
              {#if isTrackPlaying}
                <Pause class="w-3.5 h-3.5 fill-current" />
              {:else}
                <Play class="w-3.5 h-3.5 fill-current ml-0.5" />
              {/if}
            </button>
          {:else}
            <span class="text-xs font-mono text-[#F2EFEA]/40">{index + 1}</span>
          {/if}
        </div>

        <!-- Título + Thumbnail + Artista -->
        <div class="flex items-center gap-3.5 min-w-0 pr-4">
          <div class="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/[0.06] shadow-sm">
            <img src={track.thumbnail_url} alt={track.title} class="w-full h-full object-cover" />
            {#if isTrackPlaying}
              <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div class="flex items-end gap-0.5 h-3">
                  <div class="w-0.5 bg-[#66D7D1] animate-[pulse_0.6s_ease-in-out_infinite] h-full"></div>
                  <div class="w-0.5 bg-[#66D7D1] animate-[pulse_0.9s_ease-in-out_infinite] h-2/3"></div>
                  <div class="w-0.5 bg-[#66D7D1] animate-[pulse_0.7s_ease-in-out_infinite] h-4/5"></div>
                </div>
              </div>
            {/if}
          </div>

          <div class="flex flex-col min-w-0">
            <span class="text-xs font-medium truncate {isCurrent ? 'text-[#66D7D1] font-semibold' : 'text-[#F2EFEA]'}">
              {track.title}
            </span>
            <span class="text-[11px] text-[#F2EFEA]/50 truncate">
              {track.artist_guess || track.channel_name}
            </span>
          </div>
        </div>

        <!-- Canal -->
        <span class="text-xs text-[#F2EFEA]/60 truncate pr-2">
          {track.channel_name}
        </span>

        <!-- Duração -->
        <span class="text-xs font-mono text-[#F2EFEA]/50">
          {formatTime(track.duration_seconds)}
        </span>

        <!-- Ações -->
        <div class="flex items-center justify-end gap-1 relative">
          <!-- Favoritar -->
          <button
            onclick={(e) => { e.stopPropagation(); libraryActions.toggleFavorite(track.id, track); }}
            class="p-1.5 rounded-md transition text-[#F2EFEA]/30 hover:text-[#DBD56E] {$favoriteTrackIds.has(track.id) ? 'text-[#DBD56E]' : 'opacity-0 group-hover:opacity-100'}"
            title="{$t('trackList.favorite')}"
          >
            <Heart class="w-4 h-4 {$favoriteTrackIds.has(track.id) ? 'fill-[#DBD56E]' : ''}" />
          </button>

          <!-- Adicionar à Fila -->
          <button
            onclick={(e) => { e.stopPropagation(); playerActions.addToQueue(track); }}
            class="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition text-[#F2EFEA]/40 hover:text-[#66D7D1]"
            title="{$t('player.queue')}"
          >
            <Plus class="w-4 h-4" />
          </button>

          <!-- Menu Adicionar a Playlist -->
          <div class="relative">
            <button
              onclick={(e) => togglePlaylistMenu(e, track.id)}
              class="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition text-[#F2EFEA]/40 hover:text-[#DBD56E] cursor-pointer"
              title="{$t('trackList.addToPlaylist')}"
            >
              <ListPlus class="w-4 h-4" />
            </button>

            <!-- Dropdown Flutuante de Playlists -->
            {#if openPlaylistMenuTrackId === track.id}
              <div 
                role="menu"
                tabindex="-1"
                class="absolute right-0 top-full mt-1 w-48 rounded-xl bg-[#16161d] border border-white/[0.1] shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 backdrop-blur-2xl"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => { if (e.key === 'Escape') openPlaylistMenuTrackId = null; }}
              >
                <span class="text-[10px] font-semibold uppercase tracking-wider text-[#F2EFEA]/40 px-2 py-1">{$t('trackList.addToPlaylist')}:</span>
                {#if $playlists.length === 0}
                  <span class="text-xs text-[#F2EFEA]/40 px-2 py-1">{$t('socialDrawer.emptyFriends')}</span>
                {:else}
                  {#each $playlists as pl}
                    <button
                      onclick={(e) => handleAddToPlaylist(e, pl.id, track.id)}
                      class="w-full text-left px-2 py-1.5 rounded-lg text-xs text-[#F2EFEA]/80 hover:bg-white/[0.08] hover:text-[#66D7D1] transition flex items-center justify-between"
                    >
                      <span class="truncate">{pl.name}</span>
                      <Plus class="w-3 h-3 shrink-0" />
                    </button>
                  {/each}
                {/if}
              </div>
            {/if}
          </div>

          <!-- Se estiver visualizando playlist, permitir remoção -->
          {#if $activeView === 'playlist-detail' && $selectedPlaylist}
            <button
              onclick={(e) => handleRemoveFromCurrentPlaylist(e, track.id)}
              class="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition text-[#F2EFEA]/40 hover:text-[#FC7753]"
              title="{$t('trackList.removeFromPlaylist')}"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Empty State -->
      <div class="py-16 flex flex-col items-center justify-center gap-3 text-center">
        <Disc3 class="w-10 h-10 text-[#F2EFEA]/20" />
        <p class="text-sm font-medium text-[#F2EFEA]/60">{$t('recentView.empty')}</p>
        <p class="text-xs text-[#F2EFEA]/30">{$t('modals.pasteLinkDesc')}</p>
      </div>
    {/each}
  </div>
</div>
