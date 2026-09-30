import { writable, get } from 'svelte/store';
import type { UserProfile, PresenceStatus } from '../types';
import { getSupabase, isSupabaseReady } from '../api/supabase';

export const currentUser = writable<any | null>(null);
export const currentProfile = writable<UserProfile | null>(null);
export const userProfile = currentProfile; // Alias
export const viewedProfile = writable<UserProfile | null>(null);
export const isAuthModalOpen = writable<boolean>(false);
export const isEditProfileModalOpen = writable<boolean>(false);
export const authMode = writable<'login' | 'register' | 'forgot' | 'config'>('login');
export const isAuthLoading = writable<boolean>(false);
export const authError = writable<string | null>(null);

// Fallback amigável de perfil offline / convidado
export const guestProfile: UserProfile = {
  id: 'guest-local-user',
  username: 'Convidado',
  tag: '0000',
  display_name: 'Usuário Local',
  avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  banner_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
  bio: 'Ouvindo faixas locais sem nuvem no Pulsar.',
  presence: 'online',
  presence_status: 'online',
  created_at: new Date().toISOString().split('T')[0],
  followers_count: 0,
  following_count: 0
};

function translateAuthError(err: any): string {
  const msg = err?.message || String(err || '');
  if (msg.includes('Email not confirmed') || msg.includes('email_not_confirmed')) {
    return 'Seu e-mail ainda não foi confirmado no Supabase. No painel do Supabase, desative "Confirm email" em Authentication -> Providers -> Email para login imediato no app, ou confirme o usuário manualmente em Users.';
  }
  if (msg.includes('Invalid login credentials')) {
    return 'E-mail ou senha incorretos. Verifique suas credenciais.';
  }
  if (msg.includes('User already registered')) {
    return 'Este e-mail já está cadastrado. Alterne para a aba "Entrar".';
  }
  if (msg.includes('Password should be at least')) {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }
  if (msg.includes('otp_expired') || msg.includes('has expired') || msg.includes('Email link is invalid')) {
    return 'O link de confirmação expirou ou é inválido.';
  }
  return msg || 'Falha na autenticação.';
}

let presenceHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

export const authActions = {
  startHeartbeat(userId: string) {
    this.stopHeartbeat();
    if (typeof window === 'undefined' || !userId || userId.startsWith('guest')) return;

    // Heartbeat leve a cada 60 segundos mantendo updated_at fresco
    presenceHeartbeatTimer = setInterval(async () => {
      const supabase = getSupabase();
      const prof = get(currentProfile);
      if (!supabase || !prof || prof.id !== userId) return;

      try {
        await supabase
          .from('profiles')
          .update({
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
      } catch (e) {
        // Falha silenciosa de keepalive
      }
    }, 60_000);
  },

  stopHeartbeat() {
    if (presenceHeartbeatTimer) {
      clearInterval(presenceHeartbeatTimer);
      presenceHeartbeatTimer = null;
    }
  },

  async initAuth() {
    // Registrar limpeza defensiva de presença no fechamento da janela
    if (typeof window !== 'undefined' && !(window as any).__pulsar_beforeunload_registered) {
      (window as any).__pulsar_beforeunload_registered = true;
      window.addEventListener('beforeunload', () => {
        const prof = get(currentProfile);
        const supabase = getSupabase();
        if (prof && prof.id && !prof.id.startsWith('guest') && supabase) {
          try {
            supabase
              .from('profiles')
              .update({
                presence: 'offline',
                listening_track_title: null,
                listening_artist: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', prof.id)
              .then(() => {});
          } catch {}
        }
      });
    }

    const supabase = getSupabase();
    if (!supabase) {
      // Se não há credenciais do Supabase configuradas, verificar se já abriu alguma vez
      const hasSeenWelcome = typeof window !== 'undefined' ? localStorage.getItem('pulsar_has_seen_welcome') : 'true';
      if (!hasSeenWelcome) {
        isAuthModalOpen.set(true);
      } else {
        currentProfile.set(guestProfile);
      }
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        currentUser.set(session.user);
        await this.fetchProfile(session.user.id);
      } else {
        const hasSeenWelcome = typeof window !== 'undefined' ? localStorage.getItem('pulsar_has_seen_welcome') : 'true';
        if (!hasSeenWelcome) {
          isAuthModalOpen.set(true);
        } else {
          currentProfile.set(guestProfile);
        }
      }

      // Escutar mudanças de estado de autenticação
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          currentUser.set(session.user);
          await this.fetchProfile(session.user.id);
        } else {
          this.stopHeartbeat();
          currentUser.set(null);
          currentProfile.set(guestProfile);
        }
      });
    } catch (err) {
      console.warn('[Pulsar Auth] Erro ao carregar sessão inicial:', err);
      currentProfile.set(guestProfile);
    }
  },

  async fetchProfile(userId: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('[Pulsar Auth] Erro ao buscar perfil:', error);
        return;
      }

      if (data) {
        // Buscar contagem de seguidores e seguindo
        const [followersRes, followingRes] = await Promise.all([
          supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
          supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId)
        ]);

        currentProfile.set({
          ...data,
          followers_count: followersRes.count || 0,
          following_count: followingRes.count || 0
        });

        // Disparar heartbeat ativo para manter updated_at fresco enquanto logado
        this.startHeartbeat(userId);

        // Disparar sincronização inicial e ativar ciclo automático silencioso em segundo plano
        import('../services/syncEngine').then(({ syncEngine }) => {
          syncEngine.hydrateFromCloud(userId);
          syncEngine.startAutoSync(userId);
        });

        // Carregar amigos, solicitações de amizade e notificações atualizadas
        import('./socialStore').then(({ socialActions }) => {
          socialActions.loadFriends();
        });
        import('./notificationStore').then(({ notificationActions }) => {
          notificationActions.initNotifications();
        });
      }
    } catch (err) {
      console.error('[Pulsar Auth] Falha ao processar perfil:', err);
    }
  },

  async login(email: string, pass: string) {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase não configurado.');
    }

    isAuthLoading.set(true);
    authError.set(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass
      });

      if (error) throw error;

      if (data.user) {
        currentUser.set(data.user);
        await this.fetchProfile(data.user.id);
        if (typeof window !== 'undefined') {
          localStorage.setItem('pulsar_has_seen_welcome', 'true');
        }
        isAuthModalOpen.set(false);
      }
      return data;
    } catch (err: any) {
      authError.set(translateAuthError(err));
      throw err;
    } finally {
      isAuthLoading.set(false);
    }
  },

  async register(email: string, pass: string, username: string, displayName?: string) {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase não configurado.');
    }

    isAuthLoading.set(true);
    authError.set(null);

    try {
      const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      const cleanDisplay = (displayName || username).trim();

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          data: {
            username: cleanUser,
            display_name: cleanDisplay
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Se não foi criada sessão imediata, o Supabase exige confirmação de e-mail
        if (!data.session) {
          authError.set('Conta criada! O Supabase enviou um e-mail de confirmação. (Dica recomendada para Desktop: desative "Confirm email" em Authentication -> Providers -> Email no painel do Supabase para login imediato).');
          return data;
        }

        currentUser.set(data.user);
        await this.fetchProfile(data.user.id);
        if (typeof window !== 'undefined') {
          localStorage.setItem('pulsar_has_seen_welcome', 'true');
        }
        isAuthModalOpen.set(false);
      }
      return data;
    } catch (err: any) {
      authError.set(translateAuthError(err));
      throw err;
    } finally {
      isAuthLoading.set(false);
    }
  },

  async resendConfirmation(email: string) {
    const supabase = getSupabase();
    if (!supabase) return { success: false, error: 'Supabase não configurado.' };
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim()
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: translateAuthError(err) };
    }
  },

  async logout() {
    this.stopHeartbeat();
    const prof = get(currentProfile);
    const supabase = getSupabase();
    if (supabase && prof && prof.id && !prof.id.startsWith('guest')) {
      try {
        await supabase.from('profiles').update({
          presence: 'offline',
          listening_track_title: null,
          listening_artist: null,
          updated_at: new Date().toISOString()
        }).eq('id', prof.id);
      } catch {}
    }
    import('../services/syncEngine').then(({ syncEngine }) => {
      syncEngine.stopAutoSync();
    });
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    viewedProfile.set(null);
    currentUser.set(null);
    currentProfile.set(guestProfile);
  },

  viewMyProfile() {
    viewedProfile.set(null);
    import('./libraryStore').then(({ libraryActions }) => {
      libraryActions.setActiveView('profile');
    });
  },

  async viewUserProfile(profileData: {
    id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
  }) {
    if (!profileData?.id) return;
    const curr = get(currentProfile);
    if (curr && curr.id === profileData.id) {
      viewedProfile.set(null);
      import('./libraryStore').then(({ libraryActions }) => {
        libraryActions.setActiveView('profile');
      });
      return;
    }

    const initialViewed: UserProfile = {
      id: profileData.id,
      username: profileData.username || 'usuario',
      tag: '0000',
      display_name: profileData.display_name || profileData.username || 'Usuário Pulsar',
      avatar_url: profileData.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
      banner_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
      bio: '',
      presence: 'offline',
      presence_status: 'offline',
      created_at: new Date().toISOString().split('T')[0],
      followers_count: 0,
      following_count: 0
    };

    viewedProfile.set(initialViewed);
    import('./libraryStore').then(({ libraryActions }) => {
      libraryActions.setActiveView('profile');
    });

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profileData.id)
          .maybeSingle();

        if (data) {
          const [followersRes, followingRes] = await Promise.all([
            supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', profileData.id),
            supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', profileData.id)
          ]);

          viewedProfile.update(curr => curr ? {
            ...curr,
            ...data,
            followers_count: followersRes.count || 0,
            following_count: followingRes.count || 0
          } : null);
        }
      } catch (e) {
        console.warn('[Pulsar Auth] Erro ao carregar perfil do criador:', e);
      }
    }
  },

  clearViewedProfile() {
    viewedProfile.set(null);
  },

  async updateProfile(updates: Partial<UserProfile>) {
    const supabase = getSupabase();
    const prof = get(currentProfile);
    if (!supabase || !prof || prof.id === guestProfile.id) {
      // Atualização local de convidado
      currentProfile.update(curr => curr ? { ...curr, ...updates } : null);
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: updates.display_name,
          bio: updates.bio,
          avatar_url: updates.avatar_url,
          banner_url: updates.banner_url,
          custom_status: updates.custom_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', prof.id);

      if (error) throw error;

      currentProfile.update(curr => curr ? { ...curr, ...updates } : null);
    } catch (err) {
      console.error('[Pulsar Auth] Erro ao atualizar perfil:', err);
      throw err;
    }
  },

  async updatePresence(presence: PresenceStatus, trackTitle?: string | null, artist?: string | null) {
    const supabase = getSupabase();
    const prof = get(currentProfile);
    if (!supabase || !prof || prof.id === guestProfile.id) return;

    // Mapeamento correto para o enum user_presence_status do PostgreSQL ('online', 'idle', 'dnd', 'offline')
    let dbPresence = 'online';
    if (presence === 'away' || presence === 'idle') dbPresence = 'idle';
    else if (presence === 'busy' || presence === 'dnd') dbPresence = 'dnd';
    else if (presence === 'offline') dbPresence = 'offline';

    const effectiveTrackTitle = presence === 'offline' ? null : (trackTitle || null);
    const effectiveArtist = presence === 'offline' ? null : (artist || null);

    try {
      await supabase
        .from('profiles')
        .update({
          presence: dbPresence,
          listening_track_title: effectiveTrackTitle,
          listening_artist: effectiveArtist,
          updated_at: new Date().toISOString()
        })
        .eq('id', prof.id);

      currentProfile.update(curr => curr ? {
        ...curr,
        presence,
        presence_status: presence,
        listening_track_title: effectiveTrackTitle,
        current_track_title: effectiveTrackTitle,
        listening_artist: effectiveArtist
      } : null);
    } catch (err) {
      console.warn('[Pulsar Presence] Erro ao sincronizar presença com Supabase:', err);
    }
  },

  async updateStatus(presence: PresenceStatus, trackTitle?: string | null, artist?: string | null) {
    return this.updatePresence(presence, trackTitle, artist);
  },

  continueAsGuest() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pulsar_has_seen_welcome', 'true');
    }
    isAuthModalOpen.set(false);
    if (!get(currentProfile)) {
      currentProfile.set(guestProfile);
    }
  }
};
