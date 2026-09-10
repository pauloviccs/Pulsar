<script lang="ts">
  import { 
    activeChatFriend, 
    socialState, 
    socialActions 
  } from '../stores/socialStore';
  import { currentUser, currentProfile } from '../stores/authStore';
  import { currentTrack, playerActions } from '../stores/playerStore';
  import type { ChatMessage, Track, UserProfile } from '../types';
  import { 
    X, 
    Send, 
    Music2, 
    Play, 
    Plus, 
    Sparkles, 
    Check, 
    CheckCheck,
    Minimize2,
    Volume2
  } from '@lucide/svelte';
  import { tick } from 'svelte';

  let messageInput = $state('');
  let messagesContainer = $state<HTMLDivElement | null>(null);

  let friend = $derived($activeChatFriend);
  let friendId = $derived(friend ? ('friend_id' in friend ? friend.friend_id : (friend as UserProfile).id) : '');
  let friendName = $derived(friend ? ('friend_display_name' in friend ? friend.friend_display_name : (friend as UserProfile).display_name) : '');
  let friendUsername = $derived(friend ? ('friend_username' in friend ? friend.friend_username : (friend as UserProfile).username) : '');
  let friendTag = $derived(friend ? ('friend_tag' in friend ? friend.friend_tag : (friend as UserProfile).tag) : '');
  let friendAvatar = $derived(friend ? ('friend_avatar' in friend ? friend.friend_avatar : (friend as UserProfile).avatar_url) : '');
  let friendStatus = $derived(friend ? ('presence_status' in friend ? friend.presence_status : ((friend as UserProfile).presence_status || (friend as UserProfile).presence)) : 'offline');
  let friendCurrentTrack = $derived(friend ? ('current_track_title' in friend ? friend.current_track_title : ((friend as UserProfile).current_track_title || (friend as UserProfile).listening_track_title)) : null);

  let messages = $derived<ChatMessage[]>(
    friendId ? ($socialState.messagesByFriendId[friendId] || []) : []
  );

  async function scrollToBottom() {
    await tick();
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  $effect(() => {
    // Scrolla para o fim quando novas mensagens chegarem
    if (messages.length > 0) {
      scrollToBottom();
    }
  });

  async function handleSend() {
    if (!messageInput.trim() || !friendId) return;
    const content = messageInput.trim();
    messageInput = '';
    await socialActions.sendMessage(friendId, content);
    scrollToBottom();
  }

  async function handleShareCurrentTrack() {
    if (!$currentTrack || !friendId) return;
    await socialActions.sendMessage(
      friendId, 
      `Compartilhou uma música: ${$currentTrack.title}`, 
      $currentTrack
    );
    scrollToBottom();
  }

  function handlePlaySharedTrack(track: Track) {
    playerActions.playTrack(track, [track]);
  }

  function formatTime(isoString: string) {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
</script>

{#if friend}
  <!-- Chat Docked no Canto Inferior Direito Estilo Riot Client / iMessage -->
  <div 
    class="fixed bottom-24 right-4 sm:right-8 w-84 md:w-96 h-[480px] max-h-[calc(100vh-140px)] max-w-[calc(100vw-32px)] z-50 flex flex-col rounded-3xl liquid-glass border border-white/[0.14] shadow-2xl backdrop-blur-3xl overflow-hidden animate-in zoom-in-95 duration-200 select-none"
  >
    <!-- Header do Chat -->
    <div class="p-3.5 px-4 bg-[#09090d]/80 border-b border-white/[0.08] flex items-center justify-between">
      <div class="flex items-center gap-3 min-w-0">
        <div class="relative shrink-0">
          <img 
            src={friendAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${friendUsername}`} 
            alt={friendName} 
            class="w-9 h-9 rounded-full object-cover border border-white/[0.15]"
          />
          <div class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#09090d] {friendStatus === 'online' ? 'bg-[#66D7D1]' : friendStatus === 'away' ? 'bg-[#DBD56E]' : 'bg-[#F2EFEA]/30'}"></div>
        </div>

        <div class="min-w-0">
          <div class="flex items-center gap-1.5 truncate">
            <span class="text-xs font-bold text-[#F2EFEA] truncate">{friendName}</span>
            <span class="text-[10px] font-mono text-[#66D7D1]">#{friendTag}</span>
          </div>
          <p class="text-[10px] text-[#F2EFEA]/50 truncate">
            {friendCurrentTrack ? `Ouvindo: ${friendCurrentTrack}` : 'Mensagens diretas'}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-1">
        <button
          onclick={() => activeChatFriend.set(null)}
          class="p-1.5 rounded-xl text-[#F2EFEA]/40 hover:text-[#F2EFEA] hover:bg-white/[0.08] transition cursor-pointer"
          title="Fechar Chat"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Área de Mensagens com Balões Liquid Glass & iMessage -->
    <div 
      bind:this={messagesContainer}
      class="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
    >
      {#if messages.length === 0}
        <div class="m-auto text-center flex flex-col items-center gap-2 p-6">
          <div class="w-12 h-12 rounded-full liquid-glass flex items-center justify-center text-[#66D7D1]">
            <Sparkles class="w-6 h-6" />
          </div>
          <p class="text-xs font-bold text-[#F2EFEA]">Inicie a conversa com {friendName}</p>
          <p class="text-[11px] text-[#F2EFEA]/40 max-w-xs">
            Envie mensagens instantâneas ou compartilhe músicas para ouvirem juntos.
          </p>
        </div>
      {:else}
        {#each messages as msg (msg.id)}
          {@const isMine = msg.sender_id === $currentUser?.id || msg.sender_id === $currentProfile?.id}
          <div class="flex flex-col gap-1 {isMine ? 'items-end' : 'items-start'}">
            <!-- Balão de Texto -->
            <div 
              class="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs shadow-md {isMine 
                ? 'bg-gradient-to-br from-[#FC7753] to-[#FC7753]/90 text-white rounded-tr-xs' 
                : 'liquid-glass border border-white/[0.1] text-[#F2EFEA] rounded-tl-xs'}"
            >
              <p class="leading-relaxed break-words">{msg.content}</p>

              <!-- Card de Música Compartilhada Estilo Apple Music -->
              {#if msg.shared_track}
                <div class="mt-2 p-2 rounded-xl bg-black/30 border border-white/[0.1] flex items-center gap-2.5">
                  <img 
                    src={msg.shared_track.thumbnail || msg.shared_track.thumbnail_url} 
                    alt={msg.shared_track.title} 
                    class="w-10 h-10 rounded-lg object-cover shrink-0 shadow-sm"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-[11px] font-bold text-white truncate">{msg.shared_track.title}</p>
                    <p class="text-[10px] text-white/60 truncate">{msg.shared_track.artist || msg.shared_track.artist_guess || msg.shared_track.channel_name}</p>
                  </div>
                  <button
                    onclick={() => handlePlaySharedTrack(msg.shared_track!)}
                    class="p-2 rounded-xl bg-[#66D7D1] text-[#09090d] hover:scale-105 transition active:scale-95 cursor-pointer shrink-0 shadow-md"
                    title="Tocar Agora"
                  >
                    <Play class="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              {/if}
            </div>

            <!-- Timestamp e Status -->
            <div class="flex items-center gap-1 px-1 text-[9px] text-[#F2EFEA]/40 font-mono">
              <span>{formatTime(msg.created_at)}</span>
              {#if isMine}
                {#if msg.read}
                  <CheckCheck class="w-3 h-3 text-[#66D7D1]" />
                {:else}
                  <Check class="w-3 h-3" />
                {/if}
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Barra de Digitação e Ações Rápidas -->
    <div class="p-3 bg-[#09090d]/80 border-t border-white/[0.08] flex flex-col gap-2">
      <!-- Botão para Compartilhar Música que Está Tocando -->
      {#if $currentTrack}
        <button
          onclick={handleShareCurrentTrack}
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] font-semibold text-[#66D7D1] transition cursor-pointer w-fit"
          title="Compartilhar '{$currentTrack.title}' com este amigo"
        >
          <Music2 class="w-3 h-3 text-[#66D7D1]" />
          <span class="truncate max-w-[220px]">Compartilhar: {$currentTrack.title}</span>
        </button>
      {/if}

      <form 
        onsubmit={(e) => { e.preventDefault(); handleSend(); }}
        class="flex items-center gap-2"
      >
        <input
          type="text"
          bind:value={messageInput}
          placeholder="Mensagem para {friendName}..."
          class="flex-1 py-2.5 px-3.5 rounded-2xl liquid-input text-xs text-[#F2EFEA] placeholder:text-[#F2EFEA]/30 outline-none"
        />

        <button
          type="submit"
          disabled={!messageInput.trim()}
          class="p-2.5 rounded-2xl bg-[#FC7753] hover:bg-[#FC7753]/90 disabled:opacity-40 text-white transition active:scale-95 cursor-pointer shadow-md shadow-[#FC7753]/20 shrink-0"
        >
          <Send class="w-4 h-4" />
        </button>
      </form>
    </div>
  </div>
{/if}
