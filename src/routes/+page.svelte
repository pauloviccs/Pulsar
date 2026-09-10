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
    Menu
  } from '@lucide/svelte';

  import Sidebar from '$lib/components/Sidebar.svelte';
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

  import { 
    allTracks, 
    playlists, 
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
  import { t } from '$lib/i18n';
  import type { Track } from '$lib/types';

  let searchInput = $state('');

  function handleSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    searchInput = val;
    searchQuery.set(val);
  }

  onMount(() => {
    libraryActions.initFromBackend();
    authActions.initAuth();
    const unsub = socialActions.subscribeToRealtime();
    return () => {
      unsub();
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

  function playAllPlaylist(tracks: Track[]) {
    if (tracks.length > 0) {
      playerActions.playTrack(tracks[0], tracks);
    }
  }

  function shufflePlaylist(tracks: Track[]) {
    if (tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      playerActions.playTrack(shuffled[0], shuffled);
    }
  }

  let isMobileSidebarOpen = $state(false);

  $effect(() => {
    // Ao mudar de view, fecha a gaveta mobile automaticamente
    const _v = $activeView;
    isMobileSidebarOpen = false;
  });
</script>

<!-- Motor de Áudio Persistente Global (Nunca é desmontado na troca de tela/janela) -->
<GlobalAudioEngine />

{#if $isMiniPlayer}
  <!-- MODO MINI PLAYER FLUTUANTE ULTRA COMPACTO -->
  <div class="w-screen h-screen overflow-hidden bg-[#09090d]">
    <MiniPlayerView />
  </div>
{:else}
  <!-- LAYOUT PRINCIPAL DO PULSAR -->
  <div class="h-screen w-screen flex flex-col bg-[#09090d] text-[#F2EFEA] select-none overflow-hidden font-sans">
    <!-- Layout Principal: Sidebar + Conteúdo -->
    <div class="flex-1 flex min-h-0 relative overflow-hidden">
      <!-- Backdrop para Sidebar Mobile -->
      {#if isMobileSidebarOpen}
        <div 
          role="presentation"
          class="fixed inset-0 z-40 bg-black/70 backdrop-blur-md md:hidden animate-fade-in"
          onclick={() => isMobileSidebarOpen = false}
          onkeydown={(e) => { if (e.key === 'Escape') isMobileSidebarOpen = false; }}
        ></div>
      {/if}

      <!-- Sidebar: Fixa no Desktop (md:), Deslizante em Mobile/Telas menores -->
      <div class="fixed md:static inset-y-0 left-0 z-50 transform md:transform-none transition-transform duration-300 ease-in-out {isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}">
        <Sidebar />
      </div>

      <!-- Conteúdo Central Rolável -->
      <main class="flex-1 flex flex-col min-w-0 overflow-y-auto bg-gradient-to-b from-[#141420]/30 to-[#09090d]">
        <!-- Top Header: Responsivo, alinhado e com o Profile Pill com a #tag -->
        <header class="sticky top-0 z-30 pt-4 pb-3 sm:pt-6 sm:pb-4 px-4 sm:px-8 flex items-center justify-between gap-3 sm:gap-6 bg-[#09090d]/85 backdrop-blur-2xl border-b border-white/[0.08]">
          <!-- Lado Esquerdo: Botão Hamburger (Mobile) + Campo de Busca Liquid Glass -->
          <div class="flex items-center gap-2.5 flex-1 min-w-0 max-w-md">
            <button
              type="button"
              onclick={() => isMobileSidebarOpen = !isMobileSidebarOpen}
              class="md:hidden p-2 rounded-2xl liquid-glass text-[#F2EFEA]/70 hover:text-white border border-white/[0.1] shrink-0 cursor-pointer"
              aria-label="Abrir Navegação"
            >
              <Menu class="w-4 h-4" />
            </button>

            <div class="relative w-full flex items-center">
              <Search class="absolute left-3.5 w-4 h-4 text-[#F2EFEA]/40 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                oninput={handleSearchInput}
                placeholder={$t('search.placeholder')}
                class="w-full py-2 sm:py-2.5 pl-10 pr-4 rounded-2xl liquid-input text-xs text-[#F2EFEA] placeholder:text-[#F2EFEA]/30 transition"
              />
            </div>
          </div>

          <!-- Lado Direito: Modal de Perfil com a # e Ação de Adicionar Link -->
          <div class="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
            <!-- Modal do Usuário com a #tag (Exibição Premium) -->
            <TopProfileButton />

            <!-- Ação Rápida: Adicionar Link -->
            <button
              onclick={() => isAddLinkModalOpen.set(true)}
              class="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl liquid-glass hover:bg-white/[0.12] text-xs font-semibold text-[#F2EFEA] transition active:scale-95 cursor-pointer shadow-md border border-white/[0.1]"
              title="{$t('search.addLink')}"
            >
              <Plus class="w-3.5 h-3.5 text-[#FC7753]" />
              <span class="hidden xs:inline sm:inline">{$t('search.addLink')}</span>
            </button>
          </div>
        </header>

        <!-- View Area Principal com padding responsivo -->
        <div class="p-4 sm:p-6 md:p-8 flex flex-col gap-6 sm:gap-8">
          {#if $activeView === 'library' && !$selectedPlaylist}
            <!-- Modal Slider / Carrossel de Destaques e Mais Ouvidas -->
            {#if !searchInput}
              <HeroSlider />
            {/if}

            <!-- Seção Playlists -->
            {#if !searchInput}
              <section class="flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-base font-bold text-[#F2EFEA]">{$t('home.featuredPlaylists')}</h3>
                    <p class="text-xs text-[#F2EFEA]/40">{$t('home.featuredPlaylistsDesc')}</p>
                  </div>
                </div>

                <PlaylistGrid playlists={$playlists} />
              </section>
            {/if}

            <!-- Seção Faixas -->
            <section class="flex flex-col gap-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-base font-bold text-[#F2EFEA]">
                    {searchInput ? $t('search.resultsFor', { query: searchInput }) : $t('search.allTracks')}
                  </h3>
                  <p class="text-xs text-[#F2EFEA]/40">{$t('search.tracksAvailable', { count: $filteredTracks.length })}</p>
                </div>

                {#if $filteredTracks.length > 0}
                  <div class="flex items-center gap-2">
                    <button
                      onclick={() => playAllPlaylist($filteredTracks)}
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl liquid-glass hover:bg-white/[0.1] text-xs font-medium transition cursor-pointer"
                    >
                      <Play class="w-3.5 h-3.5 fill-current text-[#66D7D1]" />
                      <span>{$t('search.playAll')}</span>
                    </button>
                  </div>
                {/if}
              </div>

              <div class="liquid-glass rounded-3xl p-3 border border-white/[0.1]">
                <TrackList tracks={$filteredTracks} />
              </div>
            </section>

          {:else if $activeView === 'playlist-detail' && $selectedPlaylist}
            <!-- Visualização Detalhada da Playlist -->
            <section class="flex flex-col gap-6">
              <button
                onclick={() => libraryActions.setActiveView('library')}
                class="flex items-center gap-2 text-xs text-[#F2EFEA]/60 hover:text-[#F2EFEA] transition w-fit cursor-pointer"
              >
                <ArrowLeft class="w-4 h-4" />
                <span>{$t('playlistDetail.backToLibrary')}</span>
              </button>

              <!-- Header da Playlist Liquid Glass com Botão de Trocar Capa -->
              <div class="liquid-glass rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 border border-white/[0.14] relative overflow-hidden group/header">
                <!-- Capa 1:1 Clicável para Edição Rápida -->
                <div 
                  role="button"
                  tabindex="0"
                  onclick={() => playlistToEdit.set($selectedPlaylist)}
                  onkeydown={(e) => { if (e.key === 'Enter') playlistToEdit.set($selectedPlaylist); }}
                  class="relative w-40 h-40 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-white/[0.15] cursor-pointer group/cover"
                  title="{$t('playlistDetail.changeCover')}"
                >
                  <img
                    src={$selectedPlaylist.cover_image}
                    alt={$selectedPlaylist.name}
                    class="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-500"
                  />
                  <div class="absolute inset-0 bg-black/50 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white backdrop-blur-[2px]">
                    <Camera class="w-6 h-6 text-[#66D7D1]" />
                    <span class="text-[10px] font-bold uppercase tracking-wider">{$t('playlistDetail.changeCover')}</span>
                  </div>
                </div>

                <div class="flex flex-col gap-2 min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-widest text-[#66D7D1]">Playlist</span>
                    {#if $selectedPlaylist.is_imported_youtube_playlist}
                      <span class="px-2 py-0.5 rounded-full bg-[#FC7753]/15 border border-[#FC7753]/30 text-[9px] font-semibold text-[#FC7753]">
                        YouTube Import
                      </span>
                    {/if}
                  </div>

                  <h1 class="text-2xl md:text-3xl font-extrabold tracking-tight text-[#F2EFEA] truncate">
                    {$selectedPlaylist.name}
                  </h1>

                  <p class="text-xs text-[#F2EFEA]/70 leading-relaxed max-w-xl">
                    {$selectedPlaylist.description || $t('playlistDetail.defaultDesc')}
                  </p>

                  <div class="flex items-center gap-4 text-xs text-[#F2EFEA]/50 pt-2 font-medium">
                    <span>{$t('playlistDetail.tracksCount', { count: $selectedPlaylistTracks.length })}</span>
                    <span>•</span>
                    <span>{$t('playlistDetail.createdAt', { date: $selectedPlaylist.created_at })}</span>
                  </div>
                </div>
              </div>

              <!-- Ações da Playlist -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <button
                    onclick={() => playAllPlaylist($selectedPlaylistTracks)}
                    class="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#FC7753] hover:bg-[#FC7753]/90 text-white font-bold text-xs shadow-lg shadow-[#FC7753]/25 transition active:scale-95 cursor-pointer"
                  >
                    <Play class="w-4 h-4 fill-current" />
                    <span>{$t('playlistDetail.play')}</span>
                  </button>

                  <button
                    onclick={() => shufflePlaylist($selectedPlaylistTracks)}
                    class="flex items-center gap-2 px-4 py-2.5 rounded-2xl liquid-glass hover:bg-white/[0.1] text-xs font-semibold transition cursor-pointer"
                  >
                    <Shuffle class="w-4 h-4 text-[#66D7D1]" />
                    <span>{$t('playlistDetail.shuffle')}</span>
                  </button>
                </div>

                <div class="flex items-center gap-2">
                  <!-- Botão de Personalização / Edição -->
                  <button
                    onclick={() => playlistToEdit.set($selectedPlaylist)}
                    class="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl liquid-glass hover:bg-white/[0.12] text-xs font-semibold text-[#F2EFEA] transition cursor-pointer"
                    title="{$t('playlistDetail.editPlaylist')}"
                  >
                    <Edit3 class="w-3.5 h-3.5 text-[#66D7D1]" />
                    <span>{$t('playlistDetail.editPlaylist')}</span>
                  </button>

                  <!-- Botão da Lixeira com Pop-up de Confirmação -->
                  <button
                    onclick={() => playlistToDelete.set($selectedPlaylist)}
                    class="p-2.5 rounded-2xl text-white/40 hover:text-[#FC7753] hover:bg-white/[0.06] transition cursor-pointer"
                    title="{$t('playlistDetail.deletePlaylist')}"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Lista de Músicas da Playlist -->
              <div class="liquid-glass rounded-3xl p-3 border border-white/[0.1]">
                <TrackList tracks={$selectedPlaylistTracks} />
              </div>
            </section>

          {:else if $activeView === 'favorites'}
            <!-- Visualização Favoritos -->
            <section class="flex flex-col gap-6">
              <div class="flex items-center gap-3.5">
                <div class="p-3.5 rounded-2xl bg-[#DBD56E]/15 border border-[#DBD56E]/30 text-[#DBD56E] shadow-lg shadow-[#DBD56E]/10">
                  <Heart class="w-6 h-6 fill-current" />
                </div>
                <div>
                  <h1 class="text-xl font-bold text-[#F2EFEA] tracking-tight">{$t('favoritesView.title')}</h1>
                  <p class="text-xs text-[#F2EFEA]/50">{$t('favoritesView.subtitle', { count: favoriteTracks.length })}</p>
                </div>
              </div>

              <div class="liquid-glass rounded-3xl p-3 border border-white/[0.1]">
                <TrackList tracks={favoriteTracks} />
              </div>
            </section>

          {:else if $activeView === 'recent'}
            <!-- Visualização Recentes -->
            <section class="flex flex-col gap-6">
              <div class="flex items-center gap-3.5">
                <div class="p-3.5 rounded-2xl bg-[#FC7753]/15 border border-[#FC7753]/30 text-[#FC7753] shadow-lg shadow-[#FC7753]/10">
                  <Clock class="w-6 h-6" />
                </div>
                <div>
                  <h1 class="text-xl font-bold text-[#F2EFEA] tracking-tight">{$t('recentView.title')}</h1>
                  <p class="text-xs text-[#F2EFEA]/50">
                    {$recentTracks.length > 0 ? $t('recentView.subtitle', { count: $recentTracks.length }) : $t('recentView.empty')}
                  </p>
                </div>
              </div>

              <div class="liquid-glass rounded-3xl p-3 border border-white/[0.1]">
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
  </div>
{/if}
