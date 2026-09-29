<script lang="ts">
  import { 
    Bell, 
    CheckCheck, 
    Trash2, 
    UserPlus, 
    ListMusic, 
    MessageSquare, 
    X, 
    Sparkles, 
    ExternalLink,
    Clock,
    UserCheck
  } from '@lucide/svelte';
  import { 
    notifications, 
    unreadNotificationCount, 
    notificationActions,
    type NotificationItem 
  } from '../stores/notificationStore';
  import { authActions, currentProfile } from '../stores/authStore';
  import { socialActions, socialState } from '../stores/socialStore';
  import { libraryActions, playlists } from '../stores/libraryStore';
  import type { Friendship } from '../types';

  let isOpen = $state(false);

  function toggleOpen() {
    isOpen = !isOpen;
    if (isOpen && $unreadNotificationCount > 0) {
      // Aberto para o usuário conferir as notificações
    }
  }

  function closeDropdown() {
    isOpen = false;
  }

  function formatTimeAgo(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSec < 60) return 'agora';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d`;
      return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  }

  async function handleNotificationClick(item: NotificationItem) {
    await notificationActions.markAsRead(item.id);
    closeDropdown();

    if (item.type === 'follow' && item.actor_id) {
      authActions.viewUserProfile({
        id: item.actor_id,
        username: item.actor_username,
        avatar_url: item.actor_avatar_url,
        display_name: item.actor_display_name
      });
    } else if (item.type === 'playlist_follow' && item.target_id) {
      const pl = $playlists.find(p => p.id === item.target_id);
      if (pl) {
        libraryActions.setActiveView('playlist-detail', pl);
      }
    } else if (item.type === 'message' && item.actor_id) {
      const friend = $socialState.friends.find((f: Friendship) => f.friend_id === item.actor_id);
      if (friend) {
        socialActions.openDirectChat(friend);
      } else {
        authActions.viewUserProfile({
          id: item.actor_id,
          username: item.actor_username,
          avatar_url: item.actor_avatar_url,
          display_name: item.actor_display_name
        });
      }
    }
  }
</script>

<div class="relative inline-block select-none">
  <!-- BOTÃO DO SINO COM CONTADOR DINÂMICO -->
  <button
    type="button"
    onclick={toggleOpen}
    class="relative p-2 sm:p-2.5 rounded-full lq-glass-pill hover:bg-white/[0.12] text-white/80 hover:text-white transition-all duration-200 cursor-pointer shadow-md group active:scale-95"
    title="Central de Notificações"
    aria-label="Central de Notificações"
  >
    <Bell class="w-4 h-4 transition-transform duration-300 group-hover:rotate-12 {$unreadNotificationCount > 0 ? 'text-[#EF7D4B]' : 'text-white/70'}" />

    <!-- Badge com Contador Numeral -->
    {#if $unreadNotificationCount > 0}
      <span class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-[#EF7D4B] to-[#F3B044] text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-[#EF7D4B]/40 animate-pulse border border-[#0B1020]">
        {$unreadNotificationCount > 99 ? '99+' : $unreadNotificationCount}
      </span>
    {/if}
  </button>

  <!-- BACKDROP TRANSPARENTE PARA FECHAR AO CLICAR FORA -->
  {#if isOpen}
    <div 
      role="presentation"
      class="fixed inset-0 z-40 bg-transparent"
      onclick={closeDropdown}
      onkeydown={(e) => { if (e.key === 'Escape') closeDropdown(); }}
    ></div>

    <!-- PAINEL FLUTUANTE DA CENTRAL DE NOTIFICAÇÕES (LIQUID GLASS) -->
    <div 
      role="dialog"
      aria-modal="true"
      aria-label="Notificações"
      tabindex="-1"
      class="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 rounded-3xl lq-glass-elevated shadow-2xl p-4 flex flex-col gap-3 animate-apple-spring text-[#F0F0F5] border border-white/[0.14]"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Escape') closeDropdown(); }}
    >
      <!-- Header do Painel -->
      <div class="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
        <div class="flex items-center gap-2">
          <div class="p-1.5 rounded-xl bg-[#EF7D4B]/15 text-[#EF7D4B]">
            <Bell class="w-4 h-4" />
          </div>
          <h3 class="text-sm font-bold tracking-tight text-white">Notificações</h3>
          {#if $unreadNotificationCount > 0}
            <span class="px-2 py-0.5 rounded-full bg-[#EF7D4B]/20 text-[#EF7D4B] text-[10px] font-black">
              {$unreadNotificationCount} novas
            </span>
          {/if}
        </div>

        <div class="flex items-center gap-1">
          {#if $notifications.length > 0}
            <button
              type="button"
              onclick={() => notificationActions.markAllAsRead()}
              class="p-1.5 rounded-xl text-white/50 hover:text-[#3093AA] hover:bg-white/[0.06] transition cursor-pointer"
              title="Marcar todas como lidas"
            >
              <CheckCheck class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onclick={() => notificationActions.clearAll()}
              class="p-1.5 rounded-xl text-white/50 hover:text-[#EF7D4B] hover:bg-white/[0.06] transition cursor-pointer"
              title="Limpar todas as notificações"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          {/if}
        </div>
      </div>

      <!-- Lista de Notificações com Scroll Suave -->
      <div class="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-1">
        {#if $notifications.length === 0}
          <div class="py-10 flex flex-col items-center justify-center text-center gap-2 text-white/40">
            <div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <Bell class="w-6 h-6 opacity-40" />
            </div>
            <p class="text-xs font-medium text-white/60">Tudo em dia!</p>
            <p class="text-[11px] text-white/35 max-w-[200px]">Você não tem novas notificações no momento.</p>
          </div>
        {:else}
          {#each $notifications as item (item.id)}
            <div
              role="button"
              tabindex="0"
              onclick={() => handleNotificationClick(item)}
              onkeydown={(e) => { if (e.key === 'Enter') handleNotificationClick(item); }}
              class="flex items-start gap-3 p-3 rounded-2xl transition cursor-pointer group relative {item.is_read ? 'bg-white/[0.02] hover:bg-white/[0.05] text-white/70' : 'bg-white/[0.07] hover:bg-white/[0.1] text-white border border-white/[0.08]'}"
            >
              <!-- Avatar ou Ícone da Ação -->
              <div class="relative shrink-0 mt-0.5">
                {#if item.actor_avatar_url}
                  <img
                    src={item.actor_avatar_url}
                    alt={item.actor_username || 'Usuário'}
                    class="w-9 h-9 rounded-full object-cover border border-white/20 bg-[#111827]"
                  />
                {:else if item.type === 'follow'}
                  <div class="w-9 h-9 rounded-full bg-[#EF7D4B]/20 text-[#EF7D4B] flex items-center justify-center border border-[#EF7D4B]/30">
                    <UserPlus class="w-4 h-4" />
                  </div>
                {:else if item.type === 'playlist_follow'}
                  <div class="w-9 h-9 rounded-full bg-[#3093AA]/20 text-[#3093AA] flex items-center justify-center border border-[#3093AA]/30">
                    <ListMusic class="w-4 h-4" />
                  </div>
                {:else}
                  <div class="w-9 h-9 rounded-full bg-[#F3B044]/20 text-[#F3B044] flex items-center justify-center border border-[#F3B044]/30">
                    <MessageSquare class="w-4 h-4" />
                  </div>
                {/if}

                <!-- Badge de Tipo de Notificação -->
                {#if item.type === 'follow'}
                  <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#EF7D4B] text-white flex items-center justify-center border border-[#0B1020]">
                    <UserPlus class="w-2.5 h-2.5" />
                  </div>
                {:else if item.type === 'playlist_follow'}
                  <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#3093AA] text-white flex items-center justify-center border border-[#0B1020]">
                    <ListMusic class="w-2.5 h-2.5" />
                  </div>
                {/if}
              </div>

              <!-- Mensagem e Detalhes -->
              <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <div class="flex items-center justify-between gap-1">
                  <span class="text-xs font-bold truncate {item.is_read ? 'text-white/80' : 'text-white'}">
                    {item.title}
                  </span>
                  <span class="text-[10px] text-white/40 font-mono shrink-0">
                    {formatTimeAgo(item.created_at)}
                  </span>
                </div>

                <p class="text-[11px] text-white/60 line-clamp-2 leading-relaxed">
                  {item.message}
                </p>

                <!-- Ação Rápida no Hover -->
                <div class="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span class="text-[10px] text-[#3093AA] font-bold flex items-center gap-1">
                    <span>Ver detalhes</span>
                    <ExternalLink class="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>

              <!-- Botão Excluir Notificação -->
              <button
                type="button"
                onclick={(e) => { e.stopPropagation(); notificationActions.deleteNotification(item.id); }}
                class="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-[#EF7D4B] transition cursor-pointer shrink-0"
                title="Remover"
              >
                <X class="w-3.5 h-3.5" />
              </button>

              <!-- Indicador de Não Lida -->
              {#if !item.is_read}
                <div class="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-[#EF7D4B] shadow-sm shadow-[#EF7D4B]"></div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
