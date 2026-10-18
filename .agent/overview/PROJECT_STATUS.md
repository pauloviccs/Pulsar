# Project Overview

## Project Name
Pulsar (`VICCS_Pulsar` / `VICCS_Lumia/VICCS_Pulsar`)

## Description
Pulsar é um player desktop de streaming de áudio e vídeo de alta fidelidade para Windows 10 e 11, projetado sob arquitetura híbrida *Local-First* e linguagem visual espacial em **Ilhas Flutuantes (Floating Islands HUD)** com física óptica de vidro líquido (**Apple Liquid Glass**, inspirado em `liqui.design` e visionOS). O aplicativo indexa e reproduz áudio e vídeo com latência ultrabaixa a partir de links do YouTube, YouTube Music e Spotify (faixas avulsas, álbuns e playlists completas), eliminando anúncios, economizando banda e operando com pegada de memória RAM reduzida (~30MB em background) quando comparado a players tradicionais baseados em Electron.

O projeto está localizado na árvore local `g:\GitHub\Vibecoding\VICCS_Git\VICCS_Lumia\VICCS_Pulsar`.

O aplicativo opera sobre a versão oficial de produção **0.2.9**, incorporando:
1. **Recuperação de Senha Nativa e Híbrida (Axum + In-App OTP):** Fim do redirecionamento para porta morta (`localhost:3000`). O Supabase agora se comunica com o servidor local Axum (`http://localhost:41235/reset-password`), que serve uma página Liquid Glass web no navegador do usuário, com opção de recuperação in-app direta através de código OTP de 6 dígitos no `AuthModal.svelte`.
2. **Dynamic Island Desktop Nativa:** Movimentação física livre (Drag & Drop) através da tela e múltiplos monitores, além de botões dedicados para minimizar para a barra de tarefas ou para a bandeja do sistema (System Tray).
3. **Arquitetura Local-First & Redução de 99.998% de Egress no Supabase:** Check-Before-Fetch via RPC Supabase (`get_user_sync_state` de ~180 bytes), Delta Sync incremental e sincronização granular de playlists, preservando o cache local SQLite e dispensando tráfego excessivo de rede.
4. **Circuit Breaker Automático para Quotas e Quedas de Rede:** Suspensão automática de requisições de nuvem por 15 minutos em caso de erros HTTP 402 ou instabilidade, garantindo operação offline contínua via SQLite nativo.
5. **Estabilização do Player e Estado Reativo:** Correção de alternância indesejada entre modo vídeo e capa, suporte e dimensionamento dinâmico de legendas, sincronização bidirecional do botão de favoritos (curtidas) entre todos os modais e gavetas, e eliminação de travamentos no modo shuffle.
6. **Player de Vídeo Ultrawide & Drift Lock A/V:** Formatos de tela flexíveis (16:9, 16:10, 19.5:9, 21:9 Ultrawide, 32:9 Super Ultrawide), sincronização contínua A/V e HUD global de saída de tela cheia.

## Tech Stack
- **Languages:** Rust (edition 2021), TypeScript (~6.0), Svelte 5 (Runes mode: `$state`, `$derived`, `$effect`), SQL (SQLite 3 WAL & PostgreSQL Supabase)
- **Frameworks:** Tauri v2 (`@tauri-apps/api`, `@tauri-apps/cli`, `tauri-plugin-single-instance`, `@tauri-apps/plugin-opener`), SvelteKit 2 (modo SPA com `@sveltejs/adapter-static`), Tailwind CSS v4 (`@tailwindcss/vite`)
- **Tools:** yt-dlp (sidecar binário Windows x86_64 empacotado no runtime Tauri), Vite 8, Cargo, rusqlite (SQLite 3 embutido com WAL), Tokio, Axum, Reqwest, Windows API Crate (`windows` v0.58 com IMMDeviceEnumerator, CoreAudio e Win32 Registry / winreg), `@lucide/svelte` & `lucide-svelte`
- **Services:** Local-First (SQLite nativo com tabela de preferências `settings` e cache de credenciais) + Spotify Web API (Client Credentials Flow & Resolução de Metadados) + YouTube / YouTube Music Extractor (via yt-dlp) + Supabase Auth & Cloud Database (PostgreSQL / WebSockets Realtime / RLS / RPCs) + Last.fm API 2.0 Audioscrobbler oficial
- **Distribution:** Instalador oficial NSIS x64 (`Pulsar_0.2.9_x64-setup.exe`), pacote Windows Installer WiX (`Pulsar_0.2.9_x64_en-US.msi`) e executável nativo standalone (`tauri-app.exe`) compilados e integrados.

## Folder Structure
- ```text
VICCS_Pulsar/ (Localização: g:\GitHub\Vibecoding\VICCS_Git\VICCS_Lumia\VICCS_Pulsar)
├── .agent/ (Cérebro local e memória do projeto - Cortex)
│   ├── assets/ (Assets vetoriais, marcas e logos originais)
│   ├── context/
│   │   ├── PULSAR_AUDIO_OUTPUT_CONTEXT.md (Diretrizes de roteamento de áudio)
│   │   ├── PULSAR_FRONTEND_REWORK_CONTEXT.md (Diretrizes de design e UI/UX Liquid Glass)
│   │   ├── architecture.md (Topologia de arquitetura Local-First híbrida)
│   │   ├── database_schema.md (Documentação detalhada SQLite + Supabase)
│   │   └── stack.md (Especificação do stack tecnológico)
│   ├── guidelines/
│   │   ├── code_style.md (Padrões de TypeScript, Svelte 5 e Rust)
│   │   ├── i18n.md (Guia de internacionalização nos 6 idiomas)
│   │   └── ui_ux.md (Tokens e preceitos visuais Liquid Glass)
│   ├── implementation-plans/
│   │   ├── pulsar_v027_implementation_plan.md
│   │   └── pulsar_v028_implementation_plan.md
│   ├── logs/ (Logs de auditoria e depuração de runtime: 0 a 14)
│   ├── memory/
│   │   ├── active_task.md (Status do ciclo atual)
│   │   ├── changelog.md (Registro histórico de versões)
│   │   └── todos.md (Backlog e próximos passos)
│   ├── overview/
│   │   └── PROJECT_STATUS.md (Este documento de sincronização contínua)
│   ├── references/ (Moodboards e referências de arte)
│   ├── releases/
│   │   ├── RELEASE_v0.2.6.md (Release Notes v0.2.6)
│   │   ├── RELEASE_v0.2.7.md (Release Notes v0.2.7)
│   │   ├── RELEASE_v0.2.8.md (Release Notes v0.2.8)
│   │   └── RELEASE_v0.2.9.md (Release Notes v0.2.9 Oficial)
│   ├── visual-rework/ (Especificações ópticas e packs Liquid Glass)
│   └── CHANGELOG_v0.2.9.md (Changelog Markdown para Release do GitHub)
├── assets/ (Assets públicos de marca para GitHub)
├── build/ (Output estático SPA de produção gerado pelo Vite/SvelteKit)
├── docs/ (Documentação técnica de áudio e pesquisa de integrações)
├── latest.json (Arquivo de manifesto de atualização OTA com espelho de download)
├── scripts/ (Scripts utilitários para ícones e assets)
├── src-tauri/
│   ├── bin/ (Extrator yt-dlp empacotado para Windows x86_64)
│   ├── capabilities/ (Configurações de segurança e IPC Tauri v2)
│   ├── icons/ (Matriz de ícones Win32, taskbar e NSIS)
│   ├── src/
│   │   ├── audio_devices.rs (Enumeração COM CoreAudio IMMDeviceEnumerator)
│   │   ├── audio_engine/ (Proxy Axum 41235, streaming Range 206, Auto-Recovery e rota /reset-password)
│   │   ├── cast/ (Google Cast v2 mDNS UDP 5353 e Eureka TLS 8009)
│   │   ├── commands/ (IPC Tauri: library, settings, autostart, fullscreen, audio devices, drag)
│   │   ├── db/ (SQLite nativo rusqlite WAL: tracks, playlists, settings, history)
│   │   ├── link_resolver/ (Resolução de URLs YouTube/Spotify e metadados)
│   │   ├── logger.rs (Sistema de logging nativo em disco)
│   │   ├── main.rs (Ponto de entrada Windows GUI)
│   │   ├── lib.rs (Setup Tauri, registro de comandos e single-instance)
│   │   ├── reset_password.html (Interface Web Apple Liquid Glass para recuperação de senha)
│   │   ├── spotify/ (Integração Spotify Web API com retentativa resiliente)
│   │   ├── taskbar.rs (Controles de miniatura na barra de tarefas Win32)
│   │   ├── updater.rs (Gestão de atualização OTA de binários)
│   │   ├── upnp/ (SSDP discovery e SOAP AVTransport para Smart TVs)
│   │   └── youtube/ (Extração de áudio/vídeo via yt-dlp)
│   ├── target/release/ (Binários compilados: tauri-app.exe, bundle/nsis e bundle/msi)
│   ├── Cargo.toml (Dependências Rust)
│   └── tauri.conf.json (Configuração do aplicativo, permissões e empacotamento)
├── static/ (Assets estáticos servidos pelo frontend)
├── src/
│   ├── lib/
│   │   ├── api/
│   │   │   ├── supabase.ts (Cliente Supabase com fallback anônimo)
│   │   │   └── tauri.ts (Ponte IPC frontend-backend tipada)
│   │   ├── audio/ (Arquitetura extensível de saída e transmissão de áudio)
│   │   │   ├── AudioRouter.ts (Gerenciador e chaveador mestre de destinos de áudio)
│   │   │   ├── types.ts (Interfaces AudioOutputTarget, DeviceInfo e estados)
│   │   │   ├── discovery/ (Scanners de descoberta mDNS, UPnP SSDP e Win32 CoreAudio)
│   │   │   └── targets/ (Alvos de playback: Local, Bluetooth, Google Cast e UPnP DLNA)
│   │   ├── components/ (30 componentes de interface Svelte 5)
│   │   │   ├── AuthModal.svelte (Autenticação modal, login social e recuperação de senha híbrida)
│   │   │   ├── BottomPlayerBar.svelte (Media Capsule Player Dock)
│   │   │   ├── DeletePlaylistModal.svelte (Confirmação de exclusão)
│   │   │   ├── DirectChatModal.svelte (Chat direto com amigos)
│   │   │   ├── EditPlaylistModal.svelte (Edição de nome, capa e descrição)
│   │   │   ├── EditProfileModal.svelte (Edição de perfil de usuário)
│   │   │   ├── GlobalAudioEngine.svelte (Motor de áudio global HTML5 Audio)
│   │   │   ├── HeroSlider.svelte (Carrossel dinâmico da Home)
│   │   │   ├── HomeDashboard.svelte (Central Home Dashboard)
│   │   │   ├── LinkInputModal.svelte (Importação de links YouTube/Spotify)
│   │   │   ├── LogsModal.svelte (Visualizador de logs em tempo real)
│   │   │   ├── MiniPlayerView.svelte (Mini player flutuante visionOS)
│   │   │   ├── NewPlaylistModal.svelte (Criação de playlists)
│   │   │   ├── NotificationCenter.svelte (Central de Notificações com sino e badge)
│   │   │   ├── NowPlayingView.svelte (Visualização em tela cheia com vídeo, capa e controles)
│   │   │   ├── PlaylistGrid.svelte (Grid de cards de playlists com Empty State)
│   │   │   ├── PulsarCaptcha.svelte (Verificação de segurança)
│   │   │   ├── PulsarConnectModal.svelte (Casting: DLNA, UPnP, Google Cast)
│   │   │   ├── QueueDrawer.svelte (Gaveta lateral de fila com elevação z-[70])
│   │   │   ├── SettingsView.svelte (Tela de configurações com autostart e marcas)
│   │   │   ├── Sidebar.svelte (Studio Floating Dock com drag & drop e pin de playlists)
│   │   │   ├── SocialDrawer.svelte (Painel social com amigos e atividades)
│   │   │   ├── SplashScreen.svelte (Intro em 2 etapas: Pulsar + Created by Lumia & VICCS)
│   │   │   ├── TopProfileButton.svelte (Botão de perfil e status com sino)
│   │   │   ├── TrackList.svelte (Tabela de faixas com carregamento progressivo)
│   │   │   ├── UpdateModal.svelte (Modal do atualizador de versão)
│   │   │   ├── UpdateToast.svelte (Alerta de atualização disponível)
│   │   │   ├── UserProfileView.svelte (Perfil de usuário e estatísticas)
│   │   │   └── VideoFormatDropdown.svelte (Menu Liquid Glass de resoluções e displays)
│   │   ├── i18n/ (Sistema de internacionalização em 6 idiomas)
│   │   ├── services/
│   │   │   ├── lastfm.ts (Scrobbling e envio de Now Playing)
│   │   │   ├── logger.ts (Logger estruturado para front-end)
│   │   │   └── syncEngine.ts (Sincronização bidirecional Supabase + SQLite com Check-Before-Fetch)
│   │   ├── stores/
│   │   │   ├── authStore.ts (Sessão, perfil, preferências e fluxo de redefinição de senha)
│   │   │   ├── libraryStore.ts (Playlists, faixas, ordenação e pin)
│   │   │   ├── notificationStore.ts (Notificações em tempo real)
│   │   │   ├── playerStore.ts (Estado do player, volume, vídeo, modos, legendas e aspect ratio)
│   │   │   ├── socialStore.ts (Amigos, status online e mensagens)
│   │   │   └── updateStore.ts (Estado de atualização OTA)
│   │   └── types.ts (Definições de tipos TypeScript unificadas da aplicação)
│   ├── routes/
│   │   ├── +layout.svelte (HUD global de escape/tela cheia, modais e layout raiz)
│   │   ├── +layout.ts (SPA mode / prerender configuration)
│   │   └── +page.svelte (Layout mestre com ilha flutuante central e navegação)
│   ├── app.css (Design System Apple Liquid Glass, .lq-surface-panel e tokens)
│   └── app.html
├── supabase/
│   ├── backup/ (Backups estruturais e de dados)
│   ├── logs/ (Logs de auditoria remota)
│   └── schema.sql (Script de migração SQL: profiles, friendships, playlists, notifications, RPCs)
├── package.json (Dependências de frontend e scripts de build)
└── vite.config.ts (Configurações do Vite e Tailwind v4)
```

## Key Files
- `src-tauri/src/main.rs` & `src-tauri/src/lib.rs`: Setup inicial do runtime Tauri v2, IPC handlers, single-instance e inicialização do banco SQLite.
- `src-tauri/src/audio_engine/mod.rs`: Servidor Axum local na porta 41235 servindo fluxo de áudio via HTTP Range 206 e a rota `/reset-password` para recuperação de senha web.
- `src-tauri/src/reset_password.html`: Interface web em Apple Liquid Glass para recuperação de senha com integração direta ao Supabase.
- `src/lib/stores/authStore.ts`: Store de autenticação com suporte a `resetPasswordForEmail`, `verifyRecoveryOtp`, `updatePassword` e escuta do evento `PASSWORD_RECOVERY`.
- `src/lib/components/AuthModal.svelte`: Modal de autenticação com fluxo completo e híbrido de redefinição de senha (e-mail + OTP in-app).
- `src/lib/services/syncEngine.ts`: Motor de sincronização Local-First com Check-Before-Fetch (`get_user_sync_state`) e Delta Sync incremental que reduz 99.998% do tráfego.
- `src/lib/audio/AudioRouter.ts`: Central de gerenciamento e chaveamento dinâmico de saídas de áudio (local, Bluetooth, Google Cast e UPnP/DLNA).
- `src/lib/components/NowPlayingView.svelte`: Interface do player expandido com vídeo em background/foreground, capa imersiva, drift lock A/V e controle de aspect ratio.
- `src/lib/components/VideoFormatDropdown.svelte`: Menu suspenso estilo Apple Liquid Glass com presets de resoluções (16:9, 16:10, 19.5:9, 21:9 Ultrawide, 32:9 Super Ultrawide), displays físicos (monitores e TVs) e alternância de fullscreen.
- `src/lib/stores/playerStore.ts`: Store reativa Svelte para controle completo do ciclo de vida da reprodução, volume, modos de enquadramento (`contain`/`cover`), escala, proporção e legendas.
- `src/routes/+layout.svelte`: Contêiner raiz com HUD global flutuante para saída de tela cheia, captura de tecla `Escape` e ancoragem de gavetas e modais.
- `latest.json`: Manifesto oficial de atualização remota do aplicativo com hash e mirror Dropbox verificado.

## Current Implemented Features (v0.2.9)
1. **Recuperação de Senha Completa, Nativa e Híbrida (Axum + In-App):**
   - Rota do Supabase reconfigurada (`site_url` e `uri_allow_list`) para apontar para `http://localhost:41235/reset-password`.
   - Página Web Apple Liquid Glass servida nativamente pelo servidor Axum em Rust com validação de tokens hash e chamada segura a `supabase.auth.updateUser()`.
   - Fluxo in-app em duas etapas no `AuthModal.svelte`, permitindo inserir o código OTP de 6 dígitos recebido por e-mail ou o link completo para trocar de senha sem sair do aplicativo.
2. **Dynamic Island Desktop Nativa (Drag & Drop, Minimizar e System Tray):**
   - Movimentação livre física por arrasto (`appWindow.startDragging()`) por qualquer monitor.
   - Botões integrados para minimizar para a barra de tarefas ou para a bandeja do sistema (System Tray).
3. **Redução de 99.998% de Egress no Supabase (Arquitetura Local-First Estilo Spotify):**
   - Verificação prévia ultraleve via RPC (`get_user_sync_state`) de ~180 bytes. Se nada mudou, zero bytes de biblioteca são baixados.
   - Delta Sync incremental com download estrito de faixas onde `updated_at > last_sync`.
   - Sincronização granular apenas de playlists cujo carimbo de tempo foi alterado.
   - Eliminação de payloads Base64 gigantes na lista de amigos, acabando com timeouts no banco (57014).
4. **Circuit Breaker Automático para Limite de Quotas:**
   - Detecção de erro HTTP 402 ou instabilidade de rede suspendendo chamadas remotas por 15 minutos e operando com fallback suave 100% offline via SQLite.
5. **Estabilidade de Reprodução e Estado Reativo:**
   - Curtidas de faixas sincronizadas bidirecionalmente em todos os componentes sem perda de estado visual.
   - Prevenção de alternância indesejada entre modo vídeo e capa.
   - Legendas dinâmicas com adaptação proporcional às dimensões do player.
   - Fila de reprodução em shuffle aleatório contínua e sem paradas.
6. **Formatos e Presets do Player de Vídeo (`VideoFormatDropdown.svelte`):**
   - Resoluções: Full HD+, 16:10 (1920×1200), 19.5:9 (2400×1080), 21:9 Ultrawide, 32:9 Super Ultrawide, 16:9 Widescreen (1080p, 2K QHD, 4K UHD).
   - Presets de Escala: Compacto (~576px), Monitores 21.5"-24" (~768px), Monitores 27"-32" (~1024px), Monitores 34"-49" (~1200px) e TVs 32"-98"+ (`88vw`).
   - Seletor de Enquadramento (`contain` original vs `cover` zoom imersivo sem letterboxing).
   - Modo Vídeo estritamente desligado por padrão na inicialização do aplicativo (arquitetura *Audio-First* leve com ~30MB RAM).
7. **Motor de Sincronização Contínua A/V & Drift Lock (`NowPlayingView.svelte`):**
   - Handshake `'listening'` com sincronização instantânea com `$currentTime`.
   - Correção contínua automática de defasagem A/V caso exceda 300ms.
   - Bloqueio estrito de reprodução fantasma com áudio pausado.
8. **HUD Global de Saída de Tela Cheia & Tecla Esc (`+layout.svelte`):**
   - Pílula flutuante em Liquid Glass (`z-[100]`) com atalho global `Escape`.
9. **Gestão Avançada de Playlists na Barra Lateral e Biblioteca:**
   - Playlists novas e seguidas posicionadas no topo da lista com suporte a **Fixar Playlist** (`is_pinned`) e **Drag & Drop**.
10. **Central de Notificações em Tempo Real (`NotificationCenter.svelte`):**
    - Sino com badge gradiente coral/dourado reativo, popover Apple Liquid Glass e suporte a alertas em tempo real.
11. **Autostart Nativo no Windows (`commands/mod.rs` & `lib.rs`):**
    - Gerenciamento de `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\Pulsar` via Rust.

## Work-in-Progress & Working Tree Status
- **Status do Git:** Branch `main` sincronizada com `origin/main` (commit `316023b`).
- **Release Build v0.2.9 Oficial:** Binários de produção compilados e verificados no disco em 17/10/2026:
  - `Pulsar_0.2.9_x64-setup.exe` (Instalador NSIS oficial)
  - `Pulsar_0.2.9_x64_en-US.msi` (Pacote Windows Installer oficial)
  - `tauri-app.exe` (Executável nativo standalone otimizado)
- **Canal de Atualização OTA:** `latest.json` configurado com manifesto e espelho de distribuição.

## Current Status & Active Work
- **Status:** Concluído / Em Produção — v0.2.9 Oficial.
- **Versão:** v0.2.9 (Binários oficiais `.exe` e `.msi` gerados e aprovados em testes).
- **Integridade Técnica:** 0 erros e 0 avisos em `cargo test`, `svelte-check` e `cargo check`.
- **Memória & Cortex:** Arquivos sincronizados em `.agent/overview/PROJECT_STATUS.md`, `.agent/CHANGELOG_v0.2.9.md`, `.agent/releases/RELEASE_v0.2.9.md` e `README.md`.

## Known Roadmap & Planned Features (TODOs)
1. **Letras Sincronizadas em Tempo Real:**
   - Integração com API de letras sincronizadas (estilo Karaokê Apple Music com transição suave e destaque por verso).
2. **Equalizador Paramétrico de 10 Bandas:**
   - DSP de áudio integrado ao motor nativo para presets acústicos (Rock, Jazz, Bass Boost, Vocal).
3. **Cache Offline Inteligente:**
   - Sistema de download e armazenamento local protegido para reprodução sem conexão à internet.
4. **Discord Rich Presence Dinâmico:**
   - Exibição de arte do álbum, título da faixa, artista e tempo decorrido no perfil do Discord via IPC nativo.

## Quality, Diagnostics & Verification Standards
- **Auditoria de Código:** Svelte 5 Runes mode rígido (`$state`, `$derived`, `$effect`), Rust com tratamento de erro defensivo sem panics (`Result<T, String>` no IPC Tauri).
- **Design System:** Rigorosa observância aos padrões do `ui_ux.md` com estética espacial Liquid Glass, blur dinâmico, cantos arredondados orgânicos (24px - 28px) e contraste visual certificado.
- **Memória & Cortex:** Sincronização explícita sob demanda dos arquivos em `.agent/overview/`, `.agent/memory/` e `.agent/releases/`.
