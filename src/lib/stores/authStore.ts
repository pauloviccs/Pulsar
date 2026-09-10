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

export const authActions = {
  async initAuth() {
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
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    currentUser.set(null);
    currentProfile.set(guestProfile);
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

    try {
      await supabase
        .from('profiles')
        .update({
          presence: dbPresence,
          listening_track_title: trackTitle || null,
          listening_artist: artist || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', prof.id);

      currentProfile.update(curr => curr ? {
        ...curr,
        presence,
        presence_status: presence,
        listening_track_title: trackTitle,
        current_track_title: trackTitle,
        listening_artist: artist
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
