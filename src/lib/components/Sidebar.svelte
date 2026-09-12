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
  class="h-full flex flex-col border-r border-white/[0.08] bg-[#09090d]/90 backdrop-blur-2xl select-none z-20 overflow-hidden transition-all duration-300 ease-in-out {$isSidebarCollapsed ? 'w-[72px] p-2' : 'w-64 p-4'}"
>
  <!-- Brand Header & Toggle Retrátil -->
  <div class="flex items-center justify-between gap-2 pb-3 mb-1 border-b border-white/[0.06]">
    <div class="flex items-center gap-2.5 min-w-0 {$isSidebarCollapsed ? 'justify-center w-full' : ''}">
      <button 
        type="button"
        onclick={() => navigate('home')}
        class="relative group shrink-0 cursor-pointer"
        title="Pulsar - Início"
      >
        <img 
          src="/pulsar-logo.svg" 
          alt="Pulsar" 
          class="w-9 h-9 rounded-2xl shadow-lg border border-white/[0.12] transition-transform duration-300 group-hover:scale-105" 
        />
        <div class="absolute inset-0 rounded-2xl bg-[#66D7D1]/20 opacity-0 group-hover:opacity-100 transition-opacity blur-[6px]"></div>
      </button>

      {#if !$isSidebarCollapsed}
        <div class="min-w-0 flex-1 animate-fade-in">
          <h1 class="text-sm font-extrabold tracking-tight text-[#F2EFEA] truncate">Pulsar</h1>
          <div class="flex items-center gap-1 text-[10px] font-semibold text-[#66D7D1]">
            <ShieldCheck class="w-3 h-3" />
            <span class="truncate">{$t('sidebar.zeroAds')}</span>
          </div>
        </div>

        <!-- Botão de Recolher Sidebar -->
        <button
          type="button"
          onclick={() => libraryActions.toggleSidebarCollapse()}
          class="p-1.5 rounded-xl text-[#F2EFEA]/50 hover:text-[#66D7D1] hover:bg-white/[0.06] transition cursor-pointer shrink-0"
          title="Recolher Barra Lateral (Modo Compacto)"
        >
          <PanelLeftClose class="w-4 h-4" />
        </button>
      {/if}
    </div>

    {#if $isSidebarCollapsed}
      <!-- Botão de Expandir Sidebar no Modo Compacto -->
      <button
        type="button"
        onclick={() => libraryActions.toggleSidebarCollapse()}
        class="mt-1 p-1.5 rounded-xl text-[#F2EFEA]/50 hover:text-[#66D7D1] hover:bg-white/[0.06] transition cursor-pointer self-center"
        title="Expandir Barra Lateral"
      >
        <PanelLeftOpen class="w-4 h-4" />
      </button>
    {/if}
  </div>

  <!-- Ações Rápidas (Apenas no Modo Expandido) -->
  {#if !$isSidebarCollapsed}
    <div class="grid grid-cols-2 gap-2 mb-3 animate-fade-in">
      <button
        type="button"
        onclick={() => isAddLinkModalOpen.set(true)}
        class="flex items-center justify-center gap-1.5 py-2 px-2 rounded-2xl bg-gradient-to-br from-[#FC7753] to-[#e64c24] hover:brightness-110 text-white text-[11px] font-bold shadow-md shadow-[#FC7753]/20 transition-all active:scale-95 cursor-pointer group"
        title="Colar link do YouTube ou YouTube Music"
      >
        <Play class="w-3.5 h-3.5 fill-current transition-transform group-hover:scale-110" />
        <span class="truncate">YouTube</span>
      </button>

      <button
        type="button"
        onclick={() => isAddLinkModalOpen.set(true)}
        class="flex items-center justify-center gap-1.5 py-2 px-2 rounded-2xl bg-gradient-to-br from-[#1DB954] to-[#128a3b] hover:brightness-110 text-[#09090D] text-[11px] font-extrabold shadow-md shadow-[#1DB954]/20 transition-all active:scale-95 cursor-pointer group"
        title="Colar link do Spotify"
      >
        <Disc3 class="w-3.5 h-3.5 transition-transform group-hover:rotate-45" />
        <span class="truncate">Spotify</span>
      </button>
    </div>
  {/if}

  <!-- Navegação Principal -->
  <div class="flex flex-col gap-1 mb-2">
    {#if !$isSidebarCollapsed}
      <span class="px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase text-[#F2EFEA]/40">{$t('sidebar.menu')}</span>
    {/if}

    <!-- 1. INÍCIO / HOME (NOVO ITEM PRINCIPAL) -->
    <button
      onclick={() => navigate('home')}
      class="w-full flex items-center {$isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'} rounded-2xl text-xs font-semibold transition-all {$activeView === 'home' && !$selectedPlaylist ? 'liquid-glass text-[#66D7D1] shadow-md border border-[#66D7D1]/20 font-bold' : 'text-[#F2EFEA]/70 hover:bg-white/[0.05] hover:text-[#F2EFEA]'} cursor-pointer group"
      title="Início / Home"
    >
      <Home class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
      {#if !$isSidebarCollapsed}
        <span class="truncate">{$t('nav.home')}</span>
      {/if}
    </button>

    <!-- 2. SUA BIBLIOTECA -->
    <button
      onclick={() => navigate('library')}
      class="w-full flex items-center {$isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'} rounded-2xl text-xs font-semibold transition-all {$activeView === 'library' && !$selectedPlaylist ? 'liquid-glass text-[#66D7D1] shadow-md border border-[#66D7D1]/20 font-bold' : 'text-[#F2EFEA]/70 hover:bg-white/[0.05] hover:text-[#F2EFEA]'} cursor-pointer group"
      title="Sua Biblioteca"
    >
      <Library class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
      {#if !$isSidebarCollapsed}
        <span class="truncate">{$t('nav.library')}</span>
      {/if}
    </button>

    <!-- 3. FAVORITAS -->
    <button
      onclick={() => navigate('favorites')}
      class="w-full flex items-center {$isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'} rounded-2xl text-xs font-semibold transition-all {$activeView === 'favorites' ? 'liquid-glass text-[#DBD56E] shadow-md border border-[#DBD56E]/20 font-bold' : 'text-[#F2EFEA]/70 hover:bg-white/[0.05] hover:text-[#F2EFEA]'} cursor-pointer group"
      title="Favoritas"
    >
      <Heart class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
      {#if !$isSidebarCollapsed}
        <span class="truncate">{$t('nav.favorites')}</span>
      {/if}
    </button>

    <!-- 4. HISTÓRICO -->
    <button
      onclick={() => navigate('recent')}
      class="w-full flex items-center {$isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'} rounded-2xl text-xs font-semibold transition-all {$activeView === 'recent' ? 'liquid-glass text-[#FC7753] shadow-md border border-[#FC7753]/20 font-bold' : 'text-[#F2EFEA]/70 hover:bg-white/[0.05] hover:text-[#F2EFEA]'} cursor-pointer group"
      title="Histórico de Reprodução"
    >
      <Clock class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
      {#if !$isSidebarCollapsed}
        <span class="truncate">{$t('nav.history')}</span>
      {/if}
    </button>

    <!-- 5. CONFIGURAÇÕES -->
    <button
      onclick={() => navigate('settings')}
      class="w-full flex items-center {$isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'} rounded-2xl text-xs font-semibold transition-all {$activeView === 'settings' ? 'liquid-glass text-[#66D7D1] shadow-md border border-[#66D7D1]/20 font-bold' : 'text-[#F2EFEA]/70 hover:bg-white/[0.05] hover:text-[#F2EFEA]'} cursor-pointer group"
      title="Configurações"
    >
      <Settings class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
      {#if !$isSidebarCollapsed}
        <span class="truncate">{$t('nav.settings')}</span>
      {/if}
    </button>

    <!-- 6. AMIGOS / SOCIAL -->
    <button
      onclick={() => isSocialDrawerOpen.set(true)}
      class="w-full flex items-center {$isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'} rounded-2xl text-xs font-semibold transition-all text-[#F2EFEA]/70 hover:bg-white/[0.05] hover:text-[#F2EFEA] cursor-pointer group relative"
      title="Amigos & Conexão Social"
    >
      <div class="flex items-center gap-3">
        <Users class="w-4 h-4 text-[#DBD56E] shrink-0 transition-transform group-hover:scale-110" />
        {#if !$isSidebarCollapsed}
          <span class="truncate">{$t('nav.friends')}</span>
        {/if}
      </div>
      {#if pendingIncomingCount > 0}
        <span class="{$isSidebarCollapsed ? 'absolute top-1 right-1' : ''} px-1.5 py-0.5 rounded-full bg-[#FC7753] text-[9px] font-black text-white shadow-sm">
          {pendingIncomingCount}
        </span>
      {/if}
    </button>
  </div>

  <!-- SEÇÃO DE PLAYLISTS ESTILO SPOTIFY / LIQUID GLASS -->
  <div class="flex-1 flex flex-col gap-2 pt-2 border-t border-white/[0.08] min-h-0">
    <div class="flex items-center justify-between {$isSidebarCollapsed ? 'justify-center' : 'px-2'}">
      {#if !$isSidebarCollapsed}
        <span class="text-[9px] font-bold tracking-widest uppercase text-[#F2EFEA]/40">{$t('sidebar.playlists')}</span>
      {/if}
      <button
        onclick={() => isNewPlaylistModalOpen.set(true)}
        class="p-1.5 rounded-xl text-[#F2EFEA]/50 hover:text-[#66D7D1] hover:bg-white/[0.06] transition cursor-pointer"
        title="{$t('sidebar.newPlaylist')}"
      >
        <Plus class="w-4 h-4" />
      </button>
    </div>

    <!-- Lista de Playlists (Modo Expandido: Capa + Título + Subtítulo | Modo Compacto: Mini-Capas Quadradas) -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-1.5 pr-0.5 custom-scrollbar">
      {#each $playlists as pl (pl.id)}
        {#if $isSidebarCollapsed}
          <!-- MODO COMPACTO: Mini-Capa Quadrada com Glow -->
          <button
            type="button"
            onclick={() => navigate('playlist-detail', pl)}
            class="relative group/mini flex items-center justify-center p-1 rounded-xl transition-all cursor-pointer {$selectedPlaylist?.id === pl.id ? 'bg-[#66D7D1]/15 ring-2 ring-[#66D7D1]/50' : 'hover:bg-white/[0.06]'}"
            title="{pl.name} • {pl.track_count} faixas"
          >
            <img 
              src={pl.cover_image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&auto=format&fit=crop&q=80'} 
              alt={pl.name}
              class="w-10 h-10 rounded-lg object-cover shadow-sm border border-white/[0.1] transition-transform duration-300 group-hover/mini:scale-105"
            />
          </button>
        {:else}
          <!-- MODO EXPANDIDO: Layout Estilo Spotify com Capa 1:1 + Título + Faixas -->
          <button
            type="button"
            onclick={() => navigate('playlist-detail', pl)}
            class="w-full flex items-center gap-3 p-2 rounded-2xl transition-all text-left cursor-pointer group {$selectedPlaylist?.id === pl.id ? 'liquid-glass bg-white/[0.08] text-[#66D7D1] font-bold border border-[#66D7D1]/20' : 'text-[#F2EFEA]/80 hover:bg-white/[0.04] hover:text-[#F2EFEA]'}"
          >
            <img 
              src={pl.cover_image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&auto=format&fit=crop&q=80'} 
              alt={pl.name}
              class="w-10 h-10 rounded-xl object-cover shrink-0 shadow-sm border border-white/[0.1] group-hover:scale-105 transition-transform"
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
