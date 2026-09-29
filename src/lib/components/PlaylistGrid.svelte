<script lang="ts">
  import { Play, ListMusic, Clock } from '@lucide/svelte';
  import type { Playlist } from '../types';
  import { libraryActions, selectedPlaylistTracks } from '../stores/libraryStore';
  import { playerActions, formatTime } from '../stores/playerStore';
  import { get } from 'svelte/store';
  import { t } from '../i18n';

  let { playlists = [] }: { playlists: Playlist[] } = $props();

  function openPlaylist(pl: Playlist) {
    libraryActions.setActiveView('playlist-detail', pl);
  }

  async function handleQuickPlay(e: MouseEvent, pl: Playlist) {
    e.stopPropagation();
    await libraryActions.loadPlaylistTracks(pl.id);
    const tracks = get(selectedPlaylistTracks);
    if (tracks && tracks.length > 0) {
      playerActions.playTrack(tracks[0], tracks, pl.id);
    } else {
      openPlaylist(pl);
    }
  }
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 select-none shrink-0 w-full">
  {#each playlists as pl (pl.id)}
    <div
      role="button"
      tabindex="0"
      onclick={() => openPlaylist(pl)}
      onkeydown={(e) => { if (e.key === 'Enter') openPlaylist(pl); }}
      class="liquid-card rounded-3xl p-4 flex flex-col gap-3.5 group cursor-pointer border border-white/[0.08] hover:border-[#3093AA]/40 transition-all duration-300"
    >
      <!-- Capa 1:1 com botão de Play flutuante -->
      <div class="relative aspect-square w-full rounded-2xl overflow-hidden shadow-lg border border-white/[0.12] bg-black/40">
        <img
          src={pl.cover_image}
          alt={pl.name}
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        <!-- Hover Overlay com Play Coral Oficial -->
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
          <button
            type="button"
            onclick={(e) => handleQuickPlay(e, pl)}
            aria-label="Reproduzir playlist {pl.name}"
            class="w-13 h-13 rounded-full bg-[#EF7D4B] hover:bg-[#EF7D4B]/90 text-white flex items-center justify-center shadow-xl shadow-[#EF7D4B]/40 transform translate-y-2 group-hover:translate-y-0 transition-transform cursor-pointer hover:scale-105 active:scale-95"
          >
            <Play class="w-6 h-6 fill-current ml-0.5" />
          </button>
        </div>

        {#if pl.is_imported_youtube_playlist}
          <div class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/[0.12] text-[9px] font-bold text-[#EF7D4B] tracking-wider uppercase">
            YouTube
          </div>
        {/if}

        {#if pl.is_followed}
          <div class="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-[#3093AA]/80 backdrop-blur-md border border-white/[0.2] text-[9px] font-bold text-white tracking-wider">
            Seguindo
          </div>
        {/if}
      </div>

      <!-- Info da Playlist -->
      <div class="flex flex-col gap-1 px-0.5">
        <h3 class="text-sm font-bold text-[#F0F0F5] truncate group-hover:text-[#3093AA] transition-colors tracking-tight">
          {pl.name}
        </h3>

        {#if pl.owner_name || pl.owner_username}
          <span class="text-[11px] text-white/50 truncate">
            Por {pl.owner_name || `@${pl.owner_username}`}
          </span>
        {/if}

        <p class="text-xs text-white/50 line-clamp-2 leading-relaxed">
          {pl.description || $t('playlistDetail.localAudioDesc')}
        </p>

        <div class="flex items-center justify-between text-[11px] text-white/40 pt-2.5 border-t border-white/[0.06] font-medium flex-wrap gap-1">
          <span class="flex items-center gap-1.5">
            <ListMusic class="w-3.5 h-3.5 text-[#3093AA]" />
            {pl.track_count} {$t('common.tracks')}
          </span>
          {#if (pl.play_count || 0) > 0}
            <span class="text-[#3093AA] font-semibold">
              {pl.play_count} plays
            </span>
          {/if}
        </div>
      </div>
    </div>
  {/each}
</div>
