<script lang="ts">
  import { 
    currentUser, 
    currentProfile,
    viewedProfile, 
    isAuthModalOpen, 
    isEditProfileModalOpen,
    authActions 
  } from '../stores/authStore';
  import { 
    socialState, 
    socialActions, 
    activeChatFriend, 
    isSocialDrawerOpen 
  } from '../stores/socialStore';
  import { 
    playlists, 
    favoriteTrackIds, 
    allTracks, 
    libraryActions 
  } from '../stores/libraryStore';
  import { playerActions } from '../stores/playerStore';
  import { t, currentLocale } from '../i18n';
  import type { UserProfile, PlaylistVisibility, Friendship, Playlist } from '../types';
  import TrackList from './TrackList.svelte';
  import PlaylistGrid from './PlaylistGrid.svelte';
  import { 
    Edit3, 
    Copy, 
    Check, 
    Music2, 
    Share2, 
    Calendar, 
    Users, 
    UserCheck, 
    UserPlus, 
    MessageSquare, 
    Globe, 
    Lock, 
    ShieldCheck, 
    Radio, 
    Sparkles, 
    ExternalLink,
    LogOut,
    Plus,
    Flame
  } from '@lucide/svelte';

  // Perfil alvo (se viewedProfile estiver definido, mostra ele; senão, mostra currentProfile)
  let profile = $derived<UserProfile | null>($viewedProfile || $currentProfile);
  let isOwnProfile = $derived(($currentProfile && profile && $currentProfile.id === profile.id) || ($currentUser && profile && $currentUser.id === profile.id));

  let activeTab = $state<'playlists' | 'saved' | 'favorites'>('playlists');
  let playlistVisibilityFilter = $state<PlaylistVisibility | 'all'>('all');
  let copiedTag = $state(false);

  // Determina se o usuário logado segue o perfil visualizado
  let isFollowing = $derived(
    profile ? $socialState.followingIds.includes(profile.id) : false
  );

  // Determina se já são amigos
  let isFriend = $derived(
    profile ? $socialState.friends.some((f: Friendship) => f.friend_id === profile?.id && f.status === 'accepted') : false
  );

  // Filtra as playlists locais para o perfil atual
  let filteredPlaylists = $derived(
    $playlists.filter((pl: Playlist) => {
      if (playlistVisibilityFilter === 'all') return true;
      return (pl.visibility || 'public') === playlistVisibilityFilter;
    })
  );

  let userFavoriteTracks = $derived(
    $allTracks.filter(t => $favoriteTrackIds.has(t.id))
  );

  async function copyHandleTag() {
    if (!profile) return;
    const fullTag = `@${profile.username}#${profile.tag}`;
    try {
      await navigator.clipboard.writeText(fullTag);
      copiedTag = true;
      setTimeout(() => copiedTag = false, 2000);
    } catch {
      copiedTag = true;
      setTimeout(() => copiedTag = false, 2000);
    }
  }

  function handleFollowToggle() {
    if (!profile) return;
    if (isFollowing) {
      socialActions.unfollowUser(profile.id);
    } else {
      socialActions.followUser(profile.id);
    }
  }

  function handleAddFriend() {
    if (!profile) return;
    socialActions.sendFriendRequest(profile.username, profile.tag);
  }

  function handleOpenChat() {
    if (!profile) return;
    const friend = $socialState.friends.find((f: Friendship) => f.friend_id === profile?.id);
    if (friend) {
      activeChatFriend.set(friend);
    } else {
      // Abre a gaveta de amizades
      isSocialDrawerOpen.set(true);
    }
  }

  function getStatusColor(status?: string) {
    switch (status) {
      case 'online': return 'bg-[#66D7D1] shadow-[0_0_10px_#66D7D1]';
      case 'away': return 'bg-[#DBD56E] shadow-[0_0_10px_#DBD56E]';
      case 'busy': return 'bg-[#FC7753] shadow-[0_0_10px_#FC7753]';
      default: return 'bg-[#F2EFEA]/30';
    }
  }

  function getStatusLabel(status?: string) {
    switch (status) {
      case 'online': return 'Online';
      case 'away': return 'Ausente';
      case 'busy': return 'Ocupado';
      default: return 'Offline';
    }
  }
</script>

{#if !profile}
  <div class="flex flex-col items-center justify-center p-16 text-center gap-4">
    <div class="p-5 rounded-3xl liquid-glass border border-white/[0.1] text-[#66D7D1]">
      <Users class="w-10 h-10 animate-bounce" />
    </div>
    <h2 class="text-xl font-bold text-[#F2EFEA]">{$t('profile.noProfileSelected')}</h2>
    <p class="text-xs text-[#F2EFEA]/60 max-w-sm">
      {$t('profile.noProfileDesc')}
    </p>
    <button
      onclick={() => isAuthModalOpen.set(true)}
      class="mt-2 px-5 py-2.5 rounded-2xl bg-[#FC7753] hover:bg-[#FC7753]/90 text-white font-bold text-xs shadow-lg shadow-[#FC7753]/25 transition"
    >
      {$t('profile.loginOrRegister')}
    </button>
  </div>
{:else}
  <div class="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-16">
    <!-- BANNER E CABEÇALHO TWITTER/X STYLE -->
    <div class="relative rounded-3xl overflow-hidden liquid-glass border border-white/[0.12] shadow-2xl">
      <!-- Imagem de Capa do Perfil (Banner Panorâmico) -->
      <div class="h-52 md:h-64 w-full relative overflow-hidden bg-gradient-to-r from-[#403D58] via-[#1b1a29] to-[#09090d]">
        {#if profile.banner_url}
          <img 
            src={profile.banner_url} 
            alt="Banner de {profile.display_name}" 
            class="w-full h-full object-cover opacity-90"
          />
        {:else}
          <!-- Banner Artístico Vetorial Pulsar Padrão -->
          <div class="w-full h-full flex items-center justify-center relative opacity-40">
            <div class="absolute w-96 h-96 rounded-full bg-[#FC7753]/20 blur-3xl -top-20 -left-20"></div>
            <div class="absolute w-96 h-96 rounded-full bg-[#66D7D1]/20 blur-3xl -bottom-20 -right-20"></div>
            <svg class="w-full h-full opacity-20" viewBox="0 0 800 200" fill="none" preserveAspectRatio="none">
              <path d="M0 100 Q 200 20, 400 100 T 800 100" stroke="#66D7D1" stroke-width="2" fill="none" />
              <path d="M0 130 Q 200 50, 400 130 T 800 130" stroke="#FC7753" stroke-width="2" fill="none" />
              <path d="M0 70 Q 200 10, 400 70 T 800 70" stroke="#DBD56E" stroke-width="1.5" fill="none" />
            </svg>
          </div>
        {/if}
      </div>

      <!-- Área de Informações do Usuário (Avatar sobreposto e botões) -->
      <div class="px-4 sm:px-8 pb-6 pt-4 flex flex-col gap-5 relative">
        <!-- Linha Superior: Avatar e Ações -->
        <div class="flex flex-wrap items-end justify-between gap-3 -mt-14 sm:-mt-16 md:-mt-20">
          <!-- Avatar Circular com Borda Liquid Glass e Presença -->
          <div class="relative group">
            <div class="w-28 h-28 md:w-32 md:h-32 rounded-full p-1 bg-[#09090d] border-2 border-white/[0.15] shadow-2xl overflow-hidden relative">
              <img 
                src={profile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.username}`} 
                alt={profile.display_name} 
                class="w-full h-full rounded-full object-cover bg-[#403D58]/40"
              />
            </div>
            
            <!-- Indicador de Presença em Tempo Real -->
            <div 
              class="absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-[#09090d] {getStatusColor(profile.presence_status)}"
              title={getStatusLabel(profile.presence_status)}
            ></div>
          </div>

          <!-- Botões de Ação Dinâmicos -->
          <div class="flex items-center gap-2.5 pb-2">
            {#if isOwnProfile}
              <button
                onclick={() => isEditProfileModalOpen.set(true)}
                class="flex items-center gap-2 px-4 py-2 rounded-2xl liquid-glass hover:bg-white/[0.12] text-xs font-bold text-[#F2EFEA] border border-white/[0.12] transition shadow-md cursor-pointer"
              >
                <Edit3 class="w-3.5 h-3.5 text-[#66D7D1]" />
                <span>{$t('profile.editProfile')}</span>
              </button>

              <button
                onclick={() => authActions.logout()}
                class="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FC7753]/10 hover:bg-[#FC7753]/20 text-xs font-bold text-[#FC7753] border border-[#FC7753]/30 transition shadow-md shadow-[#FC7753]/10 cursor-pointer"
                title="{$t('common.logout')}"
              >
                <LogOut class="w-3.5 h-3.5" />
                <span>{$t('common.logout')}</span>
              </button>
            {:else}
              <button
                onclick={handleFollowToggle}
                class="flex items-center gap-2 px-5 py-2 rounded-2xl font-bold text-xs transition shadow-lg cursor-pointer {isFollowing ? 'liquid-glass text-[#F2EFEA] hover:border-[#FC7753]/50' : 'bg-[#FC7753] hover:bg-[#FC7753]/90 text-white shadow-[#FC7753]/25'}"
              >
                {#if isFollowing}
                  <UserCheck class="w-3.5 h-3.5 text-[#66D7D1]" />
                  <span>{$t('profile.following')}</span>
                {:else}
                  <UserPlus class="w-3.5 h-3.5" />
                  <span>{$t('profile.follow')}</span>
                {/if}
              </button>

              <button
                onclick={handleOpenChat}
                class="flex items-center gap-2 px-4 py-2 rounded-2xl liquid-glass hover:bg-white/[0.12] text-xs font-bold text-[#66D7D1] border border-white/[0.12] transition shadow-md cursor-pointer"
              >
                <MessageSquare class="w-3.5 h-3.5" />
                <span>{$t('social.chat')}</span>
              </button>

              {#if !isFriend}
                <button
                  onclick={handleAddFriend}
                  class="p-2 rounded-2xl liquid-glass hover:bg-white/[0.12] text-[#DBD56E] border border-white/[0.1] transition cursor-pointer"
                  title="{$t('social.addFriend')}"
                >
                  <Plus class="w-4 h-4" />
                </button>
              {/if}
            {/if}
          </div>
        </div>

        <!-- Dados do Usuário: Nome, Tag Alfanumérica e Bio -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="text-2xl font-extrabold tracking-tight text-[#F2EFEA]">
              {profile.display_name || profile.username}
            </h1>

            <!-- Handle e Tag Alfanumérica Twitter/Discord Style -->
            <button
              onclick={copyHandleTag}
              class="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition text-xs font-mono text-[#66D7D1] cursor-pointer group"
              title="{$t('common.copy')}"
            >
              <span class="font-bold">@{profile.username}</span>
              <span class="text-[#FC7753] font-black">#{profile.tag}</span>
              {#if copiedTag}
                <Check class="w-3 h-3 text-[#66D7D1]" />
              {:else}
                <Copy class="w-3 h-3 text-[#F2EFEA]/30 group-hover:text-[#66D7D1] transition" />
              {/if}
            </button>
          </div>

          <!-- Bio -->
          {#if profile.bio}
            <p class="text-xs md:text-sm text-[#F2EFEA]/80 leading-relaxed max-w-2xl pt-1">
              {profile.bio}
            </p>
          {/if}

          <!-- Status / Ouvindo Agora Dinâmico (Liquid Badge) -->
          {#if profile.current_track_title}
            <div class="flex items-center gap-2.5 mt-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#66D7D1]/15 to-transparent border border-[#66D7D1]/30 w-fit">
              <div class="w-2 h-2 rounded-full bg-[#66D7D1] animate-ping"></div>
              <Music2 class="w-3.5 h-3.5 text-[#66D7D1]" />
              <div class="text-xs">
                <span class="text-[#F2EFEA]/60">{$t('profile.nowPlaying')} </span>
                <span class="font-bold text-[#F2EFEA]">{profile.current_track_title}</span>
              </div>
            </div>
          {/if}

          <!-- Metadados: Data de Entrada e Contadores -->
          <div class="flex items-center gap-6 pt-3 text-xs text-[#F2EFEA]/60 flex-wrap">
            <div class="flex items-center gap-1.5">
              <Calendar class="w-3.5 h-3.5 text-[#F2EFEA]/40" />
              <span>{$t('profile.joinedIn')} {new Date(profile.created_at || Date.now()).toLocaleDateString($currentLocale, { month: 'short', year: 'numeric' })}</span>
            </div>

            <div class="flex items-center gap-4">
              <div class="flex items-center gap-1">
                <span class="font-bold text-[#F2EFEA]">{profile.following_count || 0}</span>
                <span class="text-[#F2EFEA]/50">{$t('profile.followingCount')}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="font-bold text-[#F2EFEA]">{profile.followers_count || 0}</span>
                <span class="text-[#F2EFEA]/50">{$t('profile.followersCount')}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="font-bold text-[#F2EFEA]">{$playlists.length}</span>
                <span class="text-[#F2EFEA]/50">{$t('profile.playlistsCount')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- NAVEGAÇÃO POR ABAS DO PERFIL -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.08] pb-2 sm:pb-1 gap-3">
      <div class="flex items-center gap-2">
        <button
          onclick={() => activeTab = 'playlists'}
          class="px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 {activeTab === 'playlists' ? 'liquid-glass text-[#66D7D1] border border-white/[0.12] shadow-md' : 'text-[#F2EFEA]/50 hover:text-[#F2EFEA]'}"
        >
          <Music2 class="w-3.5 h-3.5" />
          <span>{$t('profile.createdPlaylists')} ({filteredPlaylists.length})</span>
        </button>

        <button
          onclick={() => activeTab = 'favorites'}
          class="px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 {activeTab === 'favorites' ? 'liquid-glass text-[#FC7753] border border-white/[0.12] shadow-md' : 'text-[#F2EFEA]/50 hover:text-[#F2EFEA]'}"
        >
          <Flame class="w-3.5 h-3.5" />
          <span>{$t('profile.likedSongs')} ({userFavoriteTracks.length})</span>
        </button>
      </div>

      <!-- Filtros de Visibilidade para as Playlists -->
      {#if activeTab === 'playlists'}
        <div class="flex items-center gap-1.5 bg-white/[0.03] p-1 rounded-2xl border border-white/[0.06]">
          <button
            onclick={() => playlistVisibilityFilter = 'all'}
            class="px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer {playlistVisibilityFilter === 'all' ? 'bg-[#66D7D1]/20 text-[#66D7D1]' : 'text-[#F2EFEA]/40 hover:text-[#F2EFEA]'}"
          >
            {$t('common.all')}
          </button>
          <button
            onclick={() => playlistVisibilityFilter = 'public'}
            class="px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 {playlistVisibilityFilter === 'public' ? 'bg-[#66D7D1]/20 text-[#66D7D1]' : 'text-[#F2EFEA]/40 hover:text-[#F2EFEA]'}"
          >
            <Globe class="w-3 h-3" />
            <span>{$t('common.public')}</span>
          </button>
          <button
            onclick={() => playlistVisibilityFilter = 'shared'}
            class="px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 {playlistVisibilityFilter === 'shared' ? 'bg-[#DBD56E]/20 text-[#DBD56E]' : 'text-[#F2EFEA]/40 hover:text-[#F2EFEA]'}"
          >
            <Share2 class="w-3 h-3" />
            <span>{$t('common.friends')}</span>
          </button>
          <button
            onclick={() => playlistVisibilityFilter = 'private'}
            class="px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 {playlistVisibilityFilter === 'private' ? 'bg-[#FC7753]/20 text-[#FC7753]' : 'text-[#F2EFEA]/40 hover:text-[#F2EFEA]'}"
          >
            <Lock class="w-3 h-3" />
            <span>{$t('common.private')}</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- CONTEÚDO DA ABA ATIVA -->
    <div>
      {#if activeTab === 'playlists'}
        {#if filteredPlaylists.length === 0}
          <div class="liquid-glass rounded-3xl p-12 text-center flex flex-col items-center gap-3 border border-white/[0.08]">
            <Music2 class="w-8 h-8 text-[#F2EFEA]/20" />
            <p class="text-xs text-[#F2EFEA]/50">{$t('profile.emptyCategory')}</p>
          </div>
        {:else}
          <PlaylistGrid playlists={filteredPlaylists} />
        {/if}
      {:else if activeTab === 'favorites'}
        {#if userFavoriteTracks.length === 0}
          <div class="liquid-glass rounded-3xl p-12 text-center flex flex-col items-center gap-3 border border-white/[0.08]">
            <Flame class="w-8 h-8 text-[#F2EFEA]/20" />
            <p class="text-xs text-[#F2EFEA]/50">{$t('profile.emptyFavorites')}</p>
          </div>
        {:else}
          <div class="liquid-glass rounded-3xl p-3 border border-white/[0.1]">
            <TrackList tracks={userFavoriteTracks} />
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}
