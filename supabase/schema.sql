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
