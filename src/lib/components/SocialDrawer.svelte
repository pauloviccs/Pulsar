<script lang="ts">
  import { 
    isSocialDrawerOpen, 
    socialState, 
    socialActions, 
    activeChatFriend, 
    unreadMessageCount 
  } from '../stores/socialStore';
  import { 
    currentUser, 
    currentProfile,
    authActions 
  } from '../stores/authStore';
  import { playerActions } from '../stores/playerStore';
  import { t } from '../i18n';
  import type { PresenceStatus, Friendship } from '../types';
  import { 
    X, 
    UserPlus, 
    Users, 
    Bell, 
    MessageSquare, 
    Music2, 
    Play, 
    Check, 
    UserX, 
    Circle, 
    Search, 
    Sparkles, 
    ExternalLink,
    ChevronDown
  } from '@lucide/svelte';

  let currentTab = $state<'friends' | 'pending' | 'add'>('friends');
  let searchFriendQuery = $state('');
  let addFriendInput = $state('');
  let addFriendStatus = $state<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });

  $effect(() => {
    if ($isSocialDrawerOpen) {
      socialActions.loadFriends();
      socialActions.revalidateFriendsPresence();
    }
  });

  // Lista de amigos aceitos
  let acceptedFriends = $derived(
    $socialState.friends.filter((f: Friendship) => f.status === 'accepted')
  );

  // Amigos filtrados pela busca
  let filteredFriends = $derived(
    acceptedFriends.filter((f: Friendship) => {
      const q = searchFriendQuery.toLowerCase();
      return (
        f.friend_username.toLowerCase().includes(q) ||
        f.friend_display_name.toLowerCase().includes(q) ||
        f.friend_tag.toLowerCase().includes(q)
      );
    })
  );

  // Categorização por status de presença
  let onlineFriends = $derived(filteredFriends.filter((f: Friendship) => f.presence_status === 'online'));
  let awayFriends = $derived(filteredFriends.filter((f: Friendship) => f.presence_status === 'away'));
  let busyFriends = $derived(filteredFriends.filter((f: Friendship) => f.presence_status === 'busy'));
  let offlineFriends = $derived(filteredFriends.filter((f: Friendship) => !f.presence_status || f.presence_status === 'offline'));

  // Pedidos pendentes recebidos
  let pendingIncoming = $derived(
    $socialState.pendingRequests.filter((f: Friendship) => f.friend_id === $currentProfile?.id || f.friend_id === $currentUser?.id)
  );

  // Pedidos pendentes enviados
  let pendingOutgoing = $derived(
    $socialState.pendingRequests.filter((f: Friendship) => f.user_id === $currentProfile?.id || f.user_id === $currentUser?.id)
  );

  async function handleSendRequest() {
    if (!addFriendInput.includes('#')) {
      addFriendStatus = { type: 'error', message: 'Use o formato Nome#TAG (ex: Pulsar#7X9A)' };
      return;
    }

    const [username, tag] = addFriendInput.split('#');
    if (!username || !tag || tag.length !== 4) {
      addFriendStatus = { type: 'error', message: 'A tag deve conter exatamente 4 caracteres alfanuméricos.' };
      return;
    }

    const res = await socialActions.sendFriendRequest(username.trim(), tag.trim());
    if (res.success) {
      addFriendStatus = { type: 'success', message: `Solicitação enviada para ${username}#${tag.toUpperCase()}!` };
      addFriendInput = '';
      setTimeout(() => {
        addFriendStatus = { type: 'idle', message: '' };
        currentTab = 'friends';
      }, 1500);
    } else {
      addFriendStatus = { type: 'error', message: res.error || 'Erro ao enviar solicitação.' };
    }
  }

  function handleOpenChat(friend: Friendship) {
    activeChatFriend.set(friend);
  }

  function handleStatusChange(status: PresenceStatus) {
    authActions.updateStatus(status);
  }

  function getStatusColor(status?: PresenceStatus) {
    switch (status) {
      case 'online': return 'bg-[#3093AA] shadow-[0_0_8px_#3093AA]';
      case 'away': return 'bg-[#F3B044] shadow-[0_0_8px_#F3B044]';
      case 'busy': return 'bg-[#EF7D4B] shadow-[0_0_8px_#EF7D4B]';
      default: return 'bg-[#F0F0F5]/25';
    }
  }
</script>

{#if $isSocialDrawerOpen}
  <!-- Overlay Backdrop com Blur Apple Style -->
  <div 
    role="button"
    tabindex="0"
    onclick={() => isSocialDrawerOpen.set(false)}
    onkeydown={(e) => { if (e.key === 'Escape') isSocialDrawerOpen.set(false); }}
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
  ></div>

  <!-- Painel Gaveta Lateral Direito Liquid Glass -->
  <aside 
    class="fixed top-0 right-0 bottom-0 w-84 md:w-96 z-50 flex flex-col bg-[#0B1020]/92 backdrop-blur-3xl border-l border-white/[0.1] shadow-2xl animate-in slide-in-from-right duration-300 select-none"
  >
    <!-- Header da Gaveta Social -->
    <div class="p-5 border-b border-white/[0.08] flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <Users class="w-5 h-5 text-[#3093AA]" />
          <h2 class="text-sm font-extrabold text-[#F0F0F5] tracking-tight">{$t('socialDrawer.title')}</h2>
        </div>

        <button
          onclick={() => isSocialDrawerOpen.set(false)}
          class="p-1.5 rounded-xl text-[#F0F0F5]/40 hover:text-[#F0F0F5] hover:bg-white/[0.06] transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Card do Próprio Usuário com Seletor de Presença -->
      {#if $currentProfile}
        <div class="p-3 rounded-2xl lq-glass-frost border border-white/[0.08] flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="relative shrink-0">
              <img 
                src={$currentProfile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${$currentProfile.username}`} 
                alt={$currentProfile.display_name} 
                class="w-9 h-9 rounded-full object-cover border border-white/[0.15]"
              />
              <div class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0B1020] {getStatusColor($currentProfile.presence_status)}"></div>
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-1.5 truncate">
                <span class="text-xs font-bold text-[#F0F0F5] truncate">{$currentProfile.display_name}</span>
                <span class="text-[10px] font-mono text-[#3093AA]">#{$currentProfile.tag}</span>
              </div>
              <p class="text-[10px] text-[#F0F0F5]/50 truncate">
                {$currentProfile.current_track_title ? `Ouvindo: ${$currentProfile.current_track_title}` : $t('socialDrawer.noPlaying')}
              </p>
            </div>
          </div>

          <!-- Pílulas rápidas de status -->
          <div class="flex items-center gap-1 pl-2">
            <button
              type="button"
              onclick={() => handleStatusChange('online')}
              class="w-3 h-3 rounded-full bg-[#3093AA] {$currentProfile.presence_status === 'online' ? 'ring-2 ring-white scale-110' : 'opacity-40 hover:opacity-100'} transition cursor-pointer"
              title="{$t('socialDrawer.statusOnline')}"
            ></button>
            <button
              type="button"
              onclick={() => handleStatusChange('away')}
              class="w-3 h-3 rounded-full bg-[#F3B044] {$currentProfile.presence_status === 'away' ? 'ring-2 ring-white scale-110' : 'opacity-40 hover:opacity-100'} transition cursor-pointer"
              title="{$t('socialDrawer.statusAway')}"
            ></button>
            <button
              type="button"
              onclick={() => handleStatusChange('busy')}
              class="w-3 h-3 rounded-full bg-[#EF7D4B] {$currentProfile.presence_status === 'busy' ? 'ring-2 ring-white scale-110' : 'opacity-40 hover:opacity-100'} transition cursor-pointer"
              title="{$t('socialDrawer.statusBusy')}"
            ></button>
            <button
              type="button"
              onclick={() => handleStatusChange('offline')}
              class="w-3 h-3 rounded-full bg-[#F0F0F5]/30 {$currentProfile.presence_status === 'offline' ? 'ring-2 ring-white scale-110' : 'opacity-40 hover:opacity-100'} transition cursor-pointer"
              title="{$t('socialDrawer.statusOffline')}"
            ></button>
          </div>
        </div>
      {/if}

      <!-- Abas de Navegação da Gaveta -->
      <div class="flex items-center gap-1 bg-white/[0.03] p-1 rounded-2xl border border-white/[0.06]">
        <button
          onclick={() => currentTab = 'friends'}
          class="flex-1 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer text-center {currentTab === 'friends' ? 'bg-[#3093AA]/20 text-[#3093AA]' : 'text-[#F0F0F5]/50 hover:text-[#F0F0F5]'}"
        >
          {$t('socialDrawer.friendsTab', { count: acceptedFriends.length })}
        </button>

        <button
          onclick={() => currentTab = 'pending'}
          class="flex-1 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer relative text-center {currentTab === 'pending' ? 'bg-[#F3B044]/20 text-[#F3B044]' : 'text-[#F0F0F5]/50 hover:text-[#F0F0F5]'}"
        >
          {$t('socialDrawer.pendingTab')}
          {#if pendingIncoming.length > 0}
            <span class="ml-1 px-1.5 py-0.2 rounded-full bg-[#EF7D4B] text-[9px] font-bold text-white">
              {pendingIncoming.length}
            </span>
          {/if}
        </button>

        <button
          onclick={() => currentTab = 'add'}
          class="flex-1 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer text-center flex items-center justify-center gap-1 {currentTab === 'add' ? 'bg-[#EF7D4B]/20 text-[#EF7D4B]' : 'text-[#F0F0F5]/50 hover:text-[#F0F0F5]'}"
        >
          <UserPlus class="w-3 h-3" />
          <span>{$t('socialDrawer.addTab')}</span>
        </button>
      </div>
    </div>

    <!-- Conteúdo da Gaveta -->
    <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      {#if currentTab === 'friends'}
        <!-- Busca Rápida de Amigos -->
        <div class="relative">
          <Search class="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#F0F0F5]/30 pointer-events-none" />
          <input
            type="text"
            bind:value={searchFriendQuery}
            placeholder={$t('socialDrawer.searchPlaceholder')}
            class="w-full py-2 pl-9 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-[#F0F0F5] placeholder:text-[#F0F0F5]/30 outline-none focus:border-[#3093AA]/50"
          />
        </div>

        {#if acceptedFriends.length === 0}
          <div class="py-12 text-center flex flex-col items-center gap-2">
            <Users class="w-8 h-8 text-[#F0F0F5]/20" />
            <p class="text-xs text-[#F0F0F5]/50">{$t('socialDrawer.emptyFriends')}</p>
            <button
              onclick={() => currentTab = 'add'}
              class="mt-2 text-xs font-bold text-[#3093AA] hover:underline cursor-pointer"
            >
              {$t('socialDrawer.addFirstFriend')}
            </button>
          </div>
        {:else}
          <!-- AMIGOS ONLINE -->
          {#if onlineFriends.length > 0}
            <div class="flex flex-col gap-1">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#3093AA] px-1">Online — {onlineFriends.length}</span>
              {#each onlineFriends as friend (friend.id)}
                <div class="p-2.5 rounded-2xl hover:bg-white/[0.05] transition flex items-center justify-between group border border-transparent hover:border-white/[0.08]">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="relative shrink-0">
                      <img 
                        src={friend.friend_avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${friend.friend_username}`} 
                        alt={friend.friend_display_name} 
                        class="w-9 h-9 rounded-full object-cover"
                      />
                      <div class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0B1020] bg-[#3093AA] shadow-[0_0_8px_#3093AA]"></div>
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1 truncate">
                        <span class="text-xs font-bold text-[#F0F0F5] truncate">{friend.friend_display_name}</span>
                        <span class="text-[10px] font-mono text-[#F0F0F5]/40">#{friend.friend_tag}</span>
                      </div>
                      {#if friend.current_track_title}
                        <div class="flex items-center gap-1 text-[10px] text-[#3093AA] truncate">
                          <Music2 class="w-3 h-3 shrink-0 animate-pulse" />
                          <span class="truncate">{friend.current_track_title}</span>
                        </div>
                      {:else}
                        <span class="text-[10px] text-[#F0F0F5]/40">Disponível</span>
                      {/if}
                    </div>
                  </div>

                  <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      onclick={() => handleOpenChat(friend)}
                      class="p-2 rounded-xl lq-glass-frost hover:bg-[#3093AA]/20 text-[#3093AA] transition cursor-pointer"
                      title="Abrir Chat"
                    >
                      <MessageSquare class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- AMIGOS AUSENTES OU OCUPADOS -->
          {#if awayFriends.length > 0 || busyFriends.length > 0}
            <div class="flex flex-col gap-1 pt-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#F3B044] px-1">Ausente / Ocupado — {awayFriends.length + busyFriends.length}</span>
              {#each [...awayFriends, ...busyFriends] as friend (friend.id)}
                <div class="p-2.5 rounded-2xl hover:bg-white/[0.05] transition flex items-center justify-between group">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="relative shrink-0">
                      <img 
                        src={friend.friend_avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${friend.friend_username}`} 
                        alt={friend.friend_display_name} 
                        class="w-9 h-9 rounded-full object-cover"
                      />
                      <div class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0B1020] {getStatusColor(friend.presence_status)}"></div>
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1 truncate">
                        <span class="text-xs font-bold text-[#F0F0F5] truncate">{friend.friend_display_name}</span>
                        <span class="text-[10px] font-mono text-[#F0F0F5]/40">#{friend.friend_tag}</span>
                      </div>
                      <span class="text-[10px] text-[#F0F0F5]/40">{friend.presence_status === 'busy' ? 'Ocupado' : 'Ausente'}</span>
                    </div>
                  </div>

                  <button
                    onclick={() => handleOpenChat(friend)}
                    class="p-2 rounded-xl text-[#F0F0F5]/40 hover:text-[#3093AA] hover:bg-white/[0.06] transition cursor-pointer"
                    title="Abrir Chat"
                  >
                    <MessageSquare class="w-3.5 h-3.5" />
                  </button>
                </div>
              {/each}
            </div>
          {/if}

          <!-- AMIGOS OFFLINE -->
          {#if offlineFriends.length > 0}
            <div class="flex flex-col gap-1 pt-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#F0F0F5]/30 px-1">Offline — {offlineFriends.length}</span>
              {#each offlineFriends as friend (friend.id)}
                <div class="p-2.5 rounded-2xl hover:bg-white/[0.03] transition flex items-center justify-between opacity-60 hover:opacity-90">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="relative shrink-0">
                      <img 
                        src={friend.friend_avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${friend.friend_username}`} 
                        alt={friend.friend_display_name} 
                        class="w-9 h-9 rounded-full object-cover grayscale"
                      />
                      <div class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0B1020] bg-[#F0F0F5]/20"></div>
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1 truncate">
                        <span class="text-xs font-bold text-[#F0F0F5] truncate">{friend.friend_display_name}</span>
                        <span class="text-[10px] font-mono text-[#F0F0F5]/40">#{friend.friend_tag}</span>
                      </div>
                      <span class="text-[10px] text-[#F0F0F5]/30">Offline</span>
                    </div>
                  </div>

                  <button
                    onclick={() => handleOpenChat(friend)}
                    class="p-2 rounded-xl text-[#F0F0F5]/30 hover:text-[#F0F0F5] transition cursor-pointer"
                    title="Abrir Chat"
                  >
                    <MessageSquare class="w-3.5 h-3.5" />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        {/if}

      {:else if currentTab === 'pending'}
        <!-- PEDIDOS PENDENTES -->
        <div class="flex flex-col gap-4">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#F3B044] px-1">
              Recebidos ({pendingIncoming.length})
            </span>
            {#if pendingIncoming.length === 0}
              <p class="text-xs text-[#F0F0F5]/40 p-3">Nenhuma solicitação de amizade pendente.</p>
            {:else}
              <div class="flex flex-col gap-2 mt-2">
                {#each pendingIncoming as req (req.id)}
                  <div class="p-3 rounded-2xl lq-glass-frost border border-white/[0.08] flex items-center justify-between">
                    <div class="flex items-center gap-2.5 truncate">
                      <div class="w-8 h-8 rounded-full bg-[#403D58] flex items-center justify-center font-bold text-xs text-[#F0F0F5]">
                        {req.friend_username.slice(0, 2).toUpperCase()}
                      </div>
                      <div class="truncate">
                        <p class="text-xs font-bold text-[#F0F0F5] truncate">{req.friend_display_name}</p>
                        <p class="text-[10px] font-mono text-[#3093AA]">@{req.friend_username}#{req.friend_tag}</p>
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5">
                      <button
                        onclick={() => socialActions.respondFriendRequest(req.id, true)}
                        class="p-2 rounded-xl bg-[#3093AA]/20 hover:bg-[#3093AA]/30 text-[#3093AA] transition cursor-pointer"
                        title="Aceitar"
                      >
                        <Check class="w-3.5 h-3.5" />
                      </button>
                      <button
                        onclick={() => socialActions.respondFriendRequest(req.id, false)}
                        class="p-2 rounded-xl bg-[#EF7D4B]/20 hover:bg-[#EF7D4B]/30 text-[#EF7D4B] transition cursor-pointer"
                        title="Recusar"
                      >
                        <UserX class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          {#if pendingOutgoing.length > 0}
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#F0F0F5]/40 px-1">
                Enviados ({pendingOutgoing.length})
              </span>
              <div class="flex flex-col gap-2 mt-2">
                {#each pendingOutgoing as req (req.id)}
                  <div class="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                    <div class="truncate">
                      <p class="text-xs font-bold text-[#F0F0F5] truncate">{req.friend_display_name}</p>
                      <p class="text-[10px] font-mono text-[#F0F0F5]/40">Aguardando resposta...</p>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

      {:else if currentTab === 'add'}
        <!-- ADICIONAR AMIGO POR USERNAME#TAG -->
        <div class="flex flex-col gap-4 p-2">
          <div class="flex flex-col gap-1">
            <h3 class="text-xs font-bold text-[#F0F0F5]">Adicionar por Nome e Tag</h3>
            <p class="text-[11px] text-[#F0F0F5]/60 leading-relaxed">
              Você pode adicionar amigos usando o nome de usuário seguido pela tag de 4 dígitos (ex: <span class="font-mono text-[#3093AA]">Pulsar#7X9A</span>).
            </p>
          </div>

          <div class="flex flex-col gap-2">
            <input
              type="text"
              bind:value={addFriendInput}
              placeholder="Ex: Kaue#4F82"
              class="w-full py-3 px-4 rounded-2xl liquid-input text-xs text-[#F0F0F5] placeholder:text-[#F0F0F5]/30 font-mono uppercase"
            />

            {#if addFriendStatus.type === 'error'}
              <p class="text-[11px] text-[#EF7D4B] font-medium">{addFriendStatus.message}</p>
            {:else if addFriendStatus.type === 'success'}
              <p class="text-[11px] text-[#3093AA] font-medium">{addFriendStatus.message}</p>
            {/if}

            <button
              onclick={handleSendRequest}
              class="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#EF7D4B] to-[#EF7D4B]/90 hover:from-[#EF7D4B]/95 hover:to-[#EF7D4B] text-white text-xs font-bold shadow-lg shadow-[#EF7D4B]/25 transition cursor-pointer mt-1"
            >
              Enviar Pedido de Amizade
            </button>
          </div>
        </div>
      {/if}
    </div>
  </aside>
{/if}
