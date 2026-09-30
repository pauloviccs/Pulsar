<script lang="ts">
  import { Play, ListMusic, Clock, Plus, Link2, Pin } from '@lucide/svelte';
  import type { Playlist } from '../types';
  import { libraryActions, selectedPlaylistTracks, isNewPlaylistModalOpen, isAddLinkModalOpen } from '../stores/libraryStore';
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

{#if playlists.length === 0}
  <div class="lq-surface-panel rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center text-center gap-5 border border-white/[0.08] shadow-2xl w-full my-4">
    <div class="w-16 h-16 rounded-2xl lq-glass-pill flex items-center justify-center text-[#3093AA] shadow-inner border border-white/[0.12]">
      <ListMusic class="w-8 h-8 opacity-80" />
    </div>

    <div class="flex flex-col gap-1.5 max-w-md">
      <h3 class="text-base sm:text-lg font-bold text-[#F0F0F5] tracking-tight">
        Sua biblioteca de playlists está pronta
      </h3>
      <p class="text-xs sm:text-sm text-white/50 leading-relaxed">
        Você não possui nenhuma playlist criada ainda. Comece organizando suas músicas favoritas ou importe álbuns e playlists do YouTube e Spotify.
      </p>
    </div>

    <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
      <button
        type="button"
        onclick={() => isNewPlaylistModalOpen.set(true)}
        class="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#EF7D4B] hover:bg-[#EF7D4B]/90 text-white font-bold text-xs shadow-lg shadow-[#EF7D4B]/30 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
      >
        <Plus class="w-4 h-4" />
        <span>Criar Playlist</span>
      </button>

      <button
        type="button"
        onclick={() => isAddLinkModalOpen.set(true)}
        class="flex items-center gap-2 px-4 py-2.5 rounded-full lq-glass-pill hover:bg-white/[0.1] text-[#3093AA] hover:text-white font-semibold text-xs border border-white/[0.12] hover:border-[#3093AA]/40 transition cursor-pointer"
      >
        <Link2 class="w-4 h-4" />
        <span>Importar Link</span>
      </button>
    </div>
  </div>
{:else}
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

        <!-- Botão de Fixar / Desafixar direto no card -->
        <button
          type="button"
          onclick={(e) => { e.stopPropagation(); libraryActions.togglePinPlaylist(pl.id); }}
          class="absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-md border transition-all z-20 cursor-pointer shadow-md {pl.is_pinned ? 'bg-[#3093AA] text-white border-white/30' : 'bg-black/60 text-white/60 hover:text-white hover:bg-black/80 border-white/15 opacity-0 group-hover:opacity-100'}"
          title={pl.is_pinned ? 'Desafixar playlist' : 'Fixar playlist no topo da biblioteca'}
        >
          <Pin class="w-3.5 h-3.5 {pl.is_pinned ? 'fill-current rotate-45 text-white' : ''}" />
        </button>

        {#if pl.is_pinned}
          <div class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-[#3093AA]/90 backdrop-blur-md border border-white/[0.2] text-[9px] font-bold text-white tracking-wider flex items-center gap-1 shadow-md z-10">
            <Pin class="w-2.5 h-2.5 fill-current text-white" />
            <span>Fixada</span>
          </div>
        {:else if pl.is_followed}
          <div class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-[#3093AA]/80 backdrop-blur-md border border-white/[0.2] text-[9px] font-bold text-white tracking-wider z-10">
            Seguindo
          </div>
        {:else if pl.is_imported_youtube_playlist}
          <div class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/[0.12] text-[9px] font-bold text-[#EF7D4B] tracking-wider uppercase z-10">
            YouTube
          </div>
        {/if}

        {#if pl.is_pinned && pl.is_imported_youtube_playlist}
          <div class="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/[0.12] text-[9px] font-bold text-[#EF7D4B] tracking-wider uppercase z-10">
            YouTube
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
{/if}
