<div align="center">

  <img src="assets/pulsar-logo.png" width="180" alt="Pulsar Logo" style="border-radius: 36px; box-shadow: 0 20px 50px rgba(252, 119, 83, 0.3);" />

  # Pulsar
  ### *A Nova Dimensão do Streaming de Música no Seu Desktop.*

  <p align="center">
    <strong>Ultra-leve. Sem anúncios. Estética Apple Liquid Glass forjada em Rust e Svelte 5.</strong>
  </p>

  <p align="center">
    <a href="https://github.com/pauloviccs/Pulsar/releases">
      <img src="https://img.shields.io/badge/Download-Último%20Release%20.exe-FC7753?style=for-the-badge&logo=windows&logoColor=white" alt="Download Windows" />
    </a>
    <img src="https://img.shields.io/badge/Spotify-Web%20API-1DB954?style=for-the-badge&logo=spotify&logoColor=white" alt="Spotify Web API" />
    <img src="https://img.shields.io/badge/YouTube-Music%20Engine-FF0000?style=for-the-badge&logo=youtubemusic&logoColor=white" alt="YouTube Music" />
    <img src="https://img.shields.io/badge/Tauri-v2%20Rust-66D7D1?style=for-the-badge&logo=tauri&logoColor=09090D" alt="Tauri v2" />
    <img src="https://img.shields.io/badge/UI-Svelte%205%20Runes-DBD56E?style=for-the-badge&logo=svelte&logoColor=09090D" alt="Svelte 5" />
    <img src="https://img.shields.io/badge/Design-Liquid%20Glass-141420?style=for-the-badge&logo=apple&logoColor=white" alt="Liquid Glass" />
  </p>

  <p align="center">
    <a href="#-por-que-o-pulsar">Por que o Pulsar?</a> •
    <a href="#-superpoderes-do-aplicativo">Recursos & Funções</a> •
    <a href="#-onde-baixar">Onde Baixar</a> •
    <a href="#-patch-notes-o-que-há-de-novo">Patch Notes</a> •
    <a href="#-roadmap-de-funcionalidades">Roadmap</a> •
    <a href="#-tecnologia-de-ponta">Tecnologia</a>
  </p>

</div>

---

## ⚡ Por que o Pulsar?

Se você ama música no computador, provavelmente já passou por isso:

* 😤 **Cansado de assinaturas mensais caras** apenas para ter o direito básico de não ouvir propagandas estridentes a cada duas faixas.
* 🐌 **Cansado de players inchados em Electron/Chromium** que sequestram mais de **1.5 GB da sua memória RAM** só para tocar um áudio em segundo plano enquanto você tenta jogar ou trabalhar.
* 🧊 **Cansado de interfaces genéricas, chatas e opacas** que parecem saídas de uma planilha do Excel de 2012.

> [!TIP]
> **O Pulsar resolve isso de uma vez por todas.**
> Forjado sobre a arquitetura ultrarrápida do **Rust (Tauri v2)** e a reatividade cirúrgica do **Svelte 5**, o Pulsar consome uma fração irrisória dos recursos do seu PC (~30MB em background), inicia instantaneamente e entrega uma experiência visual inspirada na mais alta engenharia de design de materiais da Apple (**visionOS & iOS Liquid Glass**).

---

## ✨ Superpoderes do Aplicativo

### 🟢 Importação Universal: Spotify, YouTube & YouTube Music
Migre sua biblioteca em segundos sem perder nenhuma das suas faixas favoritas:
* **Suporte Completo a Links:** Cole links diretos de faixas avulsas, álbuns e **playlists inteiras** do Spotify (`open.spotify.com`), YouTube padrão e YouTube Music (`music.youtube.com`).
* **Casamento Acústico Inteligente por Duração:** O motor em Rust se conecta à API oficial do Spotify para extrair os metadados ricos (capas em HD, multi-artistas, ISRC e duração exata em milissegundos). Em seguida, busca o áudio correspondente no YouTube via `yt-dlp` e calcula um índice de confiança acústica (`HIGH`, `MEDIUM`, `LOW`), garantindo a reprodução exata da versão correta da faixa sem anúncios.
* **Botões Rápidos Temáticos:** Identificação visual imediata tanto na barra lateral quanto no topo da tela inicial:
  * 🔴 **Botão Coral (`#FC7753`):** Importação rápida do YouTube & YouTube Music.
  * 🟢 **Botão Verde Oficial (`#1DB954`):** Importação rápida do Spotify.
* **Inline Setup Card de Credenciais:** Se você colar um link do Spotify sem credenciais cadastradas, o modal exibe um assistente amigável com link direto para o dashboard de desenvolvedores do Spotify, salvamento no banco local SQLite e retentativa automática com um clique.

---

### 🪟 Mini Player Flutuante Apple Liquid Glass (visionOS Experience)
Precisa de foco total no seu trabalho ou jogo sem abrir mão da sua trilha sonora?
* **Translucidez Dinâmica Multicamada:** Superfície de vidro escuro com desfoque profundo (`backdrop-blur-3xl`) que absorve as cores do seu wallpaper e da capa da música.
* **Luz Especular Superior:** Reflexo de luz físico na borda chanfrada superior, reproduzindo a sensação tátil de uma lente de vidro real.
* **Ambient Capa Glow:** A arte do álbum projeta uma aura luminosa e difusa por trás do vidro em tempo real.
* **Grip Tátil iOS & Movimentação 100% Livre:** Arraste o mini player para qualquer canto da sua área de trabalho com fluidez nativa e sem travamentos no DWM do Windows.
* **Alternância Áudio/Vídeo Compacta:** Alterne entre a capa da faixa e o clipe oficial em miniatura com um único clique.

---

### 🎛️ Controles Nativos na Barra de Tarefas do Windows
Você não precisa parar o que está fazendo nem minimizar sua tela cheia para trocar de música:
* Ao passar o mouse sobre o ícone do Pulsar na barra de tarefas do Windows, surge uma **miniatura interativa** (estilo Spotify).
* Controle instantâneo com botões nativos: **[Favoritar]**, **[Faixa Anterior]**, **[Play/Pause]** e **[Próxima Faixa]**, desenhados com ícones nítidos em alta definição via API Win32 `ITaskbarList3`.

---

### 🎵 Last.fm Scrobbler Integrado e Inteligente
* Conecte sua conta do **Last.fm** nativamente em segundos com fluxo OAuth no navegador padrão via `@tauri-apps/plugin-opener`.
* O motor do Pulsar rastreia sua reprodução em tempo real com **Now Playing dinâmico** e efetua o **Scrobble automático** ao atingir 50% ou 4 minutos da faixa.
* Algoritmo inteligente de extração com fallback em cascata que identifica artistas e títulos mesmo em faixas raras sem metadados convencionais.

---

### 📺 Modo Duplo Sincronizado: Som Cristalino ou Clipe Oficial
* Escolha como você quer curtir:
  * **Modo Áudio:** Som de alta fidelidade via proxy local Axum (41235) com suporte a HTTP 206 Range (seeking instantâneo) e sem desperdício de dados.
  * **Modo Vídeo 16:9:** O clipe oficial roda sincronizado em alta definição sem travamentos, telas pretas ou recarregamentos súbitos ao pausar e avançar.

---

### 👥 Pulsar Social & Presença em Tempo Real
A música fica muito melhor compartilhada:
* **Perfis com TAG Única:** Crie seu perfil e receba uma tag alfanumérica exclusiva (ex: `@seu_nome#7X9A`).
* **Status "Ouvindo Agora":** Seus amigos sabem exatamente o que está tocando no seu player em tempo real.
* **Direct Chat Estilo iMessage:** Converse instantaneamente e compartilhe músicas que seus amigos podem dar Play direto da conversa.
* **Modo Convidado Offline:** Quer usar o app apenas localmente sem criar conta? Com um clique você entra no modo offline e sua biblioteca fica 100% no seu disco.

---

### 📱 Blindagem Total para Monitores Pivotados e Telas Verticais
* Usa um segundo monitor na vertical (9:16) para programar, codar ou ler chats?
* O Pulsar conta com uma malha de layout responsiva onde **nenhum modal vaza**, nenhum botão de confirmação fica escondido e as capas se ajustam harmonicamente à altura da sua janela.

---

## 🚀 Onde Baixar?

Você não precisa compilar nem lidar com código para aproveitar o Pulsar.

> [!IMPORTANT]
> **Toda nova versão oficial do instalador (.exe) é publicada diretamente na aba de [Releases do GitHub](https://github.com/pauloviccs/Pulsar/releases).**
>
> Basta acessar a página de lançamentos, baixar o executável `Pulsar_0.1.0_x64-setup.exe`, instalar no seu Windows em menos de 10 segundos e começar a ouvir!

---

## 📝 Patch Notes: O Que Há de Novo

### 🌟 Versão Atual: `v0.1.2` *(Multi-Platform Import & Acoustic Matching)*

* 🟢 **Importação Universal Spotify & YouTube Music:**
  * Suporte a links de faixas, playlists e álbuns do Spotify (`open.spotify.com`) e YouTube Music (`music.youtube.com`).
  * Motor Rust com integração oficial à Spotify Web API (Client Credentials Flow com cache inteligente de token).
  * Algoritmo de correspondência acústica por duração (casamento de metadados do Spotify com extração de áudio via `yt-dlp`).
* 🎨 **Botões Rápidos com Cores Temáticas Dedicadas:**
  * Botão **Coral** para YouTube e botão **Verde Oficial** para Spotify na Sidebar e no Header superior, proporcionando acesso rápido contextual.
* ⚙️ **Gerenciador de Credenciais Spotify Web API:**
  * Configuração nas preferências (`Configurações > Integrações`) e *Inline Setup Card* no próprio modal de importação com retentativa automática.
* 📋 **Ergonomia & Correção de Input:**
  * Botão de colar desacoplado em cápsula flex lateral externa, eliminando cortes de texto em URLs longas.
* 📦 **Novo Instalador Windows (NSIS Release):**
  * Executável e instalador compilados com otimizações de produção: `Pulsar_0.1.0_x64-setup.exe` (21.2 MB).

---

### `v0.1.1` *(Liquid Glass & Taskbar Revolution)*

* 🪟 **Novo Mini Player Apple Liquid Glass:** Redesign total visionOS, destravamento no DWM e ambient glow adaptativo.
* 🎛️ **Controles na Barra de Tarefas do Windows (Taskbar Preview):** Miniatura com 4 botões nativos via Win32 `ITaskbarList3`.
* 🎵 **Correção Definitiva do Last.fm:** Sincronização em tempo real das stores com o motor de áudio e fallback inteligente de artista.
* 📐 **Blindagem Contra Quebras Verticais:** Modais com teto de altura rígido (`max-h-[88vh]`) e cabeçalho elástico.

---

## 🗺️ Roadmap de Funcionalidades

| Recurso / Funcionalidade | Status | Categoria |
|---|:---:|---|
| **Streaming & Busca Instantânea sem Anúncios** | ✅ Pronto | Áudio & Core |
| **Importação Rápida Spotify, YouTube & YT Music** | ✅ Pronto | Biblioteca & Importação |
| **Casamento Acústico por Duração & Metadados** | ✅ Pronto | Engine de Áudio |
| **Mini Player Flutuante Apple Liquid Glass** | ✅ Pronto | Interface & Desktop |
| **Controles na Barra de Tarefas do Windows (Taskbar)** | ✅ Pronto | Integração Windows |
| **Scrobble Automático no Last.fm & Now Playing** | ✅ Pronto | Serviços Conectados |
| **Perfis Sociais com Tags (#) e Status em Tempo Real** | ✅ Pronto | Social & Presença |
| **Estúdio de Recorte 1:1 de Capas de Playlist** | ✅ Pronto | Personalização |
| **Suporte Nativo a Monitores Verticais / Telas Retrato** | ✅ Pronto | UI / Responsividade |
| **Equalizador Paramétrico de 10 Bandas com Presets** | ⏳ Em Breve | Qualidade de Som |
| **Letras Sincronizadas em Tempo Real (Estilo Karaokê)** | ⏳ Em Breve | Experiência Visual |
| **Cache Inteligente para Modo 100% Offline** | ⏳ Planejado | Performance |
| **Discord Rich Presence Dinâmico e Detalhado** | ⏳ Planejado | Integrações |
| **Seletor de Temas Personalizados Liquid Glass (OLED, Frost, Neon)** | ⏳ Planejado | Customização |

---

## 🛠️ Tecnologia de Ponta

O Pulsar foi projetado para quem valoriza arquitetura limpa e performance pura:

* **Engine Desktop:** [Tauri v2](https://tauri.app/) (Rust 2021) — binário compilado nativo, seguro e incrivelmente leve.
* **Camada de Interface:** [Svelte 5](https://svelte.dev/) com Runas reativas (`$state`, `$derived`, `$effect`).
* **Design & Estilo:** [Tailwind CSS v4](https://tailwindcss.com/) com paleta calibrada Liquid Glass.
* **APIs de Dados:** [Spotify Web API](https://developer.spotify.com/documentation/web-api) (Client Credentials) e extração de streaming via [yt-dlp](https://github.com/yt-dlp/yt-dlp).
* **Nuvem & Sincronização:** [Supabase](https://supabase.com/) com canais WebSockets para presença e mensagens em tempo real.
* **Ícones:** [Lucide Icons](https://lucide.dev/) com estilo linear moderno.

---

<div align="center">
  <sub>Criado com paixão por música e código. Distribuído sob a Licença MIT.</sub>
  <br/>
  <sub>© 2026 Pulsar Team • <a href="https://github.com/pauloviccs/Pulsar">github.com/pauloviccs/Pulsar</a></sub>
</div>
