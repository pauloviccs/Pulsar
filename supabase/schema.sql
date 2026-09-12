-- ==============================================================================
-- PULSAR - SCHEMA DO SUPABASE (PERFIS TWITTER-STYLE, AMIGOS, CHAT & PLAYLISTS)
-- ==============================================================================
-- Execute este script completo no "SQL Editor" do painel do seu Supabase.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE user_presence_status AS ENUM ('online', 'idle', 'dnd', 'offline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE playlist_visibility AS ENUM ('public', 'private', 'shared');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABELA DE PERFIS COM TAG ALFANUMÉRICA ÚNICA (ESTILO DISCORD / RIOT / TWITTER)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    tag VARCHAR(4) NOT NULL, -- Tag alfanumérica de 4 dígitos (ex: 7X9A)
    display_name TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    banner_url TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    presence user_presence_status DEFAULT 'online',
    custom_status TEXT DEFAULT '',
    listening_track_title TEXT DEFAULT NULL,
    listening_artist TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_username_tag UNIQUE (username, tag)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Perfis são visíveis publicamente" ON public.profiles;
CREATE POLICY "Perfis são visíveis publicamente"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Usuários podem atualizar apenas seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem atualizar apenas seu próprio perfil"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem criar seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem criar seu próprio perfil"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 3. TRIGGER AUTOMÁTICO DE CRIAÇÃO DE PERFIL E TAG ALFANUMÉRICA
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_tag VARCHAR(4);
    chars CONSTANT TEXT := '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    tag_exists BOOLEAN;
    base_name TEXT;
    clean_display TEXT;
BEGIN
    base_name := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
    clean_display := COALESCE(new.raw_user_meta_data->>'display_name', base_name);
    
    -- Gerar tag aleatória de 4 caracteres garantindo unicidade para o username
    LOOP
        new_tag := '';
        FOR i IN 1..4 LOOP
            new_tag := new_tag || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
        
        SELECT EXISTS(
            SELECT 1 FROM public.profiles 
            WHERE lower(username) = lower(base_name) AND tag = new_tag
        ) INTO tag_exists;
        
        EXIT WHEN NOT tag_exists;
    END LOOP;

    INSERT INTO public.profiles (id, username, tag, display_name, avatar_url, bio)
    VALUES (
        new.id,
        base_name,
        new_tag,
        clean_display,
        COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
        'Ouvindo música no Pulsar.'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. PLAYLISTS NA NUVEM & FAIXAS (ZERO ARQUIVO PESADO)
CREATE TABLE IF NOT EXISTS public.cloud_playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    cover_image_url TEXT DEFAULT '',
    visibility playlist_visibility DEFAULT 'public',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.cloud_playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Playlists visíveis por visibilidade ou dono" ON public.cloud_playlists;
CREATE POLICY "Playlists visíveis por visibilidade ou dono"
    ON public.cloud_playlists FOR SELECT
    USING (
        visibility = 'public' 
        OR auth.uid() = user_id
    );

DROP POLICY IF EXISTS "Usuários gerenciam suas próprias playlists" ON public.cloud_playlists;
CREATE POLICY "Usuários gerenciam suas próprias playlists"
    ON public.cloud_playlists FOR ALL
    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.cloud_playlist_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID NOT NULL REFERENCES public.cloud_playlists(id) ON DELETE CASCADE,
    youtube_video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT DEFAULT '',
    channel_name TEXT DEFAULT '',
    duration_seconds INTEGER NOT NULL,
    thumbnail_url TEXT DEFAULT '',
    position INTEGER NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.cloud_playlist_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Faixas visíveis de acordo com a playlist" ON public.cloud_playlist_tracks;
CREATE POLICY "Faixas visíveis de acordo com a playlist"
    ON public.cloud_playlist_tracks FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.cloud_playlists p 
        WHERE p.id = cloud_playlist_tracks.playlist_id
    ));

DROP POLICY IF EXISTS "Dono da playlist insere e edita faixas" ON public.cloud_playlist_tracks;
CREATE POLICY "Dono da playlist insere e edita faixas"
    ON public.cloud_playlist_tracks FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.cloud_playlists p 
        WHERE p.id = cloud_playlist_tracks.playlist_id AND p.user_id = auth.uid()
    ));

-- 5. SEGUIR & AMIZADES
CREATE TABLE IF NOT EXISTS public.follows (
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Qualquer um visualiza seguidores" ON public.follows;
CREATE POLICY "Qualquer um visualiza seguidores" ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuário gerencia quem segue" ON public.follows;
CREATE POLICY "Usuário gerencia quem segue" ON public.follows FOR ALL USING (auth.uid() = follower_id);

CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status friendship_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_friend_pair UNIQUE (user_id, friend_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Amigos veem suas próprias relações" ON public.friendships;
CREATE POLICY "Amigos veem suas próprias relações"
    ON public.friendships FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Usuários solicitam ou alteram amizades" ON public.friendships;
CREATE POLICY "Usuários solicitam ou alteram amizades"
    ON public.friendships FOR ALL
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 6. CHAT EM TEMPO REAL ESTILO RIOT CLIENT / IMESSAGE
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    shared_track_id TEXT DEFAULT NULL,
    shared_track_title TEXT DEFAULT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participantes leem suas mensagens" ON public.messages;
CREATE POLICY "Participantes leem suas mensagens"
    ON public.messages FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Remetente cria a mensagem" ON public.messages;
CREATE POLICY "Remetente cria a mensagem"
    ON public.messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Destinatário marca mensagem como lida" ON public.messages;
CREATE POLICY "Destinatário marca mensagem como lida"
    ON public.messages FOR UPDATE
    USING (auth.uid() = receiver_id);

-- 7. HABILITAR SUPABASE REALTIME
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 8. FAIXAS DA BIBLIOTECA DO USUÁRIO (CLOUD LIBRARY TRACKS)
CREATE TABLE IF NOT EXISTS public.user_library_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    youtube_video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist_guess TEXT DEFAULT '',
    channel_name TEXT DEFAULT '',
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    thumbnail_url TEXT DEFAULT '',
    source_platform TEXT DEFAULT 'youtube',
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_track UNIQUE (user_id, youtube_video_id)
);

ALTER TABLE public.user_library_tracks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Usuários gerenciam suas próprias faixas da biblioteca" ON public.user_library_tracks;
    CREATE POLICY "Usuários gerenciam suas próprias faixas da biblioteca"
        ON public.user_library_tracks FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
END $$;

-- 9. FAVORITOS / MÚSICAS CURTIDAS DO USUÁRIO
CREATE TABLE IF NOT EXISTS public.user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    youtube_video_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_favorite UNIQUE (user_id, youtube_video_id)
);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Usuários gerenciam seus próprios favoritos" ON public.user_favorites;
    CREATE POLICY "Usuários gerenciam seus próprios favoritos"
        ON public.user_favorites FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
END $$;

-- 10. HISTÓRICO DE REPRODUÇÃO DO USUÁRIO
CREATE TABLE IF NOT EXISTS public.user_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    youtube_video_id TEXT NOT NULL,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_recent UNIQUE (user_id, youtube_video_id)
);

ALTER TABLE public.user_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Usuários gerenciam seu próprio histórico de reprodução" ON public.user_history;
    CREATE POLICY "Usuários gerenciam seu próprio histórico de reprodução"
        ON public.user_history FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
END $$;

-- 11. PREFERÊNCIAS E CONFIGURAÇÕES DO USUÁRIO
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    volume REAL DEFAULT 1.0,
    shuffle BOOLEAN DEFAULT false,
    repeat_mode TEXT DEFAULT 'none',
    locale TEXT DEFAULT 'pt-BR',
    video_visible BOOLEAN DEFAULT false,
    spotify_connected BOOLEAN DEFAULT false,
    lastfm_username TEXT DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Usuários gerenciam suas próprias configurações" ON public.user_settings;
    CREATE POLICY "Usuários gerenciam suas próprias configurações"
        ON public.user_settings FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
END $$;

-- 12. MÉTRICAS DE HOME DASHBOARD & COMUNIDADE
ALTER TABLE public.cloud_playlists 
    ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

ALTER TABLE public.user_library_tracks 
    ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 1;

CREATE OR REPLACE FUNCTION public.get_community_trending_playlists(p_limit INT DEFAULT 12)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    cover_image_url TEXT,
    track_count INT,
    play_count INT,
    likes_count INT,
    created_at TIMESTAMPTZ,
    owner_id UUID,
    owner_username TEXT,
    owner_display_name TEXT,
    owner_avatar_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        p.id,
        p.name,
        p.description,
        p.cover_image_url,
        p.track_count,
        COALESCE(p.play_count, 0) as play_count,
        COALESCE(p.likes_count, 0) as likes_count,
        p.created_at,
        pr.id as owner_id,
        pr.username as owner_username,
        pr.display_name as owner_display_name,
        pr.avatar_url as owner_avatar_url
    FROM public.cloud_playlists p
    LEFT JOIN public.profiles pr ON p.user_id = pr.id
    WHERE p.visibility = 'public'
    ORDER BY COALESCE(p.play_count, 0) DESC, COALESCE(p.likes_count, 0) DESC, p.created_at DESC
    LIMIT p_limit;
$$;

-- 13. RPC PARA INCREMENTO ATÔMICO DE REPRODUÇÃO DE PLAYLIST
CREATE OR REPLACE FUNCTION public.increment_playlist_play(playlist_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.cloud_playlists
    SET play_count = COALESCE(play_count, 0) + 1
    WHERE id = playlist_id;
END;
$$;


