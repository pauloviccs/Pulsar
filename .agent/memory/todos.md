# Todos & Backlog

## Tarefas Concluídas
- [x] **Rebranding Visual Completo:**
  - [x] Normalizar e gerar matriz de ícones Tauri a partir de `.agent/assets/svg/PulsarLogo_Icon.svg`.
  - [x] Atualizar ícones do executável Windows (`icon.ico`), instalador NSIS, barra de tarefas e tray icon.
  - [x] Gerar e atualizar `static/favicon.png` e `static/pulsar-logo.svg`.
- [x] **TopProfileButton & Header Profile:**
  - [x] Criar componente `TopProfileButton.svelte` com estética Liquid Glass.
  - [x] Exibir Avatar, nome de usuário, `@username` e a `#tag` alfanumérica em destaque.
  - [x] Menu popover interativo com seletor de presença, cópia rápida da tag e atalhos rápidos.
  - [x] Botão de "Sair / Logout" estilizado em vermelho e localizado.
- [x] **Desobstrução da Sidebar:**
  - [x] Remover card de usuário do rodapé da Sidebar.
  - [x] Configurar a lista de playlists com rolagem infinita livre (`flex-1 overflow-y-auto`).
- [x] **Responsividade Universal:**
  - [x] Implementar drawer lateral deslizante em telas mobile (< 768px) acionado por botão hamburger.
  - [x] Ajustar campo de busca e barra superior para fluidez em larguras compactas.
  - [x] Otimizar `BottomPlayerBar.svelte` para telas estreitas, ocultando sliders secundários.
  - [x] Adaptar grades de playlists (`PlaylistGrid.svelte`) de 1 a 6 colunas.
- [x] **Integração Last.fm 2.0:**
  - [x] Embutir credenciais oficiais da aplicação `VICCS_PulsarPlayer`.
  - [x] Integrar `@tauri-apps/plugin-opener` para disparar o navegador padrão do sistema no fluxo OAuth.
  - [x] Adicionar botões de fallback ("Abrir no Navegador" e "Copiar Link") e painel retrátil de chaves de API.
- [x] **Internacionalização (i18n):**
  - [x] Traduzir todos os modais (edição de perfil, exclusão de playlist, edição de playlist, etc.) nos 6 idiomas suportados (`pt-BR`, `en`, `es`, `zh-CN`, `ja`, `ko`).
  - [x] Formatação nativa de datas dinâmicas e contadores de faixas.
- [x] **Antibot / Captcha no Cadastro:**
  - [x] Componente `PulsarCaptcha.svelte` com desafio interativo integrado no modal de autenticação.
- [x] **Validação & Checagem:**
  - [x] `npm run check` com 0 erros e 0 warnings.
  - [x] `npm run build` gerando bundle estático com sucesso.

## Tarefas Pendentes
- [ ] **Geração do Executável Instalador (`.exe` NSIS):**
  - [ ] Executar `npx tauri build --bundles nsis` (Aguardando ordem explícita do usuário).
  - [ ] Validar integridade do instalador gerado em `src-tauri/target/release/bundle/nsis/`.
- [ ] **Testes em Ambiente Windows:**
  - [ ] Testar instalação do executável, minimização para a bandeja ao fechar e single instance.
  - [ ] Testar fluxo de autorização Last.fm no executável final.
