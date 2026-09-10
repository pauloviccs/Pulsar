# Schemas de Banco de Dados - Pulsar

O Pulsar opera com dois bancos de dados complementares: o **SQLite Local** (para reprodução, cache e playlists locais com performance zero-latency) e o **Supabase Cloud (PostgreSQL)** (para autenticação, perfis com tag única, presença social e amizades).

---

## 1. Banco de Dados Local (SQLite 3 - `%LOCALAPPDATA%/com.pulsar.app/pulsar.db`)

Configurado com `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;`.

### 1.1 Tabela `tracks`
Armazena os metadados de cada faixa extraída ou ouvida.
```sql
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    youtube_video_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    artist_guess TEXT,
    channel_name TEXT,
    duration_seconds INTEGER NOT NULL,
    thumbnail_path TEXT,
    audio_stream_cached BOOLEAN DEFAULT 0,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_played_at TIMESTAMP
);
```

### 1.2 Tabela `playlists`
Playlists criadas pelo usuário ou importadas do YouTube.
```sql
CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    cover_image_path TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_imported_youtube_playlist BOOLEAN DEFAULT 0,
    source_youtube_playlist_id TEXT
);
```

### 1.3 Tabela `playlist_tracks`
Associação de faixas a playlists com ordenação posicional.
```sql
CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
```

### 1.4 Tabela `favorites`
Faixas marcadas como curtidas / favoritas.
```sql
CREATE TABLE IF NOT EXISTS favorites (
    track_id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
```

### 1.5 Tabela `playback_state`
Estado persistido de reprodução para restauração contínua entre sessões.
```sql
CREATE TABLE IF NOT EXISTS playback_state (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    current_track_id TEXT,
    current_playlist_id TEXT,
    position_seconds REAL DEFAULT 0.0,
    volume REAL DEFAULT 1.0,
    shuffle BOOLEAN DEFAULT 0,
    repeat_mode TEXT DEFAULT 'none',
    video_visible BOOLEAN DEFAULT 0,
    FOREIGN KEY(current_track_id) REFERENCES tracks(id)
);
```

---

## 2. Banco de Dados Cloud (Supabase / PostgreSQL)

Definido em `supabase/schema.sql` com Row Level Security (RLS).

### 2.1 Tabela `public.profiles`
Perfis públicos de usuários com identificador exclusivo `@username#tag`.
```sql
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
```

### 2.2 Tabela `public.friendships`
Relações de amizade entre dois usuários.
```sql
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status friendship_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_friendship UNIQUE (user_id, friend_id),
    CONSTRAINT cannot_friend_self CHECK (user_id <> friend_id)
);
```

### 2.3 Tabela `public.direct_messages`
Mensagens de texto privadas entre amigos.
```sql
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### 2.4 Tabela `public.cloud_playlists` e `cloud_playlist_tracks`
Playlists públicas ou compartilhadas salvas em nuvem para descoberta pela comunidade.
```sql
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
```
