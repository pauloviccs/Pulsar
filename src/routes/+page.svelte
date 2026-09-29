<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    Search, 
    Plus, 
    Play, 
    Shuffle, 
    Trash2, 
    ArrowLeft, 
    Sparkles, 
    Disc3, 
    Music, 
    Heart, 
    Clock, 
    Radio,
    Edit3,
    Camera,
    Menu,
    Globe,
    Lock,
    Share2,
    Bookmark,
    Check
  } from '@lucide/svelte';

  import SplashScreen from '$lib/components/SplashScreen.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import HomeDashboard from '$lib/components/HomeDashboard.svelte';
  import TopProfileButton from '$lib/components/TopProfileButton.svelte';
  import BottomPlayerBar from '$lib/components/BottomPlayerBar.svelte';
  import TrackList from '$lib/components/TrackList.svelte';
  import PlaylistGrid from '$lib/components/PlaylistGrid.svelte';
  import HeroSlider from '$lib/components/HeroSlider.svelte';
  import LinkInputModal from '$lib/components/LinkInputModal.svelte';
  import NewPlaylistModal from '$lib/components/NewPlaylistModal.svelte';
  import NowPlayingView from '$lib/components/NowPlayingView.svelte';
  import QueueDrawer from '$lib/components/QueueDrawer.svelte';
  import DeletePlaylistModal from '$lib/components/DeletePlaylistModal.svelte';
  import EditPlaylistModal from '$lib/components/EditPlaylistModal.svelte';
  import MiniPlayerView from '$lib/components/MiniPlayerView.svelte';
  import GlobalAudioEngine from '$lib/components/GlobalAudioEngine.svelte';
  import UserProfileView from '$lib/components/UserProfileView.svelte';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import EditProfileModal from '$lib/components/EditProfileModal.svelte';
  import SocialDrawer from '$lib/components/SocialDrawer.svelte';
  import DirectChatModal from '$lib/components/DirectChatModal.svelte';
  import SettingsView from '$lib/components/SettingsView.svelte';
  import UpdateModal from '$lib/components/UpdateModal.svelte';
  import UpdateToast from '$lib/components/UpdateToast.svelte';
  import { updateActions } from '$lib/stores/updateStore';

  import { 
    allTracks, 
    playlists, 
    userLibraryPlaylists,
    favoriteTrackIds, 
    activeView, 
    selectedPlaylist, 
    selectedPlaylistTracks,
    recentTracks, 
    searchQuery, 
    filteredTracks, 
    libraryActions, 
    isAddLinkModalOpen,
    playlistToDelete,
    playlistToEdit
  } from '$lib/stores/libraryStore';
  import { playerActions, isMiniPlayer, currentTrack } from '$lib/stores/playerStore';
  import { authActions, currentUser, currentProfile, isAuthModalOpen } from '$lib/stores/authStore';
  import { socialActions } from '$lib/stores/socialStore';
  import { t, currentLocale } from '$lib/i18n';
  import type { Track } from '$lib/types';

  let searchInput = $state('');
  let isMobileSidebarOpen = $state(false);

  function handleSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    searchInput = val;
    searchQuery.set(val);
  }

  onMount(() => {
    libraryActions.initFromBackend();
    authActions.initAuth();
    const unsub = socialActions.subscribeToRealtime();

    // Verificação de atualização suave em background após 3.5s
    const updateTimer = setTimeout(() => {
      updateActions.checkForUpdates(false);
    }, 3500);

    return () => {
      unsub();
      clearTimeout(updateTimer);
    };
  });

  // Sincroniza a música atual com o status de presença na nuvem
  $effect(() => {
    const prof = $currentProfile;
    if (prof && !prof.id.startsWith('guest')) {
      const artist = $currentTrack?.artist || $currentTrack?.artist_guess || $currentTrack?.channel_name || '';
      const title = $currentTrack ? `${$currentTrack.title} - ${artist}` : null;
      if (prof.current_track_title !== title) {
        authActions.updateStatus(prof.presence_status || 'online', title, artist);
      }
    }
  });

  // Faixas favoritas filtradas
  let favoriteTracks = $derived(
    $allTracks.filter(t => $favoriteTrackIds.has(t.id))
  );

  // Verifica se o usuário atual é dono da playlist selecionada
  let isPlaylistOwner = $derived(
    Boolean(
      $selectedPlaylist && (
        ($currentProfile?.id && $selectedPlaylist.user_id === $currentProfile.id) ||
        (!$selectedPlaylist.user_id && !$currentProfile) // Playlist padrão/local sem dono específico
      )
    )
  );

  // Nome do criador da playlist
  let playlistCreatorName = $derived.by(() => {
    if (!$selectedPlaylist) return '';
    if (isPlaylistOwner) {
      return $currentProfile?.display_name || $currentProfile?.username || 'Você';
    }
    return $selectedPlaylist.owner_name || ($selectedPlaylist.owner_username ? `@${$selectedPlaylist.owner_username}` : 'Pulsar');
  });

  function formatDisplayDate(dateStr?: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString($currentLocale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  function playAllPlaylist(tracks: Track[]) {
    if (tracks.length > 0) {
      playerActions.playTrack(tracks[0], tracks, $selectedPlaylist?.id);
    }
  }

  function shufflePlaylist(tracks: Track[]) {
    if (tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      playerActions.playTrack(shuffled[0], tracks, $selectedPlaylist?.id);
    }
  }

  $effect(() => {
    // Ao mudar de view, fecha a gaveta mobile automaticamente
    const _v = $activeView;
    isMobileSidebarOpen = false;
  });
</script>

<!-- Splash Screen Inicial Animada com a Nova Identidade -->
<SplashScreen />

<!-- Motor de Áudio Persistente Global -->
<GlobalAudioEngine />

{#if $isMiniPlayer}
  <!-- MODO MINI PLAYER FLUTUANTE ULTRA COMPACTO -->
  <div class="w-screen h-screen overflow-hidden bg-[#0B1020]">
    <MiniPlayerView />
  </div>
{:else}
  <!-- LAYOUT PRINCIPAL DO PULSAR EM ILHAS FLUTUANTES (LIQUID GLASS) -->
  <div class="h-screen w-screen flex flex-col p-2 sm:p-3 md:p-3.5 bg-[#070A14] text-[#F0F0F5] select-none overflow-hidden font-sans relative">
    <!-- Malha Dinâmica de Luz Ambiente (Caustic Ambient Glow) -->
    <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div class="absolute -top-[15%] -left-[10%] size-[65vmax] rounded-full opacity-60 lq-ambient-orb-1 transition-all duration-1000"></div>
      <div class="absolute top-[20%] right-[-5%] size-[60vmax] rounded-full opacity-50 lq-ambient-orb-2 transition-all duration-1000"></div>
      <div class="absolute -bottom-[20%] left-[20%] size-[75vmax] rounded-full opacity-45 lq-ambient-orb-3 transition-all duration-1000"></div>
    </div>

    <!-- Layout Principal: Sidebar Flutuante + Ilha de Conteúdo Central -->
    <div class="flex-1 flex min-h-0 gap-2.5 sm:gap-3.5 relative overflow-hidden">
      <!-- Backdrop para Sidebar Mobile -->
      {#if isMobileSidebarOpen}
        <div 
          role="presentation"
          class="fixed inset-0 z-40 bg-black/75 backdrop-blur-xl md:hidden animate-fade-in"
          onclick={() => isMobileSidebarOpen = false}
          onkeydown={(e) => { if (e.key === 'Escape') isMobileSidebarOpen = false; }}
        ></div>
      {/if}

      <!-- Sidebar: Ilha Flutuante de Vidro -->
      <div class="fixed md:static inset-y-0 left-0 z-50 p-2 sm:p-0 transform md:transform-none transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] {isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}">
        <Sidebar />
      </div>

      <!-- Conteúdo Central em Ilha Flutuante de Vidro -->
      <main class="flex-1 flex flex-col min-w-0 lq-floating-island overflow-hidden relative">
        <!-- Top Header com Região de Arraste da Janela e Pílula de Busca Líquida -->
        <header data-tauri-drag-region class="sticky top-0 z-30 pt-3.5 pb-3 px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-4 bg-[#0B1020]/75 backdrop-blur-2xl border-b border-white/[0.08]">
          <!-- Lado Esquerdo: Botão Hamburger (Mobile) + Campo de Busca Liquid Glass -->
          <div class="flex items-center gap-2.5 flex-1 min-w-0 max-w-md">
            <button
              type="button"
              onclick={() => isMobileSidebarOpen = !isMobileSidebarOpen}
              class="md:hidden p-2 rounded-2xl lq-glass-pill text-white/70 hover:text-white shrink-0 cursor-pointer"
              aria-label="Abrir Navegação"
            >
              <Menu class="w-4 h-4" />
            </button>

            <div class="relative w-full flex items-center">
              <Search class="absolute left-3.5 w-4 h-4 text-white/40 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                oninput={handleSearchInput}
                placeholder={$t('search.placeholder')}
                class="w-full py-2 sm:py-2.5 pl-10 pr-4 rounded-full liquid-input text-xs text-[#F0F0F5] placeholder:text-white/35 transition"
              />
            </div>
          </div>

          <!-- Lado Direito: Modal de Perfil com a #tag + Pílula Minimalista de Adicionar Mídia -->
          <div class="flex items-center gap-2 sm:gap-3 shrink-0">
            <TopProfileButton />

            <!-- Pílula de Importação Rápida em Vidro Líquido (YouTube & Spotify) -->
            <button
              type="button"
              onclick={() => isAddLinkModalOpen.set(true)}
              class="lq-glass-pill flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white/90 hover:text-white cursor-pointer group shadow-md"
              title="Importar música ou playlist do YouTube e Spotify"
            >
              <div class="p-1 rounded-full bg-[#EF7D4B]/20 text-[#EF7D4B] group-hover:bg-[#EF7D4B] group-hover:text-white transition-colors">
                <Plus class="w-3.5 h-3.5 transition-transform group-hover:rotate-90 duration-200" />
              </div>
              <span class="hidden sm:inline">{$t('sidebar.addMusic')}</span>
            </button>
          </div>
        </header>

        <!-- View Area Principal com padding e espaço para a Cápsula Flutuante -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6 sm:gap-8 pb-32">
          {#if $activeView === 'home' && !$selectedPlaylist}
            {#if searchInput}
              <!-- Resultados da busca quando na Home -->
              <section class="flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-base font-bold text-[#F0F0F5]">
                      {$t('search.resultsFor', { query: searchInput })}
                    </h3>
                    <p class="text-xs text-white/40">{$t('search.tracksAvailable', { count: $filteredTracks.length })}</p>
                  </div>

                  {#if $filteredTracks.length > 0}
                    <button
                      onclick={() => playAllPlaylist($filteredTracks)}
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl lq-glass-frost hover:bg-white/[0.1] text-xs font-medium transition cursor-pointer"
                    >
                      <Play class="w-3.5 h-3.5 fill-current text-[#3093AA]" />
                      <span>{$t('search.playAll')}</span>
                    </button>
                  {/if}
                </div>

                <div class="bg-[#111827]/70 rounded-3xl p-3 border border-white/[0.08] shadow-lg">
                  <TrackList tracks={$filteredTracks} />
                </div>
              </section>
            {:else}
              <!-- Central Principal / Home Dashboard -->
              <HomeDashboard />
            {/if}

          {:else if $activeView === 'library' && !$selectedPlaylist}
            <!-- Modal Slider / Carrossel de Destaques e Mais Ouvidas -->
            {#if !searchInput}
              <HeroSlider />
            {/if}

            <!-- Seção Playlists -->
            {#if !searchInput}
              <section class="flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-base font-bold text-[#F0F0F5]">{$t('home.featuredPlaylists')}</h3>
                    <p class="text-xs text-white/40">{$t('home.featuredPlaylistsDesc')}</p>
                  </div>
                </div>

                <PlaylistGrid playlists={$userLibraryPlaylists} />
              </section>
            {/if}

            <!-- Seção Faixas -->
            <section class="flex flex-col gap-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-base font-bold text-[#F0F0F5]">
                    {searchInput ? $t('search.resultsFor', { query: searchInput }) : $t('search.allTracks')}
                  </h3>
                  <p class="text-xs text-white/40">{$t('search.tracksAvailable', { count: $filteredTracks.length })}</p>
                </div>

                {#if $filteredTracks.length > 0}
                  <div class="flex items-center gap-2">
                    <button
                      onclick={() => playAllPlaylist($filteredTracks)}
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl lq-glass-frost hover:bg-white/[0.1] text-xs font-medium transition cursor-pointer"
                    >
                      <Play class="w-3.5 h-3.5 fill-current text-[#3093AA]" />
                      <span>{$t('search.playAll')}</span>
                    </button>
                  </div>
                {/if}
              </div>

              <div class="liquid-card rounded-3xl p-3.5 shadow-xl">
                <TrackList tracks={$filteredTracks} />
              </div>
            </section>

          {:else if $activeView === 'playlist-detail' && $selectedPlaylist}
            <!-- Visualização Detalhada da Playlist -->
            <section class="flex flex-col gap-6">
              <button
                onclick={() => libraryActions.setActiveView('library')}
                class="flex items-center gap-2 text-xs text-white/60 hover:text-white transition w-fit cursor-pointer"
              >
                <ArrowLeft class="w-4 h-4" />
                <span>{$t('playlistDetail.backToLibrary')}</span>
              </button>

              <!-- Header da Playlist Liquid Glass com Botão de Trocar Capa -->
              <div class="lq-hero-glass p-4 sm:p-6 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 relative overflow-hidden group/header">
                <!-- Capa 1:1 Clicável para Edição APENAS se for Dono -->
                {#if isPlaylistOwner}
                  <div 
                    role="button"
                    tabindex="0"
                    onclick={() => playlistToEdit.set($selectedPlaylist)}
                    onkeydown={(e) => { if (e.key === 'Enter') playlistToEdit.set($selectedPlaylist); }}
                    class="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-white/[0.18] cursor-pointer group/cover"
                    title="{$t('playlistDetail.changeCover')}"
                  >
                    <img
                      src={$selectedPlaylist.cover_image}
                      alt={$selectedPlaylist.name}
                      class="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-500"
                    />
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white backdrop-blur-[2px]">
                      <Camera class="w-6 h-6 text-[#3093AA]" />
                      <span class="text-[10px] font-bold uppercase tracking-wider">{$t('playlistDetail.changeCover')}</span>
                    </div>
                  </div>
                {:else}
                  <div class="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-white/[0.18]">
                    <img
                      src={$selectedPlaylist.cover_image}
                      alt={$selectedPlaylist.name}
                      class="w-full h-full object-cover"
                    />
                  </div>
                {/if}

                <div class="flex flex-col gap-2 min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2.5 py-0.5 rounded-full bg-white/[0.1] border border-white/[0.15] text-[10px] font-black uppercase tracking-widest text-[#3093AA]">Playlist</span>

                    <!-- Badge de Visibilidade -->
                    {#if $selectedPlaylist.visibility === 'private'}
                      <span class="px-2.5 py-0.5 rounded-full bg-[#EF7D4B]/15 border border-[#EF7D4B]/30 text-[9px] font-semibold text-[#EF7D4B] flex items-center gap-1">
                        <Lock class="w-2.5 h-2.5" />
                        <span>Privada</span>
                      </span>
                    {:else if $selectedPlaylist.visibility === 'shared'}
                      <span class="px-2.5 py-0.5 rounded-full bg-[#F3B044]/15 border border-[#F3B044]/30 text-[9px] font-semibold text-[#F3B044] flex items-center gap-1">
                        <Share2 class="w-2.5 h-2.5" />
                        <span>Amigos</span>
                      </span>
                    {:else}
                      <span class="px-2.5 py-0.5 rounded-full bg-[#3093AA]/15 border border-[#3093AA]/30 text-[9px] font-semibold text-[#3093AA] flex items-center gap-1">
                        <Globe class="w-2.5 h-2.5" />
                        <span>Pública</span>
                      </span>
                    {/if}

                    {#if $selectedPlaylist.is_imported_youtube_playlist}
                      <span class="px-2.5 py-0.5 rounded-full bg-[#EF7D4B]/15 border border-[#EF7D4B]/30 text-[9px] font-semibold text-[#EF7D4B]">
                        YouTube Import
                      </span>
                    {/if}
                  </div>

                  <h1 class="text-3xl md:text-5xl font-black font-display tracking-tight text-white truncate drop-shadow-md">
                    {$selectedPlaylist.name}
                  </h1>

                  <p class="text-xs text-white/70 leading-relaxed max-w-xl">
                    {$selectedPlaylist.description || $t('playlistDetail.defaultDesc')}
                  </p>

                  <div class="flex items-center gap-3 text-xs text-white/50 pt-1 font-medium flex-wrap">
                    {#if $selectedPlaylist.user_id}
                      <button
                        type="button"
                        onclick={() => authActions.viewUserProfile({
                          id: $selectedPlaylist.user_id!,
                          username: $selectedPlaylist.owner_username,
                          display_name: playlistCreatorName,
                          avatar_url: $selectedPlaylist.owner_avatar_url
                        })}
                        class="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white/90 hover:text-white transition group cursor-pointer shadow-sm active:scale-95"
                        title="Ver perfil de {playlistCreatorName}"
                      >
                        {#if $selectedPlaylist.owner_avatar_url}
                          <img
                            src={$selectedPlaylist.owner_avatar_url}
                            alt={playlistCreatorName}
                            class="w-4 h-4 rounded-full object-cover border border-white/20 group-hover:scale-110 transition-transform"
                          />
                        {:else}
                          <div class="w-4 h-4 rounded-full bg-[#3093AA]/30 border border-[#3093AA]/50 flex items-center justify-center text-[8px] text-[#3093AA] font-bold">
                            {playlistCreatorName.slice(0, 1).toUpperCase()}
                          </div>
                        {/if}
                        <span class="font-bold text-white group-hover:text-[#3093AA] transition-colors">
                          Por {playlistCreatorName}
                        </span>
                        {#if $selectedPlaylist.owner_username}
                          <span class="text-[10px] text-white/40">@{$selectedPlaylist.owner_username}</span>
                        {/if}
                      </button>
                    {:else}
                      <span class="text-white/80 font-bold">Por {playlistCreatorName}</span>
                    {/if}
                    <span>•</span>
                    <span>{$t('playlistDetail.tracksCount', { count: $selectedPlaylistTracks.length })}</span>
                    <span>•</span>
                    <span>Criada em {formatDisplayDate($selectedPlaylist.created_at)}</span>
                    {#if ($selectedPlaylist.play_count || 0) > 0}
                      <span>•</span>
                      <span class="text-[#3093AA] font-semibold">{$selectedPlaylist.play_count} plays</span>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Ações da Playlist -->
              <div class="flex items-center justify-between gap-4 flex-wrap">
                <div class="flex items-center gap-3">
                  <button
                    onclick={() => playAllPlaylist($selectedPlaylistTracks)}
                    class="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#EF7D4B] via-[#EF7D4B] to-[#F3B044] hover:brightness-110 text-white font-black text-xs shadow-lg shadow-[#EF7D4B]/30 transition active:scale-95 cursor-pointer hover:scale-105"
                  >
                    <Play class="w-4 h-4 fill-current ml-0.5" />
                    <span>{$t('playlistDetail.play')}</span>
                  </button>

                  <button
                    onclick={() => shufflePlaylist($selectedPlaylistTracks)}
                    class="flex items-center gap-2 px-4 py-2.5 rounded-full lq-glass-pill text-xs font-semibold text-white/80 hover:text-white transition cursor-pointer"
                  >
                    <Shuffle class="w-3.5 h-3.5 text-[#3093AA]" />
                    <span>{$t('playlistDetail.shuffle')}</span>
                  </button>
                </div>

                <div class="flex items-center gap-2">
                  {#if isPlaylistOwner}
                    <!-- Botão de Personalização / Edição (Apenas Dono) -->
                    <button
                      onclick={() => playlistToEdit.set($selectedPlaylist)}
                      class="flex items-center gap-1.5 px-3.5 py-2 rounded-full lq-glass-pill text-xs font-semibold text-white/80 hover:text-white transition cursor-pointer"
                      title="{$t('playlistDetail.editPlaylist')}"
                    >
                      <Edit3 class="w-3.5 h-3.5 text-[#3093AA]" />
                      <span>{$t('playlistDetail.editPlaylist')}</span>
                    </button>

                    <!-- Botão da Lixeira com Pop-up de Confirmação (Apenas Dono) -->
                    <button
                      onclick={() => playlistToDelete.set($selectedPlaylist)}
                      class="p-2.5 rounded-full lq-glass-pill text-white/40 hover:text-[#EF7D4B] transition cursor-pointer"
                      title="{$t('playlistDetail.deletePlaylist')}"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  {:else}
                    <!-- Botão de Seguir Playlist (Para quem não é Dono) -->
                    <button
                      onclick={() => libraryActions.toggleFollowPlaylist($selectedPlaylist.id)}
                      class="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-xs transition shadow-lg cursor-pointer {$selectedPlaylist.is_followed ? 'lq-glass-frost text-[#3093AA] border border-[#3093AA]/40' : 'bg-gradient-to-r from-[#3093AA] to-[#257385] text-white hover:brightness-110 shadow-[#3093AA]/25'}"
                    >
                      {#if $selectedPlaylist.is_followed}
                        <Check class="w-3.5 h-3.5 text-[#3093AA]" />
                        <span>Seguindo</span>
                      {:else}
                        <Bookmark class="w-3.5 h-3.5" />
                        <span>Seguir Playlist</span>
                      {/if}
                    </button>
                  {/if}
                </div>
              </div>

              <!-- Lista de Músicas da Playlist -->
              <div class="liquid-card rounded-3xl p-3.5 shadow-xl">
                <TrackList tracks={$selectedPlaylistTracks} />
              </div>
            </section>

          {:else if $activeView === 'favorites'}
            <!-- Visualização Favoritos -->
            <section class="flex flex-col gap-6">
              <div class="flex items-center gap-3.5">
                <div class="p-3.5 rounded-2xl bg-[#F3B044]/15 border border-[#F3B044]/30 text-[#F3B044] shadow-lg shadow-[#F3B044]/10">
                  <Heart class="w-6 h-6 fill-current" />
                </div>
                <div>
                  <h1 class="text-xl font-bold text-[#F0F0F5] tracking-tight">{$t('favoritesView.title')}</h1>
                  <p class="text-xs text-white/50">{$t('favoritesView.subtitle', { count: favoriteTracks.length })}</p>
                </div>
              </div>

              <div class="liquid-card rounded-3xl p-3.5 shadow-xl">
                <TrackList tracks={favoriteTracks} />
              </div>
            </section>

          {:else if $activeView === 'recent'}
            <!-- Visualização Recentes -->
            <section class="flex flex-col gap-6">
              <div class="flex items-center gap-3.5">
                <div class="p-3.5 rounded-2xl bg-[#EF7D4B]/15 border border-[#EF7D4B]/30 text-[#EF7D4B] shadow-lg shadow-[#EF7D4B]/10">
                  <Clock class="w-6 h-6" />
                </div>
                <div>
                  <h1 class="text-xl font-bold text-[#F0F0F5] tracking-tight">{$t('recentView.title')}</h1>
                  <p class="text-xs text-white/50">
                    {$recentTracks.length > 0 ? $t('recentView.subtitle', { count: $recentTracks.length }) : $t('recentView.empty')}
                  </p>
                </div>
              </div>

              <div class="liquid-card rounded-3xl p-3.5 shadow-xl">
                <TrackList tracks={$recentTracks.length > 0 ? $recentTracks : $allTracks.slice(0, 3)} />
              </div>
            </section>

          {:else if $activeView === 'profile'}
            <!-- Visualização de Perfil Social Estilo Twitter/X -->
            <UserProfileView />
          {:else if $activeView === 'settings'}
            <!-- Visualização de Configurações Avançadas -->
            <SettingsView />
          {/if}
        </div>
      </main>

      <!-- Fila Drawer (Popover Lateral Direito) -->
      <QueueDrawer />
    </div>

    <!-- Barra de Reprodução Inferior Persistente -->
    <BottomPlayerBar />

    <!-- Modais Globais -->
    <LinkInputModal />
    <NewPlaylistModal />
    <NowPlayingView />
    <DeletePlaylistModal />
    <EditPlaylistModal />
    <AuthModal />
    <EditProfileModal />
    <SocialDrawer />
    <DirectChatModal />
    <UpdateModal />
    <UpdateToast />
  </div>
{/if}
