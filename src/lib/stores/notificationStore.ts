import { writable, derived, get } from 'svelte/store';
import { getSupabase } from '../api/supabase';
import { currentProfile, guestProfile } from './authStore';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: 'follow' | 'playlist_follow' | 'friend_request' | 'message' | 'system';
  title: string;
  message: string;
  actor_id?: string;
  actor_username?: string;
  actor_avatar_url?: string;
  actor_display_name?: string;
  target_id?: string;
  target_title?: string;
  is_read: boolean;
  created_at: string;
}

export const notifications = writable<NotificationItem[]>([]);

export const unreadNotificationCount = derived(notifications, ($list) => {
  return $list.filter(n => !n.is_read).length;
});

let realtimeChannel: any = null;

function getStorageKey(userId?: string): string {
  return `pulsar_notifications_${userId || 'guest'}`;
}

export const notificationActions = {
  // Inicializa e carrega notificações da nuvem e do cache local
  async initNotifications() {
    const prof = get(currentProfile);
    const userId = prof?.id || 'guest';
    const key = getStorageKey(userId);

    // 1. Carregar do localStorage imediatamente para render instantâneo
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            notifications.set(parsed);
          }
        }
      } catch (e) {
        console.warn('[Pulsar Notifications] Erro ao carregar cache local:', e);
      }
    }

    // 2. Se logado, carregar do Supabase
    const supabase = getSupabase();
    if (supabase && prof && prof.id !== guestProfile.id) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', prof.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          notifications.set(data as NotificationItem[]);
          this.saveToStorage(data as NotificationItem[]);
        }
      } catch (err) {
        // Fallback silencioso se a tabela ainda não tiver sido criada no Supabase
        console.info('[Pulsar Notifications] Usando armazenamento local de notificações.');
      }
    }

    this.subscribeToRealtime();
  },

  saveToStorage(items: NotificationItem[]) {
    if (typeof window === 'undefined') return;
    const prof = get(currentProfile);
    const key = getStorageKey(prof?.id);
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch (e) {
      console.warn('[Pulsar Notifications] Erro ao salvar cache:', e);
    }
  },

  // Enviar uma notificação para um usuário específico (nuvem + realtime)
  async sendNotification(params: {
    targetUserId?: string;
    user_id?: string;
    type: 'follow' | 'playlist_follow' | 'friend_request' | 'message' | 'system';
    title: string;
    message: string;
    actor_id?: string;
    sender_id?: string;
    actor_username?: string;
    sender_username?: string;
    actor_avatar_url?: string;
    sender_avatar_url?: string;
    actor_display_name?: string;
    target_id?: string;
    target_title?: string;
    link?: string;
  }) {
    const supabase = getSupabase();
    const prof = get(currentProfile);

    const recipientId = params.targetUserId || params.user_id || '';
    const actorId = params.actor_id || params.sender_id || prof?.id;
    const actorUsername = params.actor_username || params.sender_username || prof?.username;
    const actorAvatar = params.actor_avatar_url || params.sender_avatar_url || prof?.avatar_url;

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user_id: recipientId,
      type: params.type,
      title: params.title,
      message: params.message,
      actor_id: actorId,
      actor_username: actorUsername,
      actor_avatar_url: actorAvatar,
      actor_display_name: params.actor_display_name || prof?.display_name,
      target_id: params.target_id,
      target_title: params.target_title,
      is_read: false,
      created_at: new Date().toISOString()
    };

    // Se o destinatário for o próprio usuário local (ex: teste ou guest)
    if (recipientId === prof?.id || recipientId === 'guest') {
      notifications.update(list => {
        const updated = [newNotif, ...list.filter(n => n.id !== newNotif.id)];
        this.saveToStorage(updated);
        return updated;
      });
      return;
    }

    // Se estiver no Supabase, insere para o destinatário receber via Realtime
    if (supabase && recipientId) {
      try {
        await supabase.from('notifications').insert({
          user_id: recipientId,
          type: params.type,
          title: params.title,
          message: params.message,
          actor_id: newNotif.actor_id,
          actor_username: newNotif.actor_username,
          actor_avatar_url: newNotif.actor_avatar_url,
          actor_display_name: newNotif.actor_display_name,
          target_id: newNotif.target_id,
          target_title: newNotif.target_title,
          is_read: false
        });
      } catch (err) {
        console.warn('[Pulsar Notifications] Erro ao gravar notificação remota:', err);
      }
    }
  },

  // Marcar uma notificação como lida
  async markAsRead(id: string) {
    notifications.update(list => {
      const updated = list.map(n => n.id === id ? { ...n, is_read: true } : n);
      this.saveToStorage(updated);
      return updated;
    });

    const supabase = getSupabase();
    const prof = get(currentProfile);
    if (supabase && prof && !id.startsWith('notif-')) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id);
      } catch {}
    }
  },

  // Marcar todas como lidas
  async markAllAsRead() {
    notifications.update(list => {
      const updated = list.map(n => ({ ...n, is_read: true }));
      this.saveToStorage(updated);
      return updated;
    });

    const supabase = getSupabase();
    const prof = get(currentProfile);
    if (supabase && prof && prof.id !== guestProfile.id) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', prof.id)
          .eq('is_read', false);
      } catch {}
    }
  },

  // Remover uma notificação específica
  async deleteNotification(id: string) {
    notifications.update(list => {
      const updated = list.filter(n => n.id !== id);
      this.saveToStorage(updated);
      return updated;
    });

    const supabase = getSupabase();
    if (supabase && !id.startsWith('notif-')) {
      try {
        await supabase.from('notifications').delete().eq('id', id);
      } catch {}
    }
  },

  // Limpar todas as notificações
  async clearAll() {
    notifications.set([]);
    this.saveToStorage([]);

    const supabase = getSupabase();
    const prof = get(currentProfile);
    if (supabase && prof && prof.id !== guestProfile.id) {
      try {
        await supabase.from('notifications').delete().eq('user_id', prof.id);
      } catch {}
    }
  },

  // Escuta em tempo real notificações enviadas para o usuário ativo
  subscribeToRealtime(): () => void {
    const supabase = getSupabase();
    const prof = get(currentProfile);
    if (!supabase || !prof || prof.id === guestProfile.id) {
      return () => {};
    }

    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }

    try {
      realtimeChannel = supabase.channel(`pulsar-notifications-${prof.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${prof.id}`
          },
          (payload) => {
            const item = payload.new as NotificationItem;
            notifications.update(list => {
              if (list.some(n => n.id === item.id)) return list;
              const updated = [item, ...list];
              this.saveToStorage(updated);
              return updated;
            });
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[Pulsar Notifications] Realtime indisponível:', e);
    }

    return () => {
      if (realtimeChannel && supabase) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }
};
