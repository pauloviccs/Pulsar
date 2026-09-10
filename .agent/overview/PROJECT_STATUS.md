# Project Overview

## Project Name
Pulsar (VICCS_Pullsar)

## Description
Pulsar é um player de áudio desktop moderno para Windows 10 e 11, inspirado na sofisticação visual do Apple Music e na versatilidade do Spotify. Ele permite extrair, indexar e reproduzir áudio com fidelidade cristalina diretamente de vídeos individuais e playlists do YouTube, sem exibir publicidade forçada, sem desperdiçar recursos com renderização de vídeo desnecessária e mantendo um consumo mínimo de memória RAM e CPU.

A aplicação adota uma arquitetura híbrida *Local-First*: as faixas, playlists locais, favoritos e o histórico de reprodução residem em um banco SQLite embutido em modo WAL com streaming de áudio contínuo via servidor proxy local Axum (porta 41235) com suporte a requisições HTTP 206 Range (scrubbing instantâneo). Em paralelo, integra uma camada social em nuvem via Supabase (perfis com tag alfanumérica única estilo Discord/Twitter, lista de amigos em tempo real, status de presença e chat direto), além de scrobbling oficial para a Last.fm API 2.0 e suporte multilíngue profundo (i18n) em 6 idiomas.

## Tech Stack
- Languages: Rust (edition 2021), TypeScript (~5.7/6.0), Svelte 5 (Runes mode: `$state`, `$derived`, `$effect`), SQL (SQLite & PostgreSQL)
- Frameworks: Tauri v2 (`@tauri-apps/api`, `@tauri-apps/cli`, `tauri-plugin-single-instance`, `@tauri-apps/plugin-opener`), SvelteKit 2 (modo SPA com `@sveltejs/adapter-static`), Tailwind CSS v4 (`@tailwindcss/vite`)
- Tools: yt-dlp (sidecar binário Windows x86_64 empacotado no runtime Tauri), Vite 6/8, Cargo, rusqlite (SQLite 3 embutido com WAL), Tokio, Axum, Reqwest, lucide-svelte
- Services: Local-First (SQLite nativo) + Supabase Auth & Cloud Database (PostgreSQL) + Last.fm API 2.0 Audioscrobbler oficial
- Architecture: Componentes orientados a eventos, store reativa em Svelte 5, IPC seguro via `safeInvoke`, internacionalização em 6 idiomas com tipagem rígida (`TranslationDictionary`), layout responsivo universal (Mobile drawer, Tablet adaptativo, Desktop e Ultrawide/4K).

## Folder Structure
```text
VICCS_Pullsar/
├── .agent/
│   ├── assets/
│   │   └── svg/
│   │       ├── PulsarLogo_Horizontal.svg
│   │       ├── PulsarLogo_Icon.svg
│   │       └── PulsarLogo_Vertical.svg
│   ├── context/
│   │   ├── architecture.md
│   │   ├── database_schema.md
│   │   └── stack.md
│   ├── guidelines/
│   │   ├── code_style.md
│   │   ├── i18n.md
│   │   └── ui_ux.md
│   ├── memory/
│   │   ├── active_task.md
│   │   ├── changelog.md
│   │   └── todos.md
│   └── overview/
│       └── PROJECT_STATUS.md
├── build/ (Output estático do SvelteKit para consumo do Tauri)
├── scripts/
│   └── setup_ytdlp.ps1
├── src-tauri/
│   ├── bin/
│   │   └── yt-dlp-x86_64-pc-windows-msvc.exe
│   ├── capabilities/
│   │   └── default.json (Permissões de opener, core e IPC)
│   ├── icons/
│   │   ├── 32x32.png
│   │   ├── 128x128.png
│   │   ├── 128x128@2x.png
│   │   ├── icon.ico (Ícone oficial do executável Windows & NSIS)
│   │   ├── icon.png (Ícone de alta resolução)
│   │   └── Square... (Formatos para notificações Windows)
│   ├── src/
│   │   ├── audio_engine/ (Servidor proxy Axum 41235, streaming Range 206 e cache de áudio)
│   │   ├── commands/ (21 handlers IPC Tauri registrados em lib.rs)
│   │   ├── db/ (rusqlite, WAL, migrações defensivas automáticas)
│   │   ├── youtube/ (Integração yt-dlp, extração de faixas e playlists em lote)
│   │   ├── lib.rs (Tray icon nativo, Single Instance, plugin-opener e init do Axum/DB)
│   │   └── main.rs (Ponto de entrada binário Tauri)
│   ├── Cargo.toml
│   └── tauri.conf.json (Configurações de janela, ícones, bundle NSIS e plugins)
├── src/
│   ├── app.css (Estilos globais, utilitários Liquid Glass e variáveis de tema)
│   ├── app.html (Template HTML base)
│   ├── lib/
│   │   ├── api/
│   │   │   ├── supabase.ts (Cliente Supabase, autenticação e sessão reativa)
│   │   │   └── tauri.ts (Camada segura safeInvoke, fallback web e checagem isTauri)
│   │   ├── components/
│   │   │   ├── AuthModal.svelte (Login/Cadastro com antibot PulsarCaptcha)
│   │   │   ├── BottomPlayerBar.svelte (Barra de reprodução responsiva com controles defensivos)
│   │   │   ├── DeletePlaylistModal.svelte (Confirmação destrutiva com animação spring)
│   │   │   ├── DirectChatModal.svelte (Chat direto privado em tempo real com amigos)
│   │   │   ├── EditPlaylistModal.svelte (Estúdio de edição de capa 1:1 com zoom/pan e metadados)
│   │   │   ├── EditProfileModal.svelte (Edição de avatar, banner, bio e status)
│   │   │   ├── GlobalAudioEngine.svelte (Motor invisível de áudio HTML5 com crossfade seguro)
│   │   │   ├── HeroSlider.svelte (Carrossel dinâmico das faixas mais populares)
│   │   │   ├── LinkInputModal.svelte (Entrada de links/playlists do YouTube com extração em lote)
│   │   │   ├── MiniPlayerView.svelte (Modo Picture-in-Picture ultracompacto)
│   │   │   ├── NewPlaylistModal.svelte (Criação de playlists com visibilidade social)
│   │   │   ├── NowPlayingView.svelte (Tela cheia imersiva com Apple Music Glow e vídeo 16:9)
│   │   │   ├── PlaylistGrid.svelte (Grade responsiva de 1 a 6 colunas de playlists)
│   │   │   ├── PulsarCaptcha.svelte (Desafio antibot interativo para cadastro)
│   │   │   ├── QueueDrawer.svelte (Gaveta retrátil da fila de reprodução)
│   │   │   ├── SettingsView.svelte (Configurações de áudio, Last.fm com opener e i18n)
│   │   │   ├── Sidebar.svelte (Navegação lateral desobstruída com scroll infinito)
│   │   │   ├── SocialDrawer.svelte (Painel de amigos, solicitações e presenças)
│   │   │   ├── TopProfileButton.svelte (Pílula superior de perfil com #tag e popover de ações)
│   │   │   ├── TrackList.svelte (Tabela de faixas com adição a playlists e ordenação)
│   │   │   └── UserProfileView.svelte (Visualização de perfil social estilo Twitter/X)
│   │   ├── i18n/
│   │   │   ├── locales/ (pt-BR.ts, en.ts, es.ts, zh-CN.ts, ja.ts, ko.ts)
│   │   │   ├── index.ts (Store $locale, $t e persistência no localStorage)
│   │   │   └── types.ts (Contrato TypeScript estrito TranslationDictionary)
│   │   ├── services/
│   │   │   └── lastfm.ts (Assinatura MD5 pura, autenticação OAuth e scrobble API 2.0)
│   │   ├── stores/
│   │   │   ├── authStore.ts (Estado de autenticação Supabase, perfil e presença)
│   │   │   ├── libraryStore.ts (Sincronização com SQLite local, playlists e favoritos)
│   │   │   ├── playerStore.ts (Fila, reprodução, volume, crossfade e normalização)
│   │   │   └── socialStore.ts (Amizades, chat em tempo real e busca de usuários)
│   │   └── types.ts (Tipos TypeScript universais do domínio)
│   └── routes/
│       ├── +layout.svelte
│       ├── +layout.ts
│       └── +page.svelte (Layout raiz com gaveta mobile deslizante e header adaptativo)
├── static/
│   ├── favicon.png (Favicon gerado do logo oficial)
│   └── pulsar-logo.svg (SVG vetorial de alta definição)
├── supabase/
│   └── schema.sql (Script SQL de migração e RLS do Supabase)
├── package.json
├── svelte.config.js
├── tsconfig.json
└── vite.config.js
```

## Current Features Implemented
1. **Rebranding Completo da Identidade Visual:**
   - Todos os ícones do aplicativo (`icon.ico`, `icon.png`, matriz de ícones Windows, barra de tarefas, tray icon e favicon) foram reconstruídos a partir do vetor oficial `PulsarLogo_Icon.svg`.
   - Novo logotipo horizontal integrado na Sidebar e em todas as telas com estética Liquid Glass.

2. **TopProfileButton & Posicionamento de Perfil no Header:**
   - O card de identificação do usuário que ficava espremido no rodapé da Sidebar foi promovido para o cabeçalho superior (Top Header).
   - Exibe Avatar com anel de presença em tempo real, nome do usuário e a `#tag` alfanumérica (`#PS7D`) em destaque com fonte mono e cor de acento vibrante.
   - Popover dropdown interativo com cópia em 1 clique de `@username#tag`, seletor de status (online, ausente, ocupado, invisível), navegação rápida para Meu Perfil, Editar Perfil, Amigos, Configurações e botão vermelho de Logout.

3. **Desobstrução e Fluidez da Sidebar:**
   - Rodapé removido da Sidebar, liberando a área de playlists para scroll infinito (`flex-1 overflow-y-auto`) sem qualquer corte ou colisão com a barra de reprodução.

4. **Responsividade Universal (Todos os Viewports):**
   - **Smartphones e telas pequenas (< 768px):** Menu hamburger animado no topo aciona gaveta lateral deslizante com backdrop blur fosco; campo de busca autoexpansível; barra de reprodução inteligente que oculta sliders secundários para priorizar scrubbing e botões de playback.
   - **Tablets (768px a 1024px):** Layout equilibrado com grade de playlists em 2 a 3 colunas.
   - **Desktops e Telas Ultrawide / 4K (> 1024px até 3840px+):** Grade fluida de playlists expandindo para até 5 e 6 colunas, cabeçalho panorâmico perfeitamente diagramado.

5. **Integração Last.fm 2.0 com Plugin Opener:**
   - Abertura garantida do navegador padrão do sistema operacional via `@tauri-apps/plugin-opener` para o fluxo de autorização OAuth do Last.fm.
   - Chave oficial de API embutida por padrão (`VICCS_PulsarPlayer`), dispensando configuração manual por parte do usuário comum.
   - Painel colapsável para desenvolvedores inserirem chaves customizadas de API se desejarem.
   - Ações de contingência integradas: botões para *Abrir no Navegador* e *Copiar Link de Autorização*.

6. **Internacionalização Profunda (100% i18n):**
   - Cobertura completa em 6 idiomas: Português do Brasil (`pt-BR`), Inglês (`en`), Espanhol (`es`), Chinês Simplificado (`zh-CN`), Japonês (`ja`) e Coreano (`ko`).
   - 100% das telas, modais de confirmação destrutiva, estúdio de edição de playlist, perfil, configurações, contadores plurais e formatação de datas dinâmicas via `toLocaleDateString($currentLocale)`.

7. **Proteção Antibot / Captcha no Cadastro:**
   - Componente `PulsarCaptcha.svelte` integrado ao `AuthModal.svelte` para impedir spam e bots automatizados no registro de contas Supabase.

8. **Motor de Áudio & Proxy Rust Axum (Porta 41235):**
   - Servidor proxy local em Rust transmitindo fluxos de áudio extraídos pelo `yt-dlp` com cabeçalhos HTTP 206 Range (suporte a seeking/scrubbing imediato sem bufferings longos).
   - Cache persistente de arquivos de áudio em disco.
   - Crossfade linear suave entre faixas com proteção contra silenciamento acidental de volume.

9. **Prevenção de Múltiplas Instâncias (Single Instance):**
   - Integrado com `tauri-plugin-single-instance`. Ao tentar abrir uma segunda janela, o processo existente é automaticamente trazido para o foco.

10. **Bandeja do Sistema (Tray Icon):**
    - Ícone nativo na bandeja do Windows configurado via `app.default_window_icon`. Opção persistente em SQLite para minimizar ao fechar.

## Work-in-Progress & Pending Tasks
- **Compilação do Executável Instalador (`.exe` NSIS):**
  - Código-fonte, assets e configurações Tauri estão 100% validados e prontos.
  - A compilação está deliberadamente retida aguardando a ordem explícita do usuário conforme instrução prévia.

## Known TODOs & Roadmap
- [ ] Executar `npx tauri build --bundles nsis` após comando explícito do usuário.
- [ ] Validar inicialização limpa do executável compilado em ambiente Windows.
- [ ] Implementar sistema de letras sincronizadas (LRC/Musixmatch) na visualização `NowPlayingView`.
- [ ] Adicionar equalizador paramétrico de 10 bandas no motor de áudio.

## Verification & Quality Gates
- **Rust Backend:** Compilação com `cargo check` sem pendências.
- **Frontend Svelte 5:** `npm run check` aprovado com **0 errors and 0 warnings**.
- **Frontend Vite SPA:** `npm run build` aprovado gerando bundle de produção com sucesso.
- **Conformidade de Tipos i18n:** Todos os 6 dicionários de idiomas validados estritamente contra o contrato TypeScript `TranslationDictionary`.
