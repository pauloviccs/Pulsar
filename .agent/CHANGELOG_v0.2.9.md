# Pulsar v0.2.9 — Release Changelog

## 🚀 Novidades e Correções da Versão 0.2.9

### 🔑 Recuperação de Senha Segura (Nativa & In-App)
- **Correção da Rota do Supabase:** Eliminado o redirecionamento que caía na porta morta `http://localhost:3000`. O Supabase agora aponta para o microservidor local nativo do Pulsar na porta `41235` (`http://localhost:41235/reset-password`).
- **Página de Redefinição Web Apple Liquid Glass:** Servida diretamente pelo servidor Axum em Rust integrado ao Pulsar. Ao abrir o link do e-mail no navegador, o usuário vê uma tela elegante, insere a nova senha e ela é gravada diretamente no banco de dados via `supabase.auth.updateUser()`.
- **Fluxo Híbrido In-App no Modal de Autenticação:** No próprio app, o usuário agora pode solicitar a recuperação e, na mesma tela, inserir o código OTP de 6 dígitos recebido por e-mail (ou colar o link completo) e criar a nova senha sem sair do Pulsar.
- **Tratamento de Exceções:** Mensagens amigáveis para rate limits (429) e tokens expirados.

---

### 🏝️ Dynamic Island Desktop Nativa
- **Arrastar Livremente (Drag & Drop):** Agora é possível clicar e arrastar a Dynamic Island para qualquer canto da tela ou outros monitores utilizando a API nativa de arrasto do Tauri.
- **Minimizar para Barra de Tarefas:** Botão de controle para minimizar a janela rapidamente.
- **Minimizar para a Bandeja do Sistema (System Tray):** Opção para recolher a Dynamic Island para a área de notificação do Windows, mantendo a música rodando em segundo plano.

---

### ⚡ Redução de 99.998% de Egress no Supabase (Arquitetura Local-First Estilo Spotify)
- **RPC `get_user_sync_state` (Check-Before-Fetch):** Antes de buscar músicas ou playlists, o app envia uma consulta de ~180 bytes. Se os carimbos `MAX(updated_at)` não mudaram, nenhuma faixa é baixada e o cache local SQLite é mantido intacto.
- **Delta Sync Incremental:** Baixa apenas as faixas adicionadas recentemente (`updated_at > last_sync`).
- **Sincronização Granular de Playlists:** Apenas playlists alteradas têm seus dados atualizados.
- **Eliminação de Megalodons Base64:** Remoção do tráfego desnecessário de imagens em base64 de até 850 KB na lista de amigos, acabando com os timeouts (57014) no Postgres.

---

### 🛑 Circuit Breaker & Resiliência Offline
- **Detecção de Cotas (HTTP 402):** Se a cota de nuvem for atingida ou a internet cair, o Pulsar entra em modo offline seguro por 15 minutos sem travar o aplicativo.
- **Modo Convidado / Offline Funcional:** Todas as faixas salvas no SQLite continuam tocando normalmente mesmo sem internet.

---

### 🎵 Melhorias no Player e Interface
- **Curtidas Reativas:** O botão de curtir faixas agora mantém o estado sincronizado em todos os modais, gavetas de fila e listas da biblioteca.
- **Modo Vídeo Estável:** Corrigido o comportamento que fazia o player alternar involuntariamente entre capa e vídeo.
- **Legendas Dinâmicas:** Ajuste visual das legendas integrado às proporções de tela do player.
- **Shuffle Fluido:** O modo aleatório agora avança continuamente sem travamentos ou paradas entre faixas.

---

### 📦 Binários Oficiais Compilados
- `Pulsar_0.2.9_x64-setup.exe` (Instalador NSIS oficial)
- `Pulsar_0.2.9_x64_en-US.msi` (Pacote Windows Installer)
