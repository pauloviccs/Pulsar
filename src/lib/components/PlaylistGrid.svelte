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
      playerActions.playTrack(tracks[0], tracks);
    } else {
      openPlaylist(pl);
    }
  }
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 select-none">
  {#each playlists as pl (pl.id)}
    <div
      role="button"
      tabindex="0"
      onclick={() => openPlaylist(pl)}
      onkeydown={(e) => { if (e.key === 'Enter') openPlaylist(pl); }}
      class="liquid-card rounded-3xl p-4 flex flex-col gap-3.5 group cursor-pointer border border-white/[0.1] hover:border-[#66D7D1]/40 transition-all duration-300"
    >
      <!-- Capa 1:1 com botão de Play flutuante -->
      <div class="relative aspect-square w-full rounded-2xl overflow-hidden shadow-lg border border-white/[0.12] bg-black/40">
        <img
          src={pl.cover_image}
          alt={pl.name}
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        <!-- Hover Overlay com Play Apple Style -->
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
          <button
            type="button"
            onclick={(e) => handleQuickPlay(e, pl)}
            aria-label="Reproduzir playlist {pl.name}"
            class="w-13 h-13 rounded-full bg-[#FC7753] hover:bg-[#FC7753]/90 text-white flex items-center justify-center shadow-xl shadow-[#FC7753]/50 transform translate-y-2 group-hover:translate-y-0 transition-transform cursor-pointer"
          >
            <Play class="w-6 h-6 fill-current ml-0.5" />
          </button>
        </div>

        {#if pl.is_imported_youtube_playlist}
          <div class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/[0.12] text-[9px] font-bold text-[#66D7D1] tracking-wider uppercase">
            YouTube
          </div>
        {/if}
      </div>

      <!-- Info da Playlist -->
      <div class="flex flex-col gap-1 px-0.5">
        <h3 class="text-sm font-bold text-[#F2EFEA] truncate group-hover:text-[#66D7D1] transition-colors tracking-tight">
          {pl.name}
        </h3>
        <p class="text-xs text-[#F2EFEA]/50 line-clamp-2 leading-relaxed">
          {pl.description || $t('playlistDetail.localAudioDesc')}
        </p>

        <div class="flex items-center gap-3 text-[11px] text-[#F2EFEA]/40 pt-2.5 border-t border-white/[0.06] font-medium">
          <span class="flex items-center gap-1.5">
            <ListMusic class="w-3.5 h-3.5 text-[#66D7D1]" />
            {pl.track_count} {$t('common.tracks')}
          </span>
          {#if pl.total_duration_seconds > 0}
            <span class="flex items-center gap-1.5">
              <Clock class="w-3.5 h-3.5 text-[#DBD56E]" />
              {Math.floor(pl.total_duration_seconds / 60)} {$t('common.minutes')}
            </span>
          {/if}
        </div>
      </div>
    </div>
  {/each}
</div>
