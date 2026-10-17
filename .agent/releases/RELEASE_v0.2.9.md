<div align="center">

# 🪐 Pulsar • Release Notes
### *Arquitetura Local-First, Recuperação de Senha Segura, Dynamic Island Desktop & Otimização de Egress Estilo Spotify: v0.2.9*

[![Versão v0.2.9](https://img.shields.io/badge/Versão%20Oficial-v0.2.9-EF7D4B?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/pauloviccs/Pulsar/releases)
[![Estética](https://img.shields.io/badge/Design%20System-Apple%20Liquid%20Glass-0B1020?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/pauloviccs/Pulsar)
[![Tauri v2](https://img.shields.io/badge/Engine-Rust%20%7C%20Tauri%20v2-3093AA?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app)
[![Svelte 5](https://img.shields.io/badge/Frontend-Svelte%205%20Runes-F3B044?style=for-the-badge&logo=svelte&logoColor=09090D)](https://svelte.dev)
[![Supabase](https://img.shields.io/badge/Nuvem-Supabase%20Cloud%20Sync-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)

<p align="center">
  <strong>Streaming ultraleve desktop para Windows 10/11, sem anúncios, com arquitetura Local-First inteligente, recuperação de senhas nativa e in-app, Dynamic Island com movimentação livre e minimização para bandeja, e redução de 99.998% de consumo de tráfego de nuvem.</strong>
</p>

</div>

---

## 🧭 Sumário da Versão 0.2.9

* [🌟 Destaques Centrais da Versão v0.2.9](#-destaques-centrais-da-versão-v029)
  * [1. Recuperação de Senha Completa, Nativa e In-App](#1-recuperação-de-senha-completa-nativa-e-in-app)
  * [2. Dynamic Island Desktop Nativa (Drag & Drop, Minimizar e System Tray)](#2-dynamic-island-desktop-nativa-drag--drop-minimizar-e-system-tray)
  * [3. Redução Maciça de 99.998% de Egress no Supabase (Arquitetura Local-First)](#3-redução-maciça-de-99998-de-egress-no-supabase-arquitetura-local-first)
  * [4. Circuit Breaker Automático e Operação Offline Resiliente](#4-circuit-breaker-automático-e-operação-offline-resiliente)
  * [5. Sincronização e Consistência Reativa de Curtidas](#5-sincronização-e-consistência-reativa-de-curtidas)
  * [6. Player de Vídeo Estabilizado, Anti-Oscilação e Legendas Dinâmicas](#6-player-de-vídeo-estabilizado-anti-oscilação-e-legendas-dinâmicas)
  * [7. Fila de Reprodução e Modo Shuffle Anti-Travamento](#7-fila-de-reprodução-e-modo-shuffle-anti-travamento)
  * [8. Blindagem Anti-Vazamento e Segurança de Tokens Git](#8-blindagem-anti-vazamento-e-segurança-de-tokens-git)
* [📦 Artefatos Oficiais de Instalação](#-artefatos-oficiais-de-instalação)

---

# 🌟 Destaques Centrais da Versão v0.2.9

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     PULSAR v0.2.9 CHANGELOG                                      │
├───────────────────┬──────────────────────────────────────────────────────────────────────────────┤
│ 1. PASSWORD RESET │ Servidor Axum nativo (/reset-password) + fluxo in-app com OTP de 6 dígitos   │
│ 2. DYNAMIC ISLAND │ Drag & Drop físico pelo desktop, botão minimizar e saída para a System Tray  │
│ 3. EGRESS CRUSH   │ Redução de 99.998% de banda: Check-Before-Fetch RPC e Delta Sync incremental │
│ 4. CIRCUIT BREAKER│ Proteção automática contra estouro de cotas (402) com fallback 100% offline  │
│ 5. REACTIVE LIKES │ Sincronização bidirecional de favoritos entre modais e gavetas sem perder cor│
│ 6. VIDEO & SUBS   │ Correção de alternância indesejada de capa/vídeo e suporte a legendas de vídeo│
│ 7. SHUFFLE FLOW   │ Fila aleatória fluida com resolução de travas e reprodução ininterrupta      │
└───────────────────┴──────────────────────────────────────────────────────────────────────────────┘
```

---

### 1. Recuperação de Senha Completa, Nativa e In-App
* **Fim do Erro `localhost:3000`:** O Supabase vinha configurado de fábrica para redirecionar e-mails de recuperação para a porta 3000 (onde não havia nenhum serviço rodando). Atualizamos o `site_url` e o `uri_allow_list` do Supabase para apontar para a porta do microservidor local nativo do Pulsar: `http://localhost:41235/reset-password`.
* **Página de Redefinição Web Apple Liquid Glass:** Quando o usuário clica no link do e-mail em seu navegador padrão, o servidor Axum em Rust embarcado no Pulsar responde instantaneamente com uma interface de redefinição de senha com estética visionOS, lê o `#access_token` ou `token_hash`, valida a nova senha e atualiza no banco com `supabase.auth.updateUser()`.
* **Fluxo Híbrido In-App no `AuthModal.svelte`:**
  * **Etapa 1:** O usuário informa o e-mail cadastrado e clica em "Enviar Link de Recuperação".
  * **Etapa 2:** Se o usuário preferir não usar o navegador, ele pode colar o link recebido ou digitar o código de verificação OTP de 6 dígitos diretamente dentro do próprio app, definindo sua nova senha sem trocar de janela.
* **Resiliência e Tratamento de Erros:** Suporte visual para rate limits (429) do Supabase e avisos em caso de links expirados.

---

### 2. Dynamic Island Desktop Nativa (Drag & Drop, Minimizar e System Tray)
* **Drag and Drop Livre no Monitor:** O usuário agora pode clicar e arrastar a Dynamic Island para qualquer coordenada do desktop ou múltiplos monitores utilizando a chamada nativa `appWindow.startDragging()`.
* **Minimizar Suave:** Botão dedicado para minimizar a Dynamic Island para a barra de tarefas do Windows.
* **Minimizar para Tray (Área de Notificação):** Botão para ocultar a janela diretamente na bandeja do sistema, mantendo a música tocando em segundo plano de forma ultraleve (~30MB RAM).

---

### 3. Redução Maciça de 99.998% de Egress no Supabase (Arquitetura Local-First)
* **Check-Before-Fetch (`get_user_sync_state`):** Antes de baixar qualquer dado de playlists ou faixas, o cliente executa uma consulta RPC minúscula (~180 bytes) que retorna apenas as contagens e os carimbos `MAX(updated_at)`. Se o banco local SQLite estiver sincronizado, **zero bytes de biblioteca são baixados**.
* **Delta Sync Incremental:** Ao adicionar novas músicas, apenas os registros com `updated_at > last_sync` são transferidos, abandonando o modelo anterior de baixar milhares de registros repetidamente.
* **Sincronização Granular de Playlists:** Faixas de playlists só são baixadas para a playlist cujo carimbo `updated_at` sofreu modificação real.
* **Eliminação de Megalodons Base64 & Timeout 57014:** Os avatares de até 850 KB deixaram de ser baixados em lote no carregamento social, utilizando projeção explícita de colunas e eliminando os timeouts de queries no Postgres.

---

### 4. Circuit Breaker Automático e Operação Offline Resiliente
* **Detecção Inteligente de Falhas:** Caso o Supabase retorne HTTP 402 (quota esgotada) ou ocorra queda de conexão com a internet, o circuito do Pulsar se abre e suspende requisições remotas por 15 minutos.
* **Modo Convidado e Offline 100% Funcional:** Todas as faixas salvas, playlists locais e histórico continuam acessíveis instantaneamente através do cache SQLite local no computador do usuário.

---

### 5. Sincronização e Consistência Reativa de Curtidas
* **Persistência de Estado Visual:** Ao curtir ou descurtir uma faixa em qualquer modal, gaveta de fila (`QueueDrawer`) ou lista da biblioteca, o estado do ícone de coração (`is_favorite`) permanece sincronizado em todos os componentes sem desincronia de interface.
* **Fix de Integridade no SQLite:** Inserção defensiva prévia das faixas locais com `duration_seconds: 0`, eliminando erros de chave estrangeira (`FOREIGN KEY constraint failed`) no banco SQLite.

---

### 6. Player de Vídeo Estabilizado, Anti-Oscilação e Legendas Dinâmicas
* **Fim da Oscilação Vídeo/Capa:** O player não sai mais sozinho do modo de vídeo para a capa durante a reprodução.
* **Legendas Dinâmicas:** Suporte e ajuste responsivo das legendas de acordo com a proporção da tela e dimensões do player de vídeo.

---

### 7. Fila de Reprodução e Modo Shuffle Anti-Travamento
* **Shuffle Contínuo:** O algoritmo de ordenação aleatória foi aprimorado para evitar travamentos ou encerramento prematuro da reprodução entre faixas com pré-carregamento contínuo.

---

### 8. Blindagem Anti-Vazamento e Segurança de Tokens Git
* **Proteção do Histórico:** Todos os scripts de teste e chaves estáticas foram desacoplados. A injeção de credenciais públicas na página de redefinição de senha é feita em tempo de execução pelo backend Axum a partir do arquivo `.env` ou variáveis do sistema, em total conformidade com as diretrizes do **GitHub Push Protection**.

---

## 📦 Artefatos Oficiais de Instalação

Os instaladores oficiais da versão `0.2.9` foram compilados com perfil release otimizado em Rust e empacotados para distribuição:

| Pacote | Arquivo | Descrição |
|---|---|---|
| **Instalador NSIS (.exe)** | `Pulsar_0.2.9_x64-setup.exe` | Instalador padrão para Windows 10/11 x64 com atalhos e assistente |
| **Instalador MSI (.msi)** | `Pulsar_0.2.9_x64_en-US.msi` | Pacote corporativo Windows Installer para implantação automatizada |

---

<div align="center">
  <sub>Desenvolvido com excelência técnica por <strong>Lumia</strong> e <strong>VICCS</strong>. Forjado em Rust & Svelte 5.</sub>
</div>
