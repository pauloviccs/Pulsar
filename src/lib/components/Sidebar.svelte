<script lang="ts">
  import { 
    Library, 
    Heart, 
    Clock, 
    PlusCircle, 
    ListMusic, 
    Link2, 
    Sparkles, 
    CheckCircle2, 
    ShieldCheck,
    Music,
    User,
    Users,
    MessageSquare,
    Settings,
    Play,
    Disc3
  } from '@lucide/svelte';
  import { 
    activeView, 
    playlists, 
    selectedPlaylist, 
    libraryActions, 
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

<aside class="w-64 h-full flex flex-col p-4 border-r border-white/[0.08] bg-[#09090d]/85 backdrop-blur-2xl select-none z-20 overflow-hidden">
  <!-- Brand Header e Navegação -->
  <div class="flex-1 flex flex-col gap-5 min-h-0 overflow-hidden">
    <div class="flex items-center gap-3 px-2">
      <img src="/pulsar-logo.svg" alt="Pulsar" class="w-9 h-9 rounded-2xl shadow-lg border border-white/[0.12]" />
      <div>
        <h1 class="text-base font-extrabold tracking-tight text-[#F2EFEA]">Pulsar</h1>
        <div class="flex items-center gap-1.5 text-[11px] font-semibold text-[#66D7D1]">
          <ShieldCheck class="w-3.5 h-3.5" />
          <span>{$t('sidebar.zeroAds')}</span>
        </div>
      </div>
    </div>

    <!-- Quick Action: Adicionar Link (YouTube vs Spotify) -->
    <div class="grid grid-cols-2 gap-2">
      <!-- Botão YouTube / YT Music -->
      <button
        type="button"
        onclick={() => isAddLinkModalOpen.set(true)}
        class="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl bg-gradient-to-br from-[#FC7753] to-[#e64c24] hover:brightness-110 text-white text-[11px] font-bold shadow-md shadow-[#FC7753]/25 transition-all active:scale-95 cursor-pointer group"
        title="Colar link do YouTube ou YouTube Music"
      >
        <Play class="w-3.5 h-3.5 fill-current transition-transform group-hover:scale-110" />
        <span class="truncate">YouTube</span>
      </button>

      <!-- Botão Spotify -->
      <button
        type="button"
        onclick={() => isAddLinkModalOpen.set(true)}
        class="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl bg-gradient-to-br from-[#1DB954] to-[#128a3b] hover:brightness-110 text-[#09090D] text-[11px] font-extrabold shadow-md shadow-[#1DB954]/25 transition-all active:scale-95 cursor-pointer group"
        title="Colar link do Spotify"
      >
        <Disc3 class="w-3.5 h-3.5 transition-transform group-hover:rotate-45" />
        <span class="truncate">Spotify</span>
      </button>
    </div>

    <!-- Navegação Principal -->
    <div class="flex flex-col gap-1">
      <span class="px-2.5 text-[10px] font-bold tracking-widest uppercase text-[#F2EFEA]/40">{$t('sidebar.menu')}</span>

      <button
        onclick={() => navigate('library')}
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all {$activeView === 'library' && !$selectedPlaylist ? 'liquid-glass text-[#66D7D1] shadow-md' : 'text-[#F2EFEA]/70 hover:bg-white/[0.05] hover:text-[#F2EFEA]'}"
      >
        <Library class="w-4 h-4" />
        <span>{$t('nav.library')}</span>
      </button>

      <button
        onclick={() => navigate('favorites')}
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all {$activeView === 'favorites' ? 'liquid-glass text-[#DBD56E] shadow-md' : 'text-[#F2EFEA]/70 hover:bg-white/[0.05] hover:text-[#F2EFEA]'}"
      >
        <Heart class="w-4 h-4" />
        <span>{$t('nav.favorites')}</span>
      </button>

      <button
        onclick={() => navigate('recent')}
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all {$activeView === 'recent' ? 'liquid-glass text-[#FC7753] shadow-md' : 'text-[#F2EFEA]/70 hover:bg-white/[0.05] hover:text-[#F2EFEA]'}"
      >
        <Clock class="w-4 h-4" />
        <span>{$t('nav.history')}</span>
      </button>

      <button
        onclick={() => navigate('settings')}
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all {$activeView === 'settings' ? 'liquid-glass text-[#66D7D1] shadow-md' : 'text-[#F2EFEA]/70 hover:bg-white/[0.05] hover:text-[#F2EFEA]'}"
      >
        <Settings class="w-4 h-4" />
        <span>{$t('nav.settings')}</span>
      </button>

      <!-- Divisor Social -->
      <span class="px-2.5 pt-2 text-[10px] font-bold tracking-widest uppercase text-[#66D7D1]/70">{$t('sidebar.socialCloud')}</span>

      <button
        onclick={openMyProfile}
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all {$activeView === 'profile' && !$viewedProfile ? 'liquid-glass text-[#66D7D1] shadow-md' : 'text-[#F2EFEA]/70 hover:bg-white/[0.05] hover:text-[#F2EFEA]'}"
      >
        <User class="w-4 h-4" />
        <span>{$t('nav.profile')}</span>
      </button>

      <button
        onclick={() => isSocialDrawerOpen.set(true)}
        class="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all text-[#F2EFEA]/70 hover:bg-white/[0.05] hover:text-[#F2EFEA]"
      >
        <div class="flex items-center gap-3">
          <Users class="w-4 h-4 text-[#DBD56E]" />
          <span>{$t('nav.friends')}</span>
        </div>
        {#if pendingIncomingCount > 0}
          <span class="px-1.5 py-0.5 rounded-full bg-[#FC7753] text-[9px] font-black text-white">
            {pendingIncomingCount}
          </span>
        {/if}
      </button>
    </div>

    <!-- Seção de Playlists com rolagem livre e sem sobreposição -->
    <div class="flex-1 flex flex-col gap-1.5 pt-2 border-t border-white/[0.08] min-h-0">
      <div class="flex items-center justify-between px-2.5">
        <span class="text-[10px] font-bold tracking-widest uppercase text-[#F2EFEA]/40">{$t('sidebar.playlists')}</span>
        <button
          onclick={() => isNewPlaylistModalOpen.set(true)}
          class="p-1 rounded-lg text-[#F2EFEA]/50 hover:text-[#66D7D1] hover:bg-white/[0.06] transition cursor-pointer"
          title="{$t('sidebar.newPlaylist')}"
        >
          <PlusCircle class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto pr-1 flex flex-col gap-1">
        {#each $playlists as pl (pl.id)}
          <button
            onclick={() => navigate('playlist-detail', pl)}
            class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition text-left group {$selectedPlaylist?.id === pl.id ? 'liquid-glass text-[#66D7D1] font-bold' : 'text-[#F2EFEA]/70 hover:bg-white/[0.04] hover:text-[#F2EFEA]'}"
          >
            <div class="flex items-center gap-2.5 truncate">
              <ListMusic class="w-3.5 h-3.5 shrink-0 {$selectedPlaylist?.id === pl.id ? 'text-[#66D7D1]' : 'text-[#F2EFEA]/40 group-hover:text-[#F2EFEA]/70'}" />
              <span class="truncate">{pl.name}</span>
            </div>
            <span class="text-[10px] font-mono text-[#F2EFEA]/30">{pl.track_count}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
</aside>
