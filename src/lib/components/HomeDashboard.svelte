<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    Play, 
    Pause, 
    Shuffle, 
    Heart, 
    Sparkles, 
    Flame, 
    Users, 
    Disc3, 
    Music2, 
    TrendingUp,
    Clock,
    Plus,
    Check
  } from '@lucide/svelte';
  import { 
    allTracks, 
    playlists, 
    favoriteTrackIds, 
    recentTracks, 
    libraryActions 
  } from '../stores/libraryStore';
  import { playerActions, isPlaying, currentTrack } from '../stores/playerStore';
  import { syncEngine } from '../services/syncEngine';
  import { t } from '../i18n';
  import type { Track, Playlist, CommunityTrendingPlaylist, QuickAccessItem } from '../types';

  // Filtro ativo: 'all' (Tudo) | 'music' (Música) | 'community' (Comunidade)
  let activePill = $state<'all' | 'music' | 'community'>('all');

  // Estado das playlists da comunidade
  let communityPlaylists = $state<CommunityTrendingPlaylist[]>([]);
  let isLoadingCommunity = $state<boolean>(true);

  onMount(async () => {
    try {
      communityPlaylists = await syncEngine.fetchCommunityTrending(10);
    } catch (e) {
      console.warn('[Pulsar Home] Falha ao carregar tendências da comunidade:', e);
    } finally {
      isLoadingCommunity = false;
    }
  });

  // Músicas favoritas
  let favoriteTracksList = $derived(
    $allTracks.filter(t => $favoriteTrackIds.has(t.id))
  );

  // Faixa ou Playlist em destaque para o Hero Banner
  let heroItem = $derived.by(() => {
    if ($playlists.length > 0) {
      const topPl = $playlists[0];
      return {
        id: topPl.id,
        badge: 'PLAYLIST EM ALTA',
        title: topPl.name,
        subtitle: topPl.description || 'Os maiores sucessos e batidas imersivas no Pulsar',
        cover: topPl.cover_image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
        type: 'playlist' as const,
        data: topPl
      };
    }
    return {
      badge: 'DESTAQUE PULSAR',
      title: 'Vibe Coding & Focus',
      subtitle: 'Batidas imersivas para programar no fluxo contínuo sem anúncios.',
      cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
      type: 'playlist' as const,
      data: null
    };
  });

  // Grid Rápido 2x4 (Quick Access Items)
  let quickAccessItems = $derived.by<QuickAccessItem[]>(() => {
    const items: QuickAccessItem[] = [];

    // 1. Músicas Curtidas
    items.push({
      id: 'liked-songs',
      type: 'liked',
      title: $t('home.likedSongs') || 'Músicas Curtidas',
      subtitle: `${favoriteTracksList.length} ${favoriteTracksList.length === 1 ? 'música' : 'músicas'}`,
      cover_image: '',
      track_count: favoriteTracksList.length,
      data: favoriteTracksList
    });

    // 2 a 8. Playlists do usuário e faixas mais recentes
    for (const pl of $playlists.slice(0, 5)) {
      items.push({
        id: pl.id,
        type: 'playlist',
        title: pl.name,
        subtitle: `Playlist • ${pl.track_count} faixas`,
        cover_image: pl.cover_image,
        track_count: pl.track_count,
        data: pl
      });
    }

    // Se faltarem slots para completar 8, preencher com recentes
    if (items.length < 8) {
      for (const trk of $recentTracks) {
        if (items.length >= 8) break;
        if (!items.some(i => i.id === trk.id)) {
          items.push({
            id: trk.id,
            type: 'track',
            title: trk.title,
            subtitle: trk.artist_guess || trk.channel_name,
            cover_image: trk.thumbnail_url || trk.thumbnail || '',
            data: trk
          });
        }
      }
    }

    // Se ainda faltar, preenche com as faixas da biblioteca
    if (items.length < 8) {
      for (const trk of $allTracks) {
        if (items.length >= 8) break;
        if (!items.some(i => i.id === trk.id)) {
          items.push({
            id: trk.id,
            type: 'track',
            title: trk.title,
            subtitle: trk.artist_guess || trk.channel_name,
            cover_image: trk.thumbnail_url || trk.thumbnail || '',
            data: trk
          });
        }
      }
    }

    return items.slice(0, 8);
  });

  // Ação de Play para o Quick Access
  async function handleQuickPlay(item: QuickAccessItem, e: MouseEvent) {
    e.stopPropagation();
    if (item.type === 'liked') {
      if (favoriteTracksList.length > 0) {
        playerActions.playTrack(favoriteTracksList[0], favoriteTracksList);
      }
    } else if (item.type === 'playlist') {
      const pl = item.data as Playlist;
      try {
        const { safeInvoke } = await import('../api/tauri');
        const tracks = await safeInvoke<Track[]>('get_playlist_tracks', { playlistId: pl.id });
        if (tracks && tracks.length > 0) {
          playerActions.playTrack(tracks[0], tracks);
          syncEngine.incrementPlaylistPlay(pl.id);
        } else {
          libraryActions.setActiveView('playlist-detail', pl);
        }
      } catch {
        libraryActions.setActiveView('playlist-detail', pl);
      }
    } else if (item.type === 'track') {
      const trk = item.data as Track;
      playerActions.playTrack(trk, $allTracks);
    }
  }

  function handleQuickClick(item: QuickAccessItem) {
    if (item.type === 'liked') {
      libraryActions.setActiveView('favorites');
    } else if (item.type === 'playlist') {
      libraryActions.setActiveView('playlist-detail', item.data as Playlist);
    } else if (item.type === 'track') {
      playerActions.playTrack(item.data as Track, $allTracks);
    }
  }

  // Ação do Hero Banner
  async function handleHeroPlay() {
    if (heroItem.data) {
      const pl = heroItem.data as Playlist;
      try {
        const { safeInvoke } = await import('../api/tauri');
        const tracks = await safeInvoke<Track[]>('get_playlist_tracks', { playlistId: pl.id });
        if (tracks && tracks.length > 0) {
          playerActions.playTrack(tracks[0], tracks);
          syncEngine.incrementPlaylistPlay(pl.id);
          return;
        }
      } catch {}
    }
    if ($allTracks.length > 0) {
      playerActions.playTrack($allTracks[0], $allTracks);
    }
  }

  function handleHeroShuffle() {
    if ($allTracks.length > 0) {
      const shuffled = [...$allTracks].sort(() => Math.random() - 0.5);
      playerActions.playTrack(shuffled[0], shuffled);
    }
  }
</script>

<div class="flex flex-col gap-8 pb-12 select-none animate-fade-in">
  <!-- 1. HERO BANNER PRINCIPAL (Inspirado no Spotify com Estética Apple Liquid Glass) -->
  <div class="relative w-full rounded-3xl overflow-hidden border border-white/[0.12] shadow-2xl group/hero min-h-[260px] md:min-h-[300px] flex items-end">
    <!-- Imagem de Fundo com Blur Ambiente Profundo e Efeito Paralaxe -->
    <div 
      class="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover/hero:scale-105 filter brightness-75"
      style="background-image: url('{heroItem.cover}');"
    ></div>
    
    <!-- Camada de Vidro Fumê Gradiente Liquid Glass -->
    <div class="absolute inset-0 bg-gradient-to-t from-[#09090D] via-[#09090D]/75 to-transparent"></div>
    <div class="absolute inset-0 bg-gradient-to-r from-[#09090D]/90 via-[#09090D]/40 to-transparent"></div>

    <!-- Conteúdo do Hero -->
    <div class="relative z-10 p-6 md:p-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6 w-full">
      <div class="flex flex-col gap-2.5 max-w-2xl">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-full bg-[#66D7D1]/20 border border-[#66D7D1]/30 text-[10px] font-extrabold uppercase tracking-widest text-[#66D7D1] shadow-sm">
            {heroItem.badge}
          </span>
        </div>

        <h1 class="text-2xl sm:text-4xl md:text-5xl font-black text-[#F2EFEA] tracking-tight drop-shadow-md">
          {heroItem.title}
        </h1>

        <p class="text-xs sm:text-sm text-white/70 font-medium line-clamp-2 drop-shadow">
          {heroItem.subtitle}
        </p>
      </div>

      <!-- Botões de Ação do Hero Banner -->
      <div class="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onclick={handleHeroPlay}
          class="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#66D7D1] to-[#3aa8a2] hover:brightness-110 text-[#09090D] text-xs font-black shadow-lg shadow-[#66D7D1]/25 transition-all active:scale-95 cursor-pointer group/btn"
        >
          <Play class="w-4 h-4 fill-current transition-transform group-hover/btn:scale-110" />
          <span>{$t('home.listenNow') || 'Ouvir Agora'}</span>
        </button>

        <button
          type="button"
          onclick={handleHeroShuffle}
          class="p-3.5 rounded-2xl liquid-glass text-[#F2EFEA]/80 hover:text-white hover:bg-white/[0.1] border border-white/[0.12] transition-all active:scale-95 cursor-pointer"
          title="Modo Aleatório"
        >
          <Shuffle class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>

  <!-- 2. PÍLULAS DE FILTRO (Tudo | Música | Comunidade) -->
  <div class="flex items-center gap-2.5">
    <button
      type="button"
      onclick={() => activePill = 'all'}
      class="px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer {activePill === 'all' ? 'bg-[#F2EFEA] text-[#09090D] shadow-md scale-105' : 'bg-white/[0.06] text-[#F2EFEA]/70 hover:bg-white/[0.1] hover:text-white border border-white/[0.08]'}"
    >
      {$t('home.pillsAll') || 'Tudo'}
    </button>

    <button
      type="button"
      onclick={() => activePill = 'music'}
      class="px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer {activePill === 'music' ? 'bg-[#F2EFEA] text-[#09090D] shadow-md scale-105' : 'bg-white/[0.06] text-[#F2EFEA]/70 hover:bg-white/[0.1] hover:text-white border border-white/[0.08]'}"
    >
      {$t('home.pillsMusic') || 'Música'}
    </button>

    <button
      type="button"
      onclick={() => activePill = 'community'}
      class="px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 {activePill === 'community' ? 'bg-[#66D7D1] text-[#09090D] shadow-md shadow-[#66D7D1]/20 scale-105' : 'bg-white/[0.06] text-[#F2EFEA]/70 hover:bg-white/[0.1] hover:text-white border border-white/[0.08]'}"
    >
      <Users class="w-3.5 h-3.5" />
      <span>{$t('home.pillsCommunity') || 'Comunidade'}</span>
    </button>
  </div>

  <!-- 3. GRID RÁPIDO 2x4 (QUICK ACCESS) - Exibido em 'Tudo' e 'Música' -->
  {#if activePill === 'all' || activePill === 'music'}
    <section class="flex flex-col gap-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {#each quickAccessItems as item (item.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            onclick={() => handleQuickClick(item)}
            class="group/card relative flex items-center rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] hover:border-white/[0.15] shadow-md transition-all duration-300 overflow-hidden cursor-pointer backdrop-blur-md"
          >
            <!-- Capa do Card -->
            {#if item.type === 'liked'}
              <!-- Card Especial Gradiente para Músicas Curtidas -->
              <div class="w-16 h-16 bg-gradient-to-br from-[#4b3582] via-[#5c33a2] to-[#66D7D1] flex items-center justify-center shrink-0 shadow-inner">
                <Heart class="w-7 h-7 text-white fill-white drop-shadow" />
              </div>
            {:else}
              <img
                src={item.cover_image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=150&auto=format&fit=crop&q=80'}
                alt={item.title}
                class="w-16 h-16 object-cover shrink-0 shadow-sm"
              />
            {/if}

            <!-- Informações do Card -->
            <div class="flex-1 min-w-0 px-3.5 flex flex-col justify-center">
              <span class="text-xs font-bold text-[#F2EFEA] truncate group-hover/card:text-white transition-colors">
                {item.title}
              </span>
              {#if item.subtitle}
                <span class="text-[11px] text-white/40 truncate">
                  {item.subtitle}
                </span>
              {/if}
            </div>

            <!-- Botão de Play Flutuante Circular com Efeito Hover (1 Clique) -->
            <div class="pr-3 opacity-0 translate-x-2 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all duration-300">
              <button
                type="button"
                onclick={(e) => handleQuickPlay(item, e)}
                class="w-10 h-10 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-[#09090D] flex items-center justify-center shadow-lg shadow-black/50 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                title="Tocar"
              >
                <Play class="w-4 h-4 fill-current ml-0.5" />
              </button>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- 4. SEÇÃO: MAIS OUVIDAS POR VOCÊ (Playlists do Usuário) -->
  {#if activePill === 'all' || activePill === 'music'}
    <section class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-[#F2EFEA] tracking-tight">
            {$t('home.topPlayed') || 'Mais Ouvidas por Você'}
          </h2>
          <p class="text-xs text-white/40">Suas coleções mais frequentes no Pulsar</p>
        </div>
      </div>

      <div class="flex gap-4 overflow-x-auto pb-3 custom-scrollbar">
        {#each $playlists as pl (pl.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            onclick={() => libraryActions.setActiveView('playlist-detail', pl)}
            class="group/pl flex flex-col gap-3 p-3.5 rounded-3xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 w-44 sm:w-48 shrink-0 cursor-pointer backdrop-blur-md"
          >
            <!-- Capa Quadrada com Botão Flutuante -->
            <div class="relative w-full aspect-square rounded-2xl overflow-hidden shadow-lg border border-white/[0.08]">
              <img
                src={pl.cover_image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80'}
                alt={pl.name}
                class="w-full h-full object-cover transition-transform duration-500 group-hover/pl:scale-105"
              />
              <button
                type="button"
                onclick={async (e) => {
                  e.stopPropagation();
                  try {
                    const { safeInvoke } = await import('../api/tauri');
                    const tracks = await safeInvoke<Track[]>('get_playlist_tracks', { playlistId: pl.id });
                    if (tracks && tracks.length > 0) {
                      playerActions.playTrack(tracks[0], tracks);
                      syncEngine.incrementPlaylistPlay(pl.id);
                    }
                  } catch {}
                }}
                class="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-[#09090D] flex items-center justify-center shadow-xl shadow-black/60 opacity-0 translate-y-2 group-hover/pl:opacity-100 group-hover/pl:translate-y-0 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
                title="Tocar Playlist"
              >
                <Play class="w-4 h-4 fill-current ml-0.5" />
              </button>
            </div>

            <!-- Título e Descrição -->
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-bold text-[#F2EFEA] truncate group-hover/pl:text-white">
                {pl.name}
              </h3>
              <p class="text-[11px] text-white/40 line-clamp-2">
                {pl.description || `Playlist • ${pl.track_count} faixas`}
              </p>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- 5. SEÇÃO: EM ALTA NA COMUNIDADE (Supabase Public Playlists) -->
  {#if activePill === 'all' || activePill === 'community'}
    <section class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-bold text-[#F2EFEA] tracking-tight">
              {$t('home.communityTrending') || 'Em Alta na Comunidade'}
            </h2>
            <span class="px-2 py-0.5 rounded-full bg-[#66D7D1]/15 text-[#66D7D1] text-[9px] font-black uppercase">
              Supabase Cloud
            </span>
          </div>
          <p class="text-xs text-white/40">
            {$t('home.communityTrendingDesc') || 'Playlists mais ouvidas e seguidas criadas por outros usuários'}
          </p>
        </div>
      </div>

      {#if isLoadingCommunity}
        <!-- Skeleton Loaders em Liquid Glass -->
        <div class="flex gap-4 overflow-x-hidden pb-3">
          {#each [1, 2, 3, 4, 5] as _}
            <div class="flex flex-col gap-3 p-3.5 rounded-3xl bg-white/[0.02] border border-white/[0.05] w-44 sm:w-48 shrink-0 animate-pulse">
              <div class="w-full aspect-square rounded-2xl bg-white/[0.05]"></div>
              <div class="h-3 w-3/4 bg-white/[0.05] rounded-md"></div>
              <div class="h-2 w-1/2 bg-white/[0.05] rounded-md"></div>
            </div>
          {/each}
        </div>
      {:else if communityPlaylists.length === 0}
        <div class="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] text-center flex flex-col items-center justify-center gap-2">
          <Users class="w-8 h-8 text-white/30" />
          <p class="text-xs text-white/50">Nenhuma playlist da comunidade em destaque no momento.</p>
          <p class="text-[11px] text-white/30">Crie playlists e defina-as como Públicas para vê-las aqui!</p>
        </div>
      {:else}
        <div class="flex gap-4 overflow-x-auto pb-3 custom-scrollbar">
          {#each communityPlaylists as cp (cp.id)}
            <div class="group/cp flex flex-col gap-3 p-3.5 rounded-3xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 w-44 sm:w-48 shrink-0 backdrop-blur-md">
              <!-- Capa da Playlist da Comunidade -->
              <div class="relative w-full aspect-square rounded-2xl overflow-hidden shadow-lg border border-white/[0.08]">
                <img
                  src={cp.cover_image_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80'}
                  alt={cp.name}
                  class="w-full h-full object-cover transition-transform duration-500 group-hover/cp:scale-105"
                />
              </div>

              <!-- Info & Criador -->
              <div class="flex flex-col gap-1">
                <h3 class="text-xs font-bold text-[#F2EFEA] truncate group-hover/cp:text-[#66D7D1] transition-colors">
                  {cp.name}
                </h3>
                
                <div class="flex items-center gap-1.5 text-[10px] text-white/40">
                  {#if cp.owner_avatar_url}
                    <img src={cp.owner_avatar_url} alt={cp.owner_username} class="w-3.5 h-3.5 rounded-full object-cover" />
                  {/if}
                  <span class="truncate">Por {cp.owner_display_name || cp.owner_username || 'Usuário Pulsar'}</span>
                </div>

                <div class="flex items-center gap-2 pt-1 text-[10px] text-white/30">
                  <span>{cp.track_count || 0} músicas</span>
                  <span>•</span>
                  <span>{cp.play_count || 0} plays</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>
