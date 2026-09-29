<script lang="ts">
  import { 
    Home,
    Library, 
    Heart, 
    Clock, 
    Plus,
    PlusCircle, 
    ListMusic, 
    ShieldCheck,
    User,
    Users,
    Settings,
    Play,
    Disc3,
    PanelLeftClose,
    PanelLeftOpen,
    Sparkles
  } from '@lucide/svelte';
  import { 
    activeView, 
    playlists, 
    userLibraryPlaylists,
    selectedPlaylist, 
    libraryActions, 
    isSidebarCollapsed,
    isAddLinkModalOpen, 
    isNewPlaylistModalOpen 
  } from '../stores/libraryStore';
  import { 
    currentUser, 
    currentProfile,
    isAuthModalOpen, 
    viewedProfile 
  } from '../stores/authStore';
  import { 
    isSocialDrawerOpen, 
    socialState 
  } from '../stores/socialStore';
  import { t } from '../i18n';
  import type { ActiveView, Playlist } from '../types';

  function navigate(view: ActiveView, pl: Playlist | null = null) {
    libraryActions.setActiveView(view, pl);
  }

  function openMyProfile() {
    viewedProfile.set(null);
    libraryActions.setActiveView('profile');
  }

  let pendingIncomingCount = $derived(
    $socialState.pendingRequests.filter(f => f.friend_id === $currentProfile?.id || f.friend_id === $currentUser?.id).length
  );
</script>

<aside 
  class="h-full flex flex-col lq-floating-island select-none z-20 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] {$isSidebarCollapsed ? 'w-[72px] p-2' : 'w-64 p-4'}"
>
  <!-- Brand Header & Toggle Retrátil -->
  {#if $isSidebarCollapsed}
    <!-- CABEÇALHO COMPACTO VERTICAL (SEM DISPUTA DE ESPAÇO) -->
    <div class="flex flex-col items-center gap-2 pb-2.5 mb-2 border-b border-white/[0.08] shrink-0">
      <button 
        type="button"
        onclick={() => navigate('home')}
        class="relative group shrink-0 cursor-pointer"
        title="Pulsar - Início"
      >
        <img 
          src="/pulsar-isotipo.svg" 
          alt="Pulsar" 
          class="w-9 h-9 rounded-2xl shadow-xl border border-white/[0.18] transition-transform duration-300 group-hover:scale-105 bg-[#141828]" 
        />
        <div class="absolute inset-0 rounded-2xl bg-[#EF7D4B]/25 opacity-0 group-hover:opacity-100 transition-opacity blur-[8px]"></div>
      </button>

      <button
        type="button"
        onclick={() => libraryActions.toggleSidebarCollapse()}
        class="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
        title="Expandir Barra Lateral"
      >
        <PanelLeftOpen class="w-4 h-4" />
      </button>
    </div>
  {:else}
    <!-- CABEÇALHO EXPANDIDO HORIZONTAL -->
    <div class="flex items-center justify-between gap-2 pb-3 mb-2 border-b border-white/[0.08] shrink-0">
      <div class="flex items-center gap-2.5 min-w-0">
        <button 
          type="button"
          onclick={() => navigate('home')}
          class="relative group shrink-0 cursor-pointer"
          title="Pulsar - Início"
        >
          <img 
            src="/pulsar-isotipo.svg" 
            alt="Pulsar" 
            class="w-9 h-9 rounded-2xl shadow-xl border border-white/[0.18] transition-transform duration-300 group-hover:scale-105 bg-[#141828]" 
          />
          <div class="absolute inset-0 rounded-2xl bg-[#EF7D4B]/25 opacity-0 group-hover:opacity-100 transition-opacity blur-[8px]"></div>
        </button>

        <div class="min-w-0 flex-1 animate-fade-in">
          <h1 class="text-sm font-extrabold tracking-tight flex items-center text-[#F0F0F5]">
            <span class="text-[#F3B044]">P</span>
            <span class="text-white">u</span>
            <span class="text-[#EF7D4B]">l</span>
            <span class="text-white">s</span>
            <span class="text-[#3093AA]">a</span>
            <span class="text-[#097198]">r</span>
          </h1>
          <div class="flex items-center gap-1 text-[10px] font-semibold text-[#3093AA]">
            <ShieldCheck class="w-3 h-3 text-[#3093AA]" />
            <span class="truncate">{$t('sidebar.zeroAds')}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onclick={() => libraryActions.toggleSidebarCollapse()}
        class="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.08] transition cursor-pointer shrink-0"
        title="Recolher Barra Lateral"
      >
        <PanelLeftClose class="w-4 h-4" />
      </button>
    </div>
  {/if}

  <!-- Ação Rápida de Adicionar Música (YouTube / Spotify) -->
  {#if $isSidebarCollapsed}
    <div class="mb-2 flex justify-center shrink-0">
      <button
        type="button"
        onclick={() => isAddLinkModalOpen.set(true)}
        class="lq-glass-pill w-10 h-10 flex items-center justify-center text-white/90 hover:text-white cursor-pointer group shadow-sm"
        title="{$t('sidebar.addMusic')}"
      >
        <Sparkles class="w-4 h-4 text-[#EF7D4B] transition-transform group-hover:scale-110" />
      </button>
    </div>
  {:else}
    <div class="mb-3 animate-fade-in shrink-0">
      <button
        type="button"
        onclick={() => isAddLinkModalOpen.set(true)}
        class="lq-glass-pill w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-white/90 hover:text-white cursor-pointer group shadow-sm"
        title="Importar link do YouTube ou Spotify"
      >
        <Sparkles class="w-3.5 h-3.5 text-[#EF7D4B] transition-transform group-hover:scale-110" />
        <span class="truncate">{$t('sidebar.addMusic')}</span>
      </button>
    </div>
  {/if}

  <!-- Navegação Principal -->
  <div class="flex flex-col gap-1 mb-2 shrink-0">
    {#if !$isSidebarCollapsed}
      <span class="px-2 py-1 text-[9px] font-bold tracking-widest uppercase text-white/40">{$t('sidebar.menu')}</span>
    {/if}

    <!-- 1. INÍCIO / HOME -->
    <button
      onclick={() => navigate('home')}
      class="w-full flex items-center {$isSidebarCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2'} rounded-2xl text-xs font-semibold transition-all {$activeView === 'home' && !$selectedPlaylist ? 'bg-gradient-to-r from-white/[0.14] to-white/[0.05] text-white border border-white/[0.16] shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] font-bold' : 'text-white/70 hover:bg-white/[0.06] hover:text-[#F0F0F5]'} cursor-pointer group"
      title="{$t('nav.home')}"
    >
      <Home class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 {$activeView === 'home' && !$selectedPlaylist ? 'text-[#EF7D4B]' : ''}" />
      {#if !$isSidebarCollapsed}
        <span class="truncate">{$t('nav.home')}</span>
      {/if}
    </button>

    <!-- 2. SUA BIBLIOTECA -->
    <button
      onclick={() => navigate('library')}
      class="w-full flex items-center {$isSidebarCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2'} rounded-2xl text-xs font-semibold transition-all {$activeView === 'library' && !$selectedPlaylist ? 'bg-gradient-to-r from-white/[0.14] to-white/[0.05] text-white border border-white/[0.16] shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] font-bold' : 'text-white/70 hover:bg-white/[0.06] hover:text-[#F0F0F5]'} cursor-pointer group"
      title="{$t('nav.library')}"
    >
      <Library class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 {$activeView === 'library' && !$selectedPlaylist ? 'text-[#3093AA]' : ''}" />
      {#if !$isSidebarCollapsed}
        <span class="truncate">{$t('nav.library')}</span>
      {/if}
    </button>

    <!-- 3. FAVORITAS -->
    <button
      onclick={() => navigate('favorites')}
      class="w-full flex items-center {$isSidebarCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2'} rounded-2xl text-xs font-semibold transition-all {$activeView === 'favorites' ? 'bg-gradient-to-r from-white/[0.14] to-white/[0.05] text-white border border-white/[0.16] shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] font-bold' : 'text-white/70 hover:bg-white/[0.06] hover:text-[#F0F0F5]'} cursor-pointer group"
      title="{$t('nav.favorites')}"
    >
      <Heart class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 {$activeView === 'favorites' ? 'text-[#F3B044] fill-current' : ''}" />
      {#if !$isSidebarCollapsed}
        <span class="truncate">{$t('nav.favorites')}</span>
      {/if}
    </button>

    <!-- 4. HISTÓRICO -->
    <button
      onclick={() => navigate('recent')}
      class="w-full flex items-center {$isSidebarCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2'} rounded-2xl text-xs font-semibold transition-all {$activeView === 'recent' ? 'bg-gradient-to-r from-white/[0.14] to-white/[0.05] text-white border border-white/[0.16] shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] font-bold' : 'text-white/70 hover:bg-white/[0.06] hover:text-[#F0F0F5]'} cursor-pointer group"
      title="{$t('nav.history')}"
    >
      <Clock class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 {$activeView === 'recent' ? 'text-[#EF7D4B]' : ''}" />
      {#if !$isSidebarCollapsed}
        <span class="truncate">{$t('nav.history')}</span>
      {/if}
    </button>

    <!-- 5. CONFIGURAÇÕES -->
    <button
      onclick={() => navigate('settings')}
      class="w-full flex items-center {$isSidebarCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2'} rounded-2xl text-xs font-semibold transition-all {$activeView === 'settings' ? 'bg-gradient-to-r from-white/[0.14] to-white/[0.05] text-white border border-white/[0.16] shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] font-bold' : 'text-white/70 hover:bg-white/[0.06] hover:text-[#F0F0F5]'} cursor-pointer group"
      title="{$t('nav.settings')}"
    >
      <Settings class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 {$activeView === 'settings' ? 'text-[#3093AA]' : ''}" />
      {#if !$isSidebarCollapsed}
        <span class="truncate">{$t('nav.settings')}</span>
      {/if}
    </button>

    <!-- 6. AMIGOS / SOCIAL -->
    <button
      onclick={() => isSocialDrawerOpen.set(true)}
      class="w-full flex items-center {$isSidebarCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'justify-between px-3 py-2'} rounded-2xl text-xs font-semibold transition-all text-white/70 hover:bg-white/[0.06] hover:text-[#F0F0F5] cursor-pointer group relative"
      title="{$t('nav.friends')}"
    >
      <div class="flex items-center gap-3">
        <Users class="w-4 h-4 text-[#3093AA] shrink-0 transition-transform group-hover:scale-110" />
        {#if !$isSidebarCollapsed}
          <span class="truncate">{$t('nav.friends')}</span>
        {/if}
      </div>
      {#if pendingIncomingCount > 0}
        <span class="{$isSidebarCollapsed ? 'absolute -top-0.5 -right-0.5' : ''} px-1.5 py-0.5 rounded-full bg-[#EF7D4B] text-[9px] font-black text-white shadow-sm">
          {pendingIncomingCount}
        </span>
      {/if}
    </button>
  </div>

  <!-- SEÇÃO DE PLAYLISTS EM VIDRO FOSCO -->
  <div class="flex-1 flex flex-col gap-2 pt-2 border-t border-white/[0.08] min-h-0">
    <div class="flex items-center justify-between {$isSidebarCollapsed ? 'justify-center' : 'px-2'} shrink-0">
      {#if !$isSidebarCollapsed}
        <span class="text-[9px] font-bold tracking-widest uppercase text-white/40">{$t('sidebar.playlists')}</span>
      {/if}
      <button
        onclick={() => isNewPlaylistModalOpen.set(true)}
        class="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
        title="{$t('sidebar.newPlaylist')}"
      >
        <Plus class="w-4 h-4" />
      </button>
    </div>

    <!-- Lista de Playlists com padding defensivo inferior para evitar corte de conteúdo -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-1 pr-0.5 pb-20">
      {#each $userLibraryPlaylists as pl (pl.id)}
        {#if $isSidebarCollapsed}
          <!-- MODO COMPACTO -->
          <button
            type="button"
            onclick={() => navigate('playlist-detail', pl)}
            class="relative group/mini flex items-center justify-center p-1 rounded-xl transition-all cursor-pointer {$selectedPlaylist?.id === pl.id ? 'bg-[#3093AA]/25 ring-2 ring-[#3093AA]' : 'hover:bg-white/[0.08]'}"
            title="{pl.name} • {pl.track_count} faixas"
          >
            <img 
              src={pl.cover_image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&auto=format&fit=crop&q=80'} 
              alt={pl.name}
              class="w-9 h-9 rounded-xl object-cover shadow-sm border border-white/[0.12] transition-transform duration-300 group-hover/mini:scale-105"
            />
          </button>
        {:else}
          <!-- MODO EXPANDIDO -->
          <button
            type="button"
            onclick={() => navigate('playlist-detail', pl)}
            class="w-full flex items-center gap-3 p-2 rounded-2xl transition-all text-left cursor-pointer group {$selectedPlaylist?.id === pl.id ? 'bg-white/[0.10] text-[#3093AA] font-bold border border-white/[0.16] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]' : 'text-white/80 hover:bg-white/[0.05] hover:text-[#F0F0F5]'}"
          >
            <img 
              src={pl.cover_image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&auto=format&fit=crop&q=80'} 
              alt={pl.name}
              class="w-10 h-10 rounded-xl object-cover shrink-0 shadow-sm border border-white/[0.12] group-hover:scale-105 transition-transform"
            />
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold truncate group-hover:text-white transition-colors">{pl.name}</p>
              <p class="text-[10px] text-white/40 truncate">Playlist • {pl.track_count} {pl.track_count === 1 ? 'música' : 'músicas'}</p>
            </div>
          </button>
        {/if}
      {/each}
    </div>
  </div>
</aside>
