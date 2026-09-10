# Stack Tecnológico - Pulsar

## 1. Núcleo do Sistema (Desktop)
- **Runtime:** Tauri v2 (`2.x`)
- **Linguagem Backend:** Rust 2021 Edition
- **Servidor Proxy Local:** Axum + Tokio (porta local `41235`)
- **HTTP Client:** Reqwest (para requests defensivos de streaming)
- **Persistência Local:** SQLite 3 via crate `rusqlite` com `bundled` e `WAL mode`
- **Extrator de Áudio (Sidecar):** `yt-dlp` compilado para x86_64-pc-windows-msvc (`src-tauri/bin/yt-dlp-x86_64-pc-windows-msvc.exe`)
- **Plugins Tauri:**
  - `tauri-plugin-single-instance` (v2): Previne múltiplas instâncias concorrentes.
  - `@tauri-apps/plugin-opener` (v2): Abertura garantida de URLs externas no navegador nativo do sistema.
  - Native System Tray: Bandeja do sistema com ícone customizado e opções de controle de janela.

## 2. Front-end
- **Linguagem:** TypeScript (~5.7 / 6.0)
- **Framework de UI:** Svelte 5 (modo Runes com `$state`, `$derived`, `$effect`)
- **Meta-framework:** SvelteKit 2 (modo Single Page Application com `@sveltejs/adapter-static`)
- **Estilização:** Tailwind CSS v4 com `@tailwindcss/vite`
- **Ícones:** `lucide-svelte`
- **Ferramenta de Build:** Vite 6 / 8

## 3. Serviços & Protocolos
- **Banco de Dados Local:** SQLite local-first em `%LOCALAPPDATA%/com.pulsar.app/pulsar.db`
- **Banco de Dados Cloud & Auth:** Supabase (PostgreSQL 15+ com Row Level Security e Realtime WSS)
- **Scrobbler:** Last.fm API 2.0 (Autenticação OAuth Web + Web API Assinada com MD5)
- **Internacionalização:** Sistema próprio reativo com dicionários TypeScript tipados (`TranslationDictionary`) cobrindo 6 idiomas: `pt-BR`, `en`, `es`, `zh-CN`, `ja`, `ko`.

## 4. Portas de Rede & Endpoints
- Porta `1420`: Vite Dev Server local para desenvolvimento.
- Porta `41235`: Servidor proxy Axum local do Pulsar em Rust (`http://127.0.0.1:41235/stream?id=<video_id>`).
