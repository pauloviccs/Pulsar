# Arquitetura do Sistema - Pulsar

## 1. Visão Geral

O Pulsar adota uma arquitetura híbrida **Desktop Local-First** integrada com serviços em nuvem em tempo real. O núcleo da reprodução, cache e persistência de dados de biblioteca funciona 100% offline via SQLite e Rust, enquanto recursos sociais e scrobble conectam-se de forma assíncrona ao Supabase e Last.fm.

```text
+-------------------------------------------------------------------------+
|                              FRONT-END                                  |
|            Svelte 5 (Runes) + SvelteKit 2 SPA + Tailwind CSS v4         |
|                                                                         |
|  [TopProfileButton]  [Header]  [Sidebar]  [PlaylistGrid]  [PlayerBar]   |
|         |                |         |              |            |        |
|    authStore        playerStore  libraryStore  socialStore   i18nStore  |
+-------------------------------------------------------------------------+
       | IPC (tauri invoke)                     | Web Audio / HTML5 Audio
       v                                        v
+-------------------------------------------------------------------------+
|                            BACKEND TAURI (Rust)                         |
|                                                                         |
|  [IPC Handlers] <---> [Database (SQLite WAL)] <---> [yt-dlp Sidecar]    |
|         |                                                 |             |
|         +-----------> [Proxy HTTP Axum :41235] <----------+             |
|                       (HTTP 206 Range Streaming)                        |
+-------------------------------------------------------------------------+
       |                                                |
       v (HTTPS / REST)                                 v (HTTPS / WSS)
+------------------------+                    +---------------------------+
|    Last.fm API 2.0     |                    |      Supabase Cloud       |
|  Audioscrobbler OAuth  |                    |  Auth, Profiles, Presença |
+------------------------+                    +---------------------------+
```

## 2. Camadas da Aplicação

### 2.1 Front-end (Svelte 5 Runes + Vite)
- **Modo SPA:** Configurado com `@sveltejs/adapter-static` com `fallback: 'index.html'` para que todas as rotas sejam resolvidas localmente pelo webview do Tauri.
- **Gerenciamento de Estado:** Baseado nas stores nativas e nos Runes do Svelte 5 (`$state`, `$derived`, `$effect`), garantindo reatividade de alta performance sem overhead de renderização.
- **Camada de Abstração IPC (`src/lib/api/tauri.ts`):** Todas as chamadas para o backend Rust passam por `safeInvoke`, garantindo fallbacks seguros e evitando quebras caso o app seja testado no navegador sem o runtime Tauri injetado.

### 2.2 Motor de Áudio & Proxy Local (Rust Axum na porta 41235)
- O `GlobalAudioEngine.svelte` consome streams de áudio gerados pelo proxy local Axum.
- O proxy intercepta as URLs do YouTube obtidas pelo `yt-dlp`, faz download progressivo e serve o fluxo de áudio com cabeçalhos `Content-Range` e status `206 Partial Content`.
- Isso permite que o usuário avance ou recue (scrubbing) instantaneamente sem travar a reprodução.
- Crossfade linear suave evita estalos ou cortes bruscos entre faixas.

### 2.3 Persistência Local-First (SQLite rusqlite)
- Arquivo de banco de dados localizado em `%LOCALAPPDATA%/com.pulsar.app/pulsar.db`.
- Operando com `PRAGMA journal_mode = WAL` para concorrência de leitura/escrita e performance ultrarrápida.
- Migrações automáticas embutidas na inicialização em Rust (`Database::init()`).

### 2.4 Camada Cloud & Social (Supabase)
- Autenticação de usuários via Supabase Auth.
- Perfis públicos identificados por `@username` e uma `#tag` alfanumérica única de 4 dígitos (estilo Discord/Riot).
- Realtime channels para atualização de status de presença (online, away, busy, offline) e chat direto entre amigos.

### 2.5 Scrobbling & Metadados (Last.fm API 2.0)
- Autenticação OAuth do Last.fm disparada via navegador padrão do sistema utilizando `@tauri-apps/plugin-opener`.
- Assinatura criptográfica MD5 pura no client para chamadas de `auth.getSession`, `track.scrobble` e `track.updateNowPlaying`.
