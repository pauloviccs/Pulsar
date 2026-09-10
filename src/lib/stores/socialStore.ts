import { writable, derived, get } from 'svelte/store';
import type { UserProfile, Friendship, ChatMessage, CloudPlaylist, Track } from '../types';
import { getSupabase } from '../api/supabase';
import { currentProfile, guestProfile, viewedProfile, isEditProfileModalOpen } from './authStore';

export const friends = writable<Friendship[]>([]);
export const pendingRequests = writable<Friendship[]>([]);
export const followingIds = writable<string[]>([]);
export const isSocialDrawerOpen = writable<boolean>(false);
export const isDirectChatOpen = writable<boolean>(false);
export const activeChatFriend = writable<Friendship | UserProfile | null>(null);
export const chatMessages = writable<ChatMessage[]>([]);
export const userCloudPlaylists = writable<CloudPlaylist[]>([]);
export { viewedProfile, isEditProfileModalOpen };

// Objeto reativo unificado para conveniência dos componentes UI
export const socialState = derived(
  [friends, pendingRequests, followingIds, chatMessages],
  ([$friends, $pending, $following, $msgs]) => {
    // Agrupa mensagens por ID do parceiro de chat
    const messagesByFriendId: Record<string, ChatMessage[]> = {};
    for (const m of $msgs) {
      const partnerId = m.sender_id === get(currentProfile)?.id ? m.receiver_id : m.sender_id;
      if (!messagesByFriendId[partnerId]) messagesByFriendId[partnerId] = [];
      messagesByFriendId[partnerId].push(m);
    }

    return {
      friends: $friends,
      pendingRequests: $pending,
      followingIds: $following,
      messagesByFriendId
    };
  }
);

export const unreadMessageCount = derived(chatMessages, ($msgs) => {
  const myId = get(currentProfile)?.id;
  return $msgs.filter(m => m.receiver_id === myId && !(m.is_read || m.read)).length;
});

// Canal de escuta Realtime
let realtimeChannel: any = null;

export const socialActions = {
  async loadFriends() {
    const supabase = getSupabase();
    const prof = get(currentProfile);
    if (!supabase || !prof || prof.id === guestProfile.id) return;

    try {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id, user_id, friend_id, status, created_at,
          friend:profiles!friendships_friend_id_fkey(*),
          user:profiles!friendships_user_id_fkey(*)
        `)
        .or(`user_id.eq.${prof.id},friend_id.eq.${prof.id}`);

      if (error) throw error;

      const accepted: Friendship[] = [];
      const pending: Friendship[] = [];

      for (const row of (data as any[]) || []) {
        const otherProfile: UserProfile = row.user_id === prof.id ? row.friend : row.user;
        const item: Friendship = {
          id: row.id,
          user_id: row.user_id,
          friend_id: row.user_id === prof.id ? row.friend_id : row.user_id,
          status: row.status,
          created_at: row.created_at,
          friend_username: otherProfile?.username || 'user',
          friend_tag: otherProfile?.tag || '0000',
          friend_display_name: otherProfile?.display_name || otherProfile?.username || 'Usuário',
          friend_avatar: otherProfile?.avatar_url,
          presence_status: otherProfile?.presence_status || otherProfile?.presence || 'offline',
          current_track_title: otherProfile?.current_track_title || otherProfile?.listening_track_title,
          friend_profile: otherProfile
        };

        if (row.status === 'accepted') {
          accepted.push(item);
        } else if (row.status === 'pending') {
          pending.push(item);
        }
      }

      friends.set(accepted);
      pendingRequests.set(pending);
    } catch (err) {
      console.warn('[Pulsar Social] Erro ao carregar amigos:', err);
    }
  },

  async sendFriendRequest(usernameOrTag: string, tagParam?: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabase();
    const prof = get(currentProfile);
    if (!supabase || !prof || prof.id === guestProfile.id) {
      return { success: false, error: 'Faça login para adicionar amigos.' };
    }

    let searchUser = '';
    let searchTag = '';

    if (tagParam) {
      searchUser = usernameOrTag.trim().toLowerCase();
      searchTag = tagParam.trim().toUpperCase();
    } else {
      const parts = usernameOrTag.split('#');
      if (parts.length !== 2) {
        return { success: false, error: 'Formato inválido. Use Nome#TAG (ex: Kaue#7X9A).' };
      }
      searchUser = parts[0].trim().toLowerCase();
      searchTag = parts[1].trim().toUpperCase();
    }

    try {
      // Localizar o perfil alvo
      const { data: targetProfile, error: searchError } = await supabase
        .from('profiles')
        .select('id, username, tag')
        .ilike('username', searchUser)
        .eq('tag', searchTag)
        .single();

      if (searchError || !targetProfile) {
        return { success: false, error: `Nenhum usuário encontrado com o identificador ${searchUser}#${searchTag}.` };
      }

      if (targetProfile.id === prof.id) {
        return { success: false, error: 'Você não pode adicionar a si mesmo como amigo.' };
      }

      // Criar pedido de amizade
      const { error: insertError } = await supabase
        .from('friendships')
        .insert({
          user_id: prof.id,
          friend_id: targetProfile.id,
          status: 'pending'
        });

      if (insertError) {
        if (insertError.code === '23505') {
          return { success: false, error: 'Já existe uma solicitação ou amizade com este usuário.' };
        }
        return { success: false, error: insertError.message };
      }

      await this.loadFriends();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao enviar solicitação.' };
    }
  },

  async acceptFriendRequest(friendshipId: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      if (error) throw error;
      await this.loadFriends();
    } catch (err) {
      console.error('[Pulsar Social] Erro ao aceitar amizade:', err);
    }
  },

  async removeFriend(friendshipId: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      await this.loadFriends();
    } catch (err) {
      console.error('[Pulsar Social] Erro ao remover amigo:', err);
    }
  },

  async respondFriendRequest(friendshipId: string, accept: boolean) {
    if (accept) {
      await this.acceptFriendRequest(friendshipId);
    } else {
      await this.removeFriend(friendshipId);
    }
  },

  async openDirectChat(friend: Friendship | UserProfile) {
    activeChatFriend.set(friend);
    isDirectChatOpen.set(true);
    const friendId = 'friend_id' in friend ? friend.friend_id : friend.id;
    await this.loadChatMessages(friendId);
  },

  async loadChatMessages(friendId: string) {
    const supabase = getSupabase();
    const prof = get(currentProfile);
    if (!supabase || !prof || prof.id === guestProfile.id) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${prof.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${prof.id})`)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      chatMessages.set((data as ChatMessage[]) || []);

      // Marcar mensagens recebidas como lidas
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', friendId)
        .eq('receiver_id', prof.id)
        .eq('is_read', false);
    } catch (err) {
      console.warn('[Pulsar Social] Erro ao carregar chat:', err);
    }
  },

  async sendMessage(receiverId: string, content: string, sharedTrack?: Track | null) {
    const supabase = getSupabase();
    const prof = get(currentProfile);
    if (!supabase || !prof || prof.id === guestProfile.id) {
      // Chat local fallback
      const localMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender_id: prof?.id || 'guest',
        receiver_id: receiverId,
        content: content.trim(),
        shared_track: sharedTrack || null,
        shared_track_id: sharedTrack?.id || null,
        shared_track_title: sharedTrack?.title || null,
        read: true,
        is_read: true,
        created_at: new Date().toISOString()
      };
      chatMessages.update(msgs => [...msgs, localMsg]);
      return;
    }

    if (!content.trim() && !sharedTrack) return;

    const newMsg = {
      sender_id: prof.id,
      receiver_id: receiverId,
      content: content.trim(),
      shared_track_id: sharedTrack?.id || null,
      shared_track_title: sharedTrack?.title || null,
      is_read: false
    };

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert(newMsg)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const fullMsg: ChatMessage = {
          ...(data as ChatMessage),
          shared_track: sharedTrack || null,
          read: false
        };
        chatMessages.update(msgs => [...msgs, fullMsg]);
      }
    } catch (err) {
      console.error('[Pulsar Social] Erro ao enviar mensagem:', err);
      throw err;
    }
  },

  async loadUserCloudPlaylists(userId: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('cloud_playlists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      userCloudPlaylists.set((data as CloudPlaylist[]) || []);
    } catch (err) {
      console.warn('[Pulsar Social] Erro ao carregar playlists em nuvem:', err);
    }
  },

  async toggleFollow(targetUserId: string) {
    const supabase = getSupabase();
    const prof = get(currentProfile);
    if (!supabase || !prof || prof.id === guestProfile.id) return;

    try {
      const { data: existing } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', prof.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', prof.id)
          .eq('following_id', targetUserId);

        followingIds.update(ids => ids.filter(id => id !== targetUserId));
        viewedProfile.update(vp => vp ? {
          ...vp,
          is_following: false,
          followers_count: Math.max(0, (vp.followers_count || 1) - 1)
        } : null);
      } else {
        await supabase
          .from('follows')
          .insert({
            follower_id: prof.id,
            following_id: targetUserId
          });

        followingIds.update(ids => [...ids, targetUserId]);
        viewedProfile.update(vp => vp ? {
          ...vp,
          is_following: true,
          followers_count: (vp.followers_count || 0) + 1
        } : null);
      }
    } catch (err) {
      console.error('[Pulsar Social] Erro ao seguir/deixar de seguir:', err);
    }
  },

  async followUser(userId: string) {
    return this.toggleFollow(userId);
  },

  async unfollowUser(userId: string) {
    return this.toggleFollow(userId);
  },

  subscribeToRealtime(): () => void {
    const supabase = getSupabase();
    const prof = get(currentProfile);
    if (!supabase || !prof || prof.id === guestProfile.id) {
      return () => {};
    }

    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase.channel('pulsar-social-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as ChatMessage;
          const activeFriend = get(activeChatFriend);
          const activeId = activeFriend ? ('friend_id' in activeFriend ? activeFriend.friend_id : activeFriend.id) : null;
          if (activeId && (msg.sender_id === activeId || msg.receiver_id === activeId)) {
            chatMessages.update(msgs => {
              if (msgs.some(m => m.id === msg.id)) return msgs;
              return [...msgs, msg];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updatedProf = payload.new as UserProfile;
          // Atualizar presença na lista de amigos
          friends.update(list => list.map(f => {
            if (f.friend_id === updatedProf.id || f.friend_profile?.id === updatedProf.id) {
              return { 
                ...f, 
                presence_status: updatedProf.presence_status || updatedProf.presence,
                current_track_title: updatedProf.current_track_title || updatedProf.listening_track_title,
                friend_profile: { ...f.friend_profile, ...updatedProf } 
              };
            }
            return f;
          }));
        }
      )
      .subscribe();

    return () => {
      if (realtimeChannel && supabase) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }
};
