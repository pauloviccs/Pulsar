-- Migration: delta_sync_and_egress_optimization
-- Aplicada em: 2026-10-17
-- Objetivo: Redução de 99% de egress no Supabase através de Delta Sync e Checksum RPC

-- 1. Coluna updated_at em user_library_tracks caso não exista
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_library_tracks' AND column_name = 'updated_at'
  ) THEN 
    ALTER TABLE public.user_library_tracks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
    UPDATE public.user_library_tracks SET updated_at = COALESCE(added_at, timezone('utc'::text, now())) WHERE updated_at IS NULL;
  END IF; 
END $$;

-- 2. Trigger para atualizar updated_at automaticamente em user_library_tracks
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

REVOKE EXECUTE ON FUNCTION set_updated_at_column() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS tr_user_library_tracks_updated_at ON public.user_library_tracks;
CREATE TRIGGER tr_user_library_tracks_updated_at
BEFORE UPDATE ON public.user_library_tracks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_column();

-- 3. Índices de performance para Delta Sync
CREATE INDEX IF NOT EXISTS idx_user_library_tracks_user_updated 
ON public.user_library_tracks (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cloud_playlists_user_updated 
ON public.cloud_playlists (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_pos 
ON public.cloud_playlist_tracks (playlist_id, position ASC);

CREATE INDEX IF NOT EXISTS idx_friendships_user_status 
ON public.friendships (user_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_friend_status 
ON public.friendships (friend_id, status);

-- 4. RPC Leve de Checksum de Sincronização (get_user_sync_state)
-- Retorna os timestamps e contagens mais recentes do usuário em ~180 bytes
CREATE OR REPLACE FUNCTION get_user_sync_state(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado: você só pode consultar o estado da sua própria biblioteca.';
  END IF;

  RETURN jsonb_build_object(
    'last_library_update', (SELECT MAX(updated_at) FROM public.user_library_tracks WHERE user_id = p_user_id),
    'library_count', (SELECT COUNT(*) FROM public.user_library_tracks WHERE user_id = p_user_id),
    'last_playlists_update', (
      SELECT MAX(p.updated_at)
      FROM public.cloud_playlists p
      LEFT JOIN public.playlist_follows pf ON pf.playlist_id = p.id
      WHERE p.user_id = p_user_id OR pf.user_id = p_user_id
    ),
    'playlists_count', (
      SELECT COUNT(DISTINCT p.id)
      FROM public.cloud_playlists p
      LEFT JOIN public.playlist_follows pf ON pf.playlist_id = p.id
      WHERE p.user_id = p_user_id OR pf.user_id = p_user_id
    ),
    'last_settings_update', (SELECT updated_at FROM public.user_settings WHERE user_id = p_user_id LIMIT 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_user_sync_state(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_user_sync_state(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION get_user_sync_state(UUID) TO authenticated;
