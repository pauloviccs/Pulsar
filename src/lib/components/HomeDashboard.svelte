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
  import { isSocialDrawerOpen } from '../stores/socialStore';
  import { syncEngine } from '../services/syncEngine';
  import { t } from '../i18n';
  import type { Track, Playlist, CommunityTrendingPlaylist, QuickAccessItem } from '../types';

  // Filtro ativo: 'all' (Tudo) | 'music' (Música) | 'community' (Comunidade)
  let activePill = $state<'all' | 'music' | 'community'>('all');

  // Estado das playlists da comunidade
  let communityPlaylists = $state<CommunityTrendingPlaylist[]>([]);
  let isLoadingCommunity = $state<boolean>(true);
  let isCommunityExpanded = $state<boolean>(false);
  let isFetchingAllCommunity = $state<boolean>(false);

  onMount(async () => {
    try {
      communityPlaylists = await syncEngine.fetchCommunityTrending(12);
    } catch (e) {
      console.warn('[Pulsar Home] Falha ao carregar tendências da comunidade:', e);
    } finally {
      isLoadingCommunity = false;
    }
  });

  async function toggleExpandCommunity() {
    isCommunityExpanded = !isCommunityExpanded;
    if (isCommunityExpanded && communityPlaylists.length <= 12) {
      isFetchingAllCommunity = true;
      try {
        const fullList = await syncEngine.fetchCommunityTrending(50);
        if (fullList && fullList.length > 0) {
          communityPlaylists = fullList;
        }
      } catch (err) {
        console.warn('[Pulsar] Erro ao expandir comunidade:', err);
      } finally {
        isFetchingAllCommunity = false;
      }
    }
  }

  // Sincroniza em tempo real a contagem de plays com a store local se disponível
  function getCommunityPlayCount(cp: CommunityTrendingPlaylist): number {
    const local = $playlists.find(p => p.id === cp.id);
    if (local && local.play_count !== undefined && local.play_count > (cp.play_count || 0)) {
      return local.play_count;
    }
    return cp.play_count || 0;
  }

  async function handlePlayCommunityPlaylist(cp: CommunityTrendingPlaylist, e?: MouseEvent) {
    if (e) e.stopPropagation();
    try {
      const tracks = await syncEngine.fetchPlaylistTracks(cp.id);
      if (tracks && tracks.length > 0) {
        playerActions.playTrack(tracks[0], tracks);
        await syncEngine.incrementPlaylistPlay(cp.id);
        cp.play_count = (cp.play_count || 0) + 1;
        playlists.update(items => items.map(p => p.id === cp.id ? { ...p, play_count: (p.play_count || 0) + 1 } : p));
      }
    } catch (err) {
      console.error('[Pulsar] Erro ao reproduzir playlist da comunidade:', err);
    }
  }

  async function handleOpenCommunityPlaylist(cp: CommunityTrendingPlaylist) {
    const localMatch = $playlists.find(p => p.id === cp.id);
    const pl: Playlist = {
      id: cp.id,
      name: cp.name,
      description: cp.description || '',
      cover_image: cp.cover_image_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
      created_at: cp.created_at || new Date().toISOString(),
      is_imported_youtube_playlist: false,
      track_count: cp.track_count || 0,
      total_duration_seconds: 0,
      visibility: 'public',
      user_id: cp.owner_id,
      owner_name: cp.owner_display_name || cp.owner_username,
      owner_username: cp.owner_username,
      owner_avatar_url: cp.owner_avatar_url,
      play_count: localMatch?.play_count ?? cp.play_count ?? 0
    };
    await libraryActions.setActiveView('playlist-detail', pl);
  }

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
        let tracks = await safeInvoke<Track[]>('get_playlist_tracks', { playlistId: pl.id });
        if (!tracks || tracks.length === 0) {
          tracks = await syncEngine.fetchPlaylistTracks(pl.id);
        }
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
        let tracks = await safeInvoke<Track[]>('get_playlist_tracks', { playlistId: pl.id });
        if (!tracks || tracks.length === 0) {
          tracks = await syncEngine.fetchPlaylistTracks(pl.id);
        }
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
  <!-- 1. HERO BANNER PRINCIPAL CINEMATOGRÁFICO (LIQUID GLASS 3D) -->
  <div class="relative w-full lq-hero-glass overflow-hidden shadow-2xl group/hero min-h-[280px] md:min-h-[320px] flex items-end">
    <!-- Imagem de Fundo com Blur Ambiente Profundo e Efeito Paralaxe -->
    <div 
      class="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover/hero:scale-105 filter brightness-70"
      style="background-image: url('{heroItem.cover}');"
    ></div>
    
    <!-- Camada de Vidro Fumê Gradiente Liquid Glass com Acentos de Luz Cáustica -->
    <div class="absolute inset-0 bg-gradient-to-t from-[#0B1020] via-[#0B1020]/75 to-transparent"></div>
    <div class="absolute inset-0 bg-gradient-to-r from-[#0B1020]/90 via-[#0B1020]/45 to-transparent"></div>
    <div class="absolute -top-16 -right-16 w-96 h-96 rounded-full bg-[#EF7D4B]/20 blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-16 -left-16 w-96 h-96 rounded-full bg-[#3093AA]/20 blur-3xl pointer-events-none"></div>

    <!-- Conteúdo do Hero com Tipografia Display Outfit -->
    <div class="relative z-10 p-6 md:p-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6 w-full">
      <div class="flex flex-col gap-3 max-w-2xl">
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full bg-white/[0.10] border border-white/[0.18] backdrop-blur-md text-[10px] font-black tracking-widest text-[#3093AA] uppercase shadow-sm">
            {heroItem.badge}
          </span>
        </div>

        <h1 class="text-3xl sm:text-5xl md:text-6xl font-black text-white font-display tracking-tight drop-shadow-lg">
          {heroItem.title}
        </h1>

        <p class="text-xs sm:text-sm text-white/75 font-medium line-clamp-2 drop-shadow max-w-lg">
          {heroItem.subtitle}
        </p>
      </div>

      <!-- Botões de Ação do Hero Banner (Coral Luminoso Pulsar) -->
      <div class="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onclick={handleHeroPlay}
          class="flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#EF7D4B] via-[#EF7D4B] to-[#F3B044] hover:brightness-110 text-white text-xs font-black shadow-[0_8px_30px_rgba(239,125,75,0.4)] border border-white/25 transition-all active:scale-95 cursor-pointer group/btn hover:scale-105"
        >
          <Play class="w-4 h-4 fill-current transition-transform group-hover/btn:scale-110" />
          <span>{$t('home.listenNow') || 'Ouvir Agora'}</span>
        </button>

        <button
          type="button"
          onclick={handleHeroShuffle}
          class="p-3.5 rounded-full lq-glass-pill text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer"
          title="Modo Aleatório"
        >
          <Shuffle class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>

  <!-- 2. PÍLULAS DE FILTRO EM VIDRO (Tudo | Música | Comunidade) -->
  <div class="flex items-center gap-2.5">
    <button
      type="button"
      onclick={() => activePill = 'all'}
      class="px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer {activePill === 'all' ? 'bg-white text-[#0B1020] shadow-[0_4px_20px_rgba(255,255,255,0.35)] scale-105 font-black' : 'lq-glass-pill text-white/70 hover:text-white'}"
    >
      {$t('home.pillsAll') || 'Tudo'}
    </button>

    <button
      type="button"
      onclick={() => activePill = 'music'}
      class="px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer {activePill === 'music' ? 'bg-white text-[#0B1020] shadow-[0_4px_20px_rgba(255,255,255,0.35)] scale-105 font-black' : 'lq-glass-pill text-white/70 hover:text-white'}"
    >
      {$t('home.pillsMusic') || 'Música'}
    </button>

    <button
      type="button"
      onclick={() => activePill = 'community'}
      class="px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 {activePill === 'community' ? 'bg-gradient-to-r from-[#3093AA] to-[#097198] text-white shadow-[0_4px_20px_rgba(48,147,170,0.4)] scale-105 font-black border border-white/20' : 'lq-glass-pill text-white/70 hover:text-white'}"
    >
      <Users class="w-3.5 h-3.5" />
      <span>{$t('home.pillsCommunity') || 'Comunidade'}</span>
    </button>
  </div>

  <!-- 3. GRID RÁPIDO 2x4 (QUICK ACCESS EM LIQUID CARDS) -->
  {#if activePill === 'all' || activePill === 'music'}
    <section class="flex flex-col gap-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {#each quickAccessItems as item (item.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            onclick={() => handleQuickClick(item)}
            class="group/card relative flex items-center rounded-2xl liquid-card shadow-md transition-all duration-300 overflow-hidden cursor-pointer p-1"
          >
            <!-- Capa do Card -->
            {#if item.type === 'liked'}
              <!-- Card Especial Gradiente para Músicas Curtidas -->
              <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-[#EF7D4B] via-[#F3B044] to-[#3093AA] flex items-center justify-center shrink-0 shadow-inner m-1">
                <Heart class="w-6 h-6 text-white fill-white drop-shadow" />
              </div>
            {:else}
              <img
                src={item.cover_image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=150&auto=format&fit=crop&q=80'}
                alt={item.title}
                class="w-14 h-14 rounded-xl object-cover shrink-0 shadow-sm m-1"
              />
            {/if}

            <!-- Informações do Card -->
            <div class="flex-1 min-w-0 px-3 flex flex-col justify-center">
              <span class="text-xs font-bold text-[#F0F0F5] truncate group-hover/card:text-white transition-colors">
                {item.title}
              </span>
              {#if item.subtitle}
                <span class="text-[11px] text-white/50 truncate font-medium">
                  {item.subtitle}
                </span>
              {/if}
            </div>

            <!-- Botão de Play Flutuante Circular com Efeito Hover (1 Clique) -->
            <div class="pr-2.5 opacity-0 translate-x-2 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all duration-300">
              <button
                type="button"
                onclick={(e) => handleQuickPlay(item, e)}
                class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#EF7D4B] to-[#F3B044] text-white flex items-center justify-center shadow-lg shadow-black/60 transition-transform hover:scale-110 active:scale-95 cursor-pointer border border-white/20"
                title="Tocar"
              >
                <Play class="w-3.5 h-3.5 fill-current ml-0.5" />
              </button>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- 4. SEÇÃO: MAIS OUVIDAS POR VOCÊ (Playlists do Usuário em Liquid Cards) -->
  {#if activePill === 'all' || activePill === 'music'}
    <section class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-[#F0F0F5] tracking-tight">
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
            class="group/pl flex flex-col gap-3 p-3.5 rounded-3xl liquid-card transition-all duration-300 w-44 sm:w-48 shrink-0 cursor-pointer"
          >
            <!-- Capa Quadrada com Botão Flutuante -->
            <div class="relative w-full aspect-square rounded-2xl overflow-hidden shadow-lg border border-white/[0.12]">
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
                    let tracks = await safeInvoke<Track[]>('get_playlist_tracks', { playlistId: pl.id });
                    if (!tracks || tracks.length === 0) {
                      tracks = await syncEngine.fetchPlaylistTracks(pl.id);
                    }
                    if (tracks && tracks.length > 0) {
                      playerActions.playTrack(tracks[0], tracks);
                      syncEngine.incrementPlaylistPlay(pl.id);
                    }
                  } catch {}
                }}
                class="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-gradient-to-tr from-[#EF7D4B] to-[#F3B044] text-white flex items-center justify-center shadow-xl shadow-black/70 opacity-0 translate-y-2 group-hover/pl:opacity-100 group-hover/pl:translate-y-0 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer border border-white/20"
                title="Tocar Playlist"
              >
                <Play class="w-4 h-4 fill-current ml-0.5" />
              </button>
            </div>

            <!-- Título e Descrição -->
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-bold text-[#F0F0F5] truncate group-hover/pl:text-white">
                {pl.name}
              </h3>
              <p class="text-[11px] text-white/50 line-clamp-2">
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
            <h2 class="text-lg font-bold text-[#F0F0F5] tracking-tight">
              {$t('home.communityTrending') || 'Em Alta na Comunidade'}
            </h2>
            <span class="px-2 py-0.5 rounded-full bg-[#3093AA]/15 text-[#3093AA] text-[9px] font-black uppercase">
              Supabase Cloud
            </span>
          </div>
          <p class="text-xs text-white/40">
            {$t('home.communityTrendingDesc') || 'Playlists mais ouvidas e seguidas criadas por outros usuários'}
          </p>
        </div>

        {#if communityPlaylists.length > 0}
          <button
            type="button"
            onclick={toggleExpandCommunity}
            class="text-xs font-bold text-white/60 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/[0.08] active:scale-95"
          >
            <span>{isCommunityExpanded ? 'Mostrar menos' : 'Mostrar tudo'}</span>
            {#if isFetchingAllCommunity}
              <span class="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
            {/if}
          </button>
        {/if}
      </div>

      {#snippet communityCard(cp: CommunityTrendingPlaylist)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          onclick={() => handleOpenCommunityPlaylist(cp)}
          class="group/cp flex flex-col gap-3 p-3.5 rounded-3xl liquid-card transition-all duration-300 {isCommunityExpanded ? 'w-full' : 'w-44 sm:w-48 shrink-0'} cursor-pointer hover:border-[#3093AA]/40"
        >
          <!-- Capa da Playlist da Comunidade com Botão Play -->
          <div class="relative w-full aspect-square rounded-2xl overflow-hidden shadow-lg border border-white/[0.12]">
            <img
              src={cp.cover_image_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80'}
              alt={cp.name}
              class="w-full h-full object-cover transition-transform duration-500 group-hover/cp:scale-105"
            />
            <button
              type="button"
              onclick={(e) => handlePlayCommunityPlaylist(cp, e)}
              class="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-gradient-to-tr from-[#EF7D4B] to-[#F3B044] text-white flex items-center justify-center shadow-xl shadow-black/70 opacity-0 translate-y-2 group-hover/cp:opacity-100 group-hover/cp:translate-y-0 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer border border-white/20"
              title="Tocar Playlist da Comunidade"
            >
              <Play class="w-4 h-4 fill-current ml-0.5" />
            </button>
          </div>

          <!-- Info & Criador -->
          <div class="flex flex-col gap-1 min-w-0">
            <h3 class="text-xs font-bold text-[#F0F0F5] truncate group-hover/cp:text-[#3093AA] transition-colors">
              {cp.name}
            </h3>
            
            <div class="flex items-center gap-1.5 text-[10px] text-white/60">
              {#if cp.owner_avatar_url}
                <img src={cp.owner_avatar_url} alt={cp.owner_username} class="w-3.5 h-3.5 rounded-full object-cover shrink-0 border border-white/20" />
              {:else}
                <div class="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-black text-white shrink-0">
                  {(cp.owner_display_name || cp.owner_username || 'P')[0]?.toUpperCase()}
                </div>
              {/if}
              <span class="truncate">Por {cp.owner_display_name || cp.owner_username || 'Usuário Pulsar'}</span>
            </div>

            <div class="flex items-center gap-2 pt-0.5 text-[10px] text-white/40">
              <span>{cp.track_count || 0} músicas</span>
              <span>•</span>
              <span class="text-white/60 font-medium">{getCommunityPlayCount(cp)} plays</span>
            </div>
          </div>
        </div>
      {/snippet}

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
      {:else if isCommunityExpanded}
        <!-- Grid expandido estilo Spotify com transição limpa -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {#each communityPlaylists as cp (cp.id)}
            {@render communityCard(cp)}
          {/each}
        </div>
      {:else}
        <!-- Carrossel horizontal padrão -->
        <div class="flex gap-4 overflow-x-auto pb-3 custom-scrollbar">
          {#each communityPlaylists as cp (cp.id)}
            {@render communityCard(cp)}
          {/each}
        </div>
      {/if}

      {#if activePill === 'community'}
        <div class="mt-4 p-5 rounded-3xl bg-gradient-to-r from-[#3093AA]/10 via-white/[0.02] to-[#3093AA]/5 border border-[#3093AA]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-2xl bg-[#3093AA]/20 border border-[#3093AA]/30 flex items-center justify-center shrink-0">
              <Users class="w-5 h-5 text-[#3093AA]" />
            </div>
            <div>
              <h3 class="text-xs sm:text-sm font-bold text-[#F0F0F5]">Rede Social Pulsar & Amigos</h3>
              <p class="text-[11px] sm:text-xs text-white/50">Veja o que seus amigos estão ouvindo em tempo real e compartilhe faixas.</p>
            </div>
          </div>
          <button
            type="button"
            onclick={() => isSocialDrawerOpen.set(true)}
            class="px-4 py-2 rounded-xl bg-[#3093AA] hover:brightness-110 text-white text-xs font-black transition-all shadow-md shadow-[#3093AA]/20 active:scale-95 cursor-pointer shrink-0"
          >
            Abrir Painel Social
          </button>
        </div>
      {/if}
    </section>
  {/if}
</div>
