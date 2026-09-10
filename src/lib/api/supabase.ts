import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://imhktwwrbmtbokrjmvwz.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltaGt0d3dyYm10Ym9rcmptdnd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDYwNDAsImV4cCI6MjEwNDYyMjA0MH0.Gh0GF75kmaYkqYh4rgYn1HKNoVgwARhhfLBkubD_nH0';

// Obter credenciais de variáveis de ambiente, localStorage ou valores padrão do projeto
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  let localUrl = '';
  let localKey = '';

  if (typeof window !== 'undefined') {
    try {
      localUrl = localStorage.getItem('pulsar_supabase_url') || '';
      localKey = localStorage.getItem('pulsar_supabase_anon_key') || '';
    } catch {}
  }

  return {
    url: localUrl || envUrl || DEFAULT_SUPABASE_URL,
    anonKey: localKey || envKey || DEFAULT_SUPABASE_ANON_KEY
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('pulsar_supabase_url', url.trim());
      localStorage.setItem('pulsar_supabase_anon_key', anonKey.trim());
    } catch {}
  }
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      });
    } catch (err) {
      console.warn('[Pulsar Supabase] Erro ao inicializar cliente:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export function isSupabaseReady(): boolean {
  return getSupabase() !== null;
}
