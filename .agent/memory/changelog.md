# Changelog

Registro cronológico e factual de todas as mudanças, melhorias e correções implementadas no Pulsar.

## [2026-09-10] - Rebranding, Responsividade Universal, TopProfileButton, Last.fm Opener & i18n

### Adicionado
- **Novo Componente TopProfileButton (`src/lib/components/TopProfileButton.svelte`):**
  - Card de identificação de usuário movido para o cabeçalho superior (Top Header), com avatar, nome legível, `@username` e badge em destaque para a `#tag` alfanumérica.
  - Anel de presença dinâmico (online, ausente, ocupado, invisível).
  - Menu popover interativo com seletor de status, cópia da tag em 1 clique, atalhos para perfil, amigos e configurações, e botão vermelho de logout.
- **Responsividade Universal:**
  - Drawer deslizante no mobile (< 768px) com controle via botão hamburger e backdrop blur com clique para fechar.
  - Layout adaptativo na barra de reprodução (`BottomPlayerBar.svelte`), protegendo os botões de playback e scrubber em telas pequenas.
  - Suporte responsivo na grade de playlists (`PlaylistGrid.svelte`) de 1 a 6 colunas.
- **Integração Last.fm com Plugin Opener:**
  - Suporte nativo à abertura do navegador padrão via `@tauri-apps/plugin-opener`.
  - Credenciais oficiais da aplicação `VICCS_PulsarPlayer` configuradas como padrão.
  - Botões de fallback para abertura direta e cópia de link, com painel para inserção de chave customizada de API.
- **Antibot no Cadastro (`PulsarCaptcha.svelte`):**
  - Desafio antibot interativo para prevenção de contas automatizadas no cadastro com Supabase.
- **Identidade Visual e Assets SVG:**
  - Matriz de ícones Tauri regenerada a partir de `PulsarLogo_Icon.svg`.
  - Atualização do ícone `.ico` do instalador NSIS e executável Windows.
  - `static/favicon.png` e `static/pulsar-logo.svg` atualizados.

### Modificado
- **Sidebar (`src/lib/components/Sidebar.svelte`):**
  - Rodapé de usuário removido da lateral para evitar esmagamento visual e cortes.
  - Lista de playlists atualizada com `flex-1 overflow-y-auto` para rolagem infinita livre.
- **Internacionalização (i18n):**
  - 100% dos textos dos modais de edição de perfil, edição de playlist, confirmação de exclusão e configurações traduzidos nos 6 idiomas suportados (`pt-BR`, `en`, `es`, `zh-CN`, `ja`, `ko`).
  - Datas e contadores formatados de maneira reativa e localizada.
- **Layout Principal (`src/routes/+page.svelte`):**
  - Integração do novo botão de perfil no header e controle do drawer lateral mobile.

### Corrigido
- **Corte do Card de Perfil:** O perfil do usuário não é mais obstruído pelas playlists ou pela barra de reprodução.
- **Falha de Abertura do Last.fm:** O navegador agora abre confiavelmente em qualquer versão do Windows via plugin nativo do Tauri v2.

---

## [2026-09-09] - Arquitetura Inicial, Proxy Axum e SQLite

### Adicionado
- Servidor proxy local Axum na porta 41235 em Rust para streaming HTTP 206 Range de áudio extraído via `yt-dlp`.
- Banco de dados SQLite local em modo WAL (`pulsar.db`) gerenciado via rusqlite com migrações automáticas.
- Camada de autenticação, perfis e presença via Supabase.
- Fila de reprodução, crossfade e normalização de volume no `playerStore.ts`.
- Single Instance plugin para evitar múltiplas instâncias concorrentes no Windows.
- Minimizar para bandeja do sistema (tray) ao fechar com persistência de preferência.
