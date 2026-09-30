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
    Flame,
    Bookmark,
    ArrowLeft
  } from '@lucide/svelte';

  // Perfil alvo (se viewedProfile estiver definido, mostra ele; senão, mostra currentProfile)
  let profile = $derived<UserProfile | null>($viewedProfile || $currentProfile);
  let isOwnProfile = $derived(($currentProfile && profile && $currentProfile.id === profile.id) || ($currentUser && profile && $currentUser.id === profile.id));

  let activeTab = $state<'playlists' | 'saved' | 'favorites'>('playlists');
  let playlistVisibilityFilter = $state<PlaylistVisibility | 'all'>('all');
  let copiedTag = $state(false);

  // Playlists públicas adicionais de terceiros buscadas da nuvem
  let cloudPublicPlaylists = $state<Playlist[]>([]);
  let cloudFollowedPlaylists = $state<Playlist[]>([]);
  let isLoadingCloudPlaylists = $state(false);

  $effect(() => {
    const targetProf = profile;
    if (targetProf && !targetProf.id.startsWith('guest')) {
      isLoadingCloudPlaylists = true;
      (async () => {
        try {
          const { getSupabase } = await import('../api/supabase');
          const supabase = getSupabase();
          if (supabase) {
            // Se não for o próprio perfil, busca as playlists criadas por ele
            if (!isOwnProfile) {
              const { data } = await supabase
                .from('cloud_playlists')
                .select('*')
                .eq('user_id', targetProf.id)
                .eq('visibility', 'public')
                .order('play_count', { ascending: false });

              if (data) {
                cloudPublicPlaylists = data.map(cp => ({
                  id: cp.id,
                  name: cp.name,
                  description: cp.description || '',
                  cover_image: cp.cover_image_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
                  created_at: cp.created_at ? cp.created_at.split('T')[0] : '',
                  is_imported_youtube_playlist: cp.is_imported_youtube_playlist || false,
                  source_youtube_playlist_id: cp.source_youtube_playlist_id,
                  track_count: cp.track_count || 0,
                  total_duration_seconds: cp.total_duration_seconds || 0,
                  visibility: cp.visibility || 'public',
                  user_id: cp.user_id,
                  owner_name: targetProf.display_name || targetProf.username,
                  owner_username: targetProf.username,
                  owner_avatar_url: targetProf.avatar_url,
                  is_followed: $playlists.some(p => p.id === cp.id && p.is_followed),
                  play_count: cp.play_count || 0
                }));
              }
            } else {
              cloudPublicPlaylists = [];
            }

            // Buscar SEMPRE as playlists seguidas pelo perfil visualizado (seja o próprio ou de terceiro)
            const { data: followedData } = await supabase
              .from('playlist_follows')
              .select('playlist_id')
              .eq('user_id', targetProf.id);

            if (followedData && followedData.length > 0) {
              const followedIds = followedData.map(f => f.playlist_id);
              const { data: extPls } = await supabase
                .from('cloud_playlists')
                .select('*')
                .in('id', followedIds);

              if (extPls && extPls.length > 0) {
                const creatorIds = Array.from(new Set(extPls.map(p => p.user_id).filter(Boolean)));
                let pMap = new Map();
                if (creatorIds.length > 0) {
                  const { data: creators } = await supabase
                    .from('profiles')
                    .select('id, username, display_name, avatar_url')
                    .in('id', creatorIds);
                  if (creators) pMap = new Map(creators.map(c => [c.id, c]));
                }

                cloudFollowedPlaylists = extPls.map(p => {
                  const cProf = pMap.get(p.user_id);
                  return {
                    id: p.id,
                    name: p.name,
                    description: p.description || '',
                    cover_image: p.cover_image_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
                    created_at: p.created_at ? p.created_at.split('T')[0] : '',
                    is_imported_youtube_playlist: p.is_imported_youtube_playlist || false,
                    source_youtube_playlist_id: p.source_youtube_playlist_id,
                    track_count: p.track_count || 0,
                    total_duration_seconds: p.total_duration_seconds || 0,
                    visibility: p.visibility || 'public',
                    user_id: p.user_id,
                    owner_name: cProf?.display_name || cProf?.username || 'Pulsar',
                    owner_username: cProf?.username,
                    owner_avatar_url: cProf?.avatar_url,
                    is_followed: true,
                    play_count: p.play_count || 0
                  };
                });
              } else {
                cloudFollowedPlaylists = [];
              }
            } else {
              cloudFollowedPlaylists = [];
            }
          }
        } catch {
          // ignora falhas de rede em perfis
        } finally {
          isLoadingCloudPlaylists = false;
        }
      })();
    } else {
      cloudPublicPlaylists = [];
      cloudFollowedPlaylists = [];
    }
  });

  // Determina se o usuário logado segue o perfil visualizado
  let isFollowing = $derived(
    profile ? $socialState.followingIds.includes(profile.id) : false
  );

  // Determina se já são amigos
  let isFriend = $derived(
    profile ? $socialState.friends.some((f: Friendship) => f.friend_id === profile?.id && f.status === 'accepted') : false
  );

  // Filtra as playlists criadas estritamente para o perfil exibido
  let createdPlaylists = $derived.by(() => {
    if (!profile) return [];
    
    // 1. Playlists locais com pertencimento estrito
    const localOwned = $playlists.filter((pl: Playlist) => {
      if (pl.user_id) return pl.user_id === profile?.id;
      if (isOwnProfile && (!profile?.id || profile.id.startsWith('guest'))) {
        return !pl.user_id || pl.user_id === 'guest-local-user';
      }
      return false;
    });

    // 2. Mesclar com as públicas da nuvem para perfis de outros usuários
    const listMap = new Map<string, Playlist>();
    for (const pl of localOwned) listMap.set(pl.id, pl);
    for (const cp of cloudPublicPlaylists) {
      if (!listMap.has(cp.id)) listMap.set(cp.id, cp);
    }

    const merged = Array.from(listMap.values());
    if (playlistVisibilityFilter === 'all') return merged;
    return merged.filter(pl => (pl.visibility || 'public') === playlistVisibilityFilter);
  });

  // Filtra as playlists seguidas pelo usuário (mesclando dados locais e nuvem)
  let followedPlaylists = $derived.by(() => {
    if (!profile) return [];
    const localFollowed = $playlists.filter((pl: Playlist) => {
      const isOwner = pl.user_id ? pl.user_id === profile.id : false;
      return pl.is_followed && !isOwner;
    });

    const map = new Map<string, Playlist>();
    for (const pl of localFollowed) map.set(pl.id, pl);
    for (const cp of cloudFollowedPlaylists) {
      if (!map.has(cp.id)) map.set(cp.id, cp);
    }
    return Array.from(map.values());
  });

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
      case 'online': return 'bg-[#3093AA] shadow-[0_0_10px_#3093AA]';
      case 'away': return 'bg-[#F3B044] shadow-[0_0_10px_#F3B044]';
      case 'busy': return 'bg-[#EF7D4B] shadow-[0_0_10px_#EF7D4B]';
      default: return 'bg-[#F0F0F5]/30';
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
    <div class="p-5 rounded-3xl lq-glass-frost border border-white/[0.1] text-[#3093AA]">
      <Users class="w-10 h-10 animate-bounce" />
    </div>
    <h2 class="text-xl font-bold text-[#F0F0F5]">{$t('profile.noProfileSelected')}</h2>
    <p class="text-xs text-[#F0F0F5]/60 max-w-sm">
      {$t('profile.noProfileDesc')}
    </p>
    <button
      onclick={() => isAuthModalOpen.set(true)}
      class="mt-2 px-5 py-2.5 rounded-2xl bg-[#EF7D4B] hover:bg-[#EF7D4B]/90 text-white font-bold text-xs shadow-lg shadow-[#EF7D4B]/25 transition"
    >
      {$t('profile.loginOrRegister')}
    </button>
  </div>
{:else}
  <div class="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-16">
    <!-- BANNER E CABEÇALHO TWITTER/X STYLE -->
    <div class="relative rounded-3xl overflow-hidden lq-glass-frost border border-white/[0.12] shadow-2xl">
      {#if !isOwnProfile}
        <!-- Botão Flutuante de Retorno ao Próprio Perfil -->
        <div class="absolute top-4 left-4 z-20 animate-fade-in">
          <button
            type="button"
            onclick={() => authActions.viewMyProfile()}
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white/90 hover:text-white text-xs font-semibold border border-white/[0.18] shadow-lg hover:border-[#3093AA]/50 transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft class="w-3.5 h-3.5 text-[#3093AA]" />
            <span>Voltar ao meu perfil</span>
          </button>
        </div>
      {/if}

      <!-- Imagem de Capa do Perfil (Banner Panorâmico) -->
      <div class="h-52 md:h-64 w-full relative overflow-hidden bg-gradient-to-r from-[#1E1E1C] via-[#1b1a29] to-[#0B1020]">
        {#if profile.banner_url}
          <img 
            src={profile.banner_url} 
            alt="Banner de {profile.display_name}" 
            class="w-full h-full object-cover opacity-90"
          />
        {:else}
          <!-- Banner Artístico Vetorial Pulsar Padrão -->
          <div class="w-full h-full flex items-center justify-center relative opacity-40">
            <div class="absolute w-96 h-96 rounded-full bg-[#EF7D4B]/20 blur-3xl -top-20 -left-20"></div>
            <div class="absolute w-96 h-96 rounded-full bg-[#3093AA]/20 blur-3xl -bottom-20 -right-20"></div>
            <svg class="w-full h-full opacity-20" viewBox="0 0 800 200" fill="none" preserveAspectRatio="none">
              <path d="M0 100 Q 200 20, 400 100 T 800 100" stroke="#3093AA" stroke-width="2" fill="none" />
              <path d="M0 130 Q 200 50, 400 130 T 800 130" stroke="#EF7D4B" stroke-width="2" fill="none" />
              <path d="M0 70 Q 200 10, 400 70 T 800 70" stroke="#F3B044" stroke-width="1.5" fill="none" />
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
            <div class="w-28 h-28 md:w-32 md:h-32 rounded-full p-1 bg-[#0B1020] border-2 border-white/[0.15] shadow-2xl overflow-hidden relative">
              <img 
                src={profile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.username}`} 
                alt={profile.display_name} 
                class="w-full h-full rounded-full object-cover bg-[#1E1E1C]/40"
              />
            </div>
            
            <!-- Indicador de Presença em Tempo Real -->
            <div 
              class="absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-[#0B1020] {getStatusColor(profile.presence_status)}"
              title={getStatusLabel(profile.presence_status)}
            ></div>
          </div>

          <!-- Botões de Ação Dinâmicos -->
          <div class="flex items-center gap-2.5 pb-2">
            {#if isOwnProfile}
              <button
                onclick={() => isEditProfileModalOpen.set(true)}
                class="flex items-center gap-2 px-4 py-2 rounded-2xl lq-glass-frost hover:bg-white/[0.12] text-xs font-bold text-[#F0F0F5] border border-white/[0.12] transition shadow-md cursor-pointer"
              >
                <Edit3 class="w-3.5 h-3.5 text-[#3093AA]" />
                <span>{$t('profile.editProfile')}</span>
              </button>

              <button
                onclick={() => authActions.logout()}
                class="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#EF7D4B]/10 hover:bg-[#EF7D4B]/20 text-xs font-bold text-[#EF7D4B] border border-[#EF7D4B]/30 transition shadow-md shadow-[#EF7D4B]/10 cursor-pointer"
                title="{$t('common.logout')}"
              >
                <LogOut class="w-3.5 h-3.5" />
                <span>{$t('common.logout')}</span>
              </button>
            {:else}
              <button
                onclick={() => authActions.viewMyProfile()}
                class="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl lq-glass-frost hover:bg-white/[0.12] text-xs font-semibold text-white/80 hover:text-white border border-white/[0.12] transition shadow-md cursor-pointer"
                title="Voltar ao meu perfil pessoal"
              >
                <ArrowLeft class="w-3.5 h-3.5 text-[#3093AA]" />
                <span class="hidden sm:inline">Meu Perfil</span>
              </button>

              <button
                onclick={handleFollowToggle}
                class="flex items-center gap-2 px-5 py-2 rounded-2xl font-bold text-xs transition shadow-lg cursor-pointer {isFollowing ? 'lq-glass-frost text-[#F0F0F5] hover:border-[#EF7D4B]/50' : 'bg-[#EF7D4B] hover:bg-[#EF7D4B]/90 text-white shadow-[#EF7D4B]/25'}"
              >
                {#if isFollowing}
                  <UserCheck class="w-3.5 h-3.5 text-[#3093AA]" />
                  <span>{$t('profile.following')}</span>
                {:else}
                  <UserPlus class="w-3.5 h-3.5" />
                  <span>{$t('profile.follow')}</span>
                {/if}
              </button>

              <button
                onclick={handleOpenChat}
                class="flex items-center gap-2 px-4 py-2 rounded-2xl lq-glass-frost hover:bg-white/[0.12] text-xs font-bold text-[#3093AA] border border-white/[0.12] transition shadow-md cursor-pointer"
              >
                <MessageSquare class="w-3.5 h-3.5" />
                <span>{$t('social.chat')}</span>
              </button>

              {#if !isFriend}
                <button
                  onclick={handleAddFriend}
                  class="p-2 rounded-2xl lq-glass-frost hover:bg-white/[0.12] text-[#F3B044] border border-white/[0.1] transition cursor-pointer"
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
            <h1 class="text-2xl font-extrabold tracking-tight text-[#F0F0F5]">
              {profile.display_name || profile.username}
            </h1>

            <!-- Handle e Tag Alfanumérica Twitter/Discord Style -->
            <button
              onclick={copyHandleTag}
              class="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition text-xs font-mono text-[#3093AA] cursor-pointer group"
              title="{$t('common.copy')}"
            >
              <span class="font-bold">@{profile.username}</span>
              <span class="text-[#EF7D4B] font-black">#{profile.tag}</span>
              {#if copiedTag}
                <Check class="w-3 h-3 text-[#3093AA]" />
              {:else}
                <Copy class="w-3 h-3 text-[#F0F0F5]/30 group-hover:text-[#3093AA] transition" />
              {/if}
            </button>
          </div>

          <!-- Bio -->
          {#if profile.bio}
            <p class="text-xs md:text-sm text-[#F0F0F5]/80 leading-relaxed max-w-2xl pt-1">
              {profile.bio}
            </p>
          {/if}

          <!-- Status / Ouvindo Agora Dinâmico (Liquid Badge) -->
          {#if profile.current_track_title}
            <div class="flex items-center gap-2.5 mt-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#3093AA]/15 to-transparent border border-[#3093AA]/30 w-fit">
              <div class="w-2 h-2 rounded-full bg-[#3093AA] animate-ping"></div>
              <Music2 class="w-3.5 h-3.5 text-[#3093AA]" />
              <div class="text-xs">
                <span class="text-[#F0F0F5]/60">{$t('profile.nowPlaying')} </span>
                <span class="font-bold text-[#F0F0F5]">{profile.current_track_title}</span>
              </div>
            </div>
          {/if}

          <!-- Metadados: Data de Entrada e Contadores -->
          <div class="flex items-center gap-6 pt-3 text-xs text-[#F0F0F5]/60 flex-wrap">
            <div class="flex items-center gap-1.5">
              <Calendar class="w-3.5 h-3.5 text-[#F0F0F5]/40" />
              <span>{$t('profile.joinedIn')} {new Date(profile.created_at || Date.now()).toLocaleDateString($currentLocale, { month: 'short', year: 'numeric' })}</span>
            </div>

            <div class="flex items-center gap-4">
              <div class="flex items-center gap-1">
                <span class="font-bold text-[#F0F0F5]">{profile.following_count || 0}</span>
                <span class="text-[#F0F0F5]/50">{$t('profile.followingCount')}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="font-bold text-[#F0F0F5]">{profile.followers_count || 0}</span>
                <span class="text-[#F0F0F5]/50">{$t('profile.followersCount')}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="font-bold text-[#F0F0F5]">{createdPlaylists.length}</span>
                <span class="text-[#F0F0F5]/50">{$t('profile.playlistsCount')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- NAVEGAÇÃO POR ABAS DO PERFIL -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.08] pb-2 sm:pb-1 gap-3">
      <div class="flex items-center gap-2 flex-wrap">
        <button
          onclick={() => activeTab = 'playlists'}
          class="px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 {activeTab === 'playlists' ? 'lq-glass-frost text-[#3093AA] border border-white/[0.12] shadow-md' : 'text-[#F0F0F5]/50 hover:text-[#F0F0F5]'}"
        >
          <Music2 class="w-3.5 h-3.5" />
          <span>{$t('profile.createdPlaylists')} ({createdPlaylists.length})</span>
        </button>

        <button
          onclick={() => activeTab = 'saved'}
          class="px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 {activeTab === 'saved' ? 'lq-glass-frost text-[#3093AA] border border-white/[0.12] shadow-md' : 'text-[#F0F0F5]/50 hover:text-[#F0F0F5]'}"
        >
          <Bookmark class="w-3.5 h-3.5" />
          <span>Playlists Seguidas ({followedPlaylists.length})</span>
        </button>

        <button
          onclick={() => activeTab = 'favorites'}
          class="px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 {activeTab === 'favorites' ? 'lq-glass-frost text-[#EF7D4B] border border-white/[0.12] shadow-md' : 'text-[#F0F0F5]/50 hover:text-[#F0F0F5]'}"
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
            class="px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer {playlistVisibilityFilter === 'all' ? 'bg-[#3093AA]/20 text-[#3093AA]' : 'text-[#F0F0F5]/40 hover:text-[#F0F0F5]'}"
          >
            {$t('common.all')}
          </button>
          <button
            onclick={() => playlistVisibilityFilter = 'public'}
            class="px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 {playlistVisibilityFilter === 'public' ? 'bg-[#3093AA]/20 text-[#3093AA]' : 'text-[#F0F0F5]/40 hover:text-[#F0F0F5]'}"
          >
            <Globe class="w-3 h-3" />
            <span>{$t('common.public')}</span>
          </button>
          <button
            onclick={() => playlistVisibilityFilter = 'shared'}
            class="px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 {playlistVisibilityFilter === 'shared' ? 'bg-[#F3B044]/20 text-[#F3B044]' : 'text-[#F0F0F5]/40 hover:text-[#F0F0F5]'}"
          >
            <Share2 class="w-3 h-3" />
            <span>{$t('common.friends')}</span>
          </button>
          <button
            onclick={() => playlistVisibilityFilter = 'private'}
            class="px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 {playlistVisibilityFilter === 'private' ? 'bg-[#EF7D4B]/20 text-[#EF7D4B]' : 'text-[#F0F0F5]/40 hover:text-[#F0F0F5]'}"
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
        {#if createdPlaylists.length === 0}
          <div class="lq-glass-frost rounded-3xl p-12 text-center flex flex-col items-center gap-3 border border-white/[0.08]">
            <Music2 class="w-8 h-8 text-[#F0F0F5]/20" />
            <p class="text-xs text-[#F0F0F5]/50">{$t('profile.emptyCategory')}</p>
          </div>
        {:else}
          <PlaylistGrid playlists={createdPlaylists} />
        {/if}
      {:else if activeTab === 'saved'}
        {#if followedPlaylists.length === 0}
          <div class="lq-glass-frost rounded-3xl p-12 text-center flex flex-col items-center gap-3 border border-white/[0.08]">
            <Bookmark class="w-8 h-8 text-[#F0F0F5]/20" />
            <p class="text-xs text-[#F0F0F5]/50">Nenhuma playlist seguida no momento.</p>
            <p class="text-[11px] text-[#F0F0F5]/30">Explore playlists públicas ou de amigos e clique em "Seguir Playlist" para salvá-las aqui!</p>
          </div>
        {:else}
          <PlaylistGrid playlists={followedPlaylists} />
        {/if}
      {:else if activeTab === 'favorites'}
        {#if userFavoriteTracks.length === 0}
          <div class="lq-glass-frost rounded-3xl p-12 text-center flex flex-col items-center gap-3 border border-white/[0.08]">
            <Flame class="w-8 h-8 text-[#F0F0F5]/20" />
            <p class="text-xs text-[#F0F0F5]/50">{$t('profile.emptyFavorites')}</p>
          </div>
        {:else}
          <div class="lq-glass-frost rounded-3xl p-3 border border-white/[0.1]">
            <TrackList tracks={userFavoriteTracks} />
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}
