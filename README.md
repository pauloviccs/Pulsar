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
    <img src="https://img.shields.io/badge/Tauri-v2%20Rust-66D7D1?style=for-the-badge&logo=tauri&logoColor=09090D" alt="Tauri v2" />
    <img src="https://img.shields.io/badge/UI-Svelte%205%20Runes-DBD56E?style=for-the-badge&logo=svelte&logoColor=09090D" alt="Svelte 5" />
    <img src="https://img.shields.io/badge/Design-Liquid%20Glass-141420?style=for-the-badge&logo=apple&logoColor=white" alt="Liquid Glass" />
  </p>

  <p align="center">
    <a href="#-por-que-o-pulsar">Por que o Pulsar?</a> •
    <a href="#-superpoderes-do-aplicativo">Recursos & Funções</a> •
    <a href="#-onde-baixar">Onde Baixar</a> •
    <a href="#-patch-notes-versão-atual">Patch Notes</a> •
    <a href="#-roadmap">Roadmap</a> •
    <a href="#-tecnologia">Tecnologia</a>
  </p>

</div>

---

## ⚡ Por que o Pulsar?

Se você ama música no computador, provavelmente já passou por isso:

* 😤 **Cansado de assinaturas mensais caras** apenas para ter o direito básico de não ouvir propagandas estridentes a cada duas faixas.
* 🐌 **Cansado de players inchados em Electron/Chromium** que sequestram mais de **1.5 GB da sua memória RAM** só para tocar um MP3 em segundo plano enquanto você tenta jogar ou trabalhar.
* 🧊 **Cansado de interfaces genéricas, chatas e quadradas** que parecem saídas de uma planilha do Excel de 2012.

> [!TIP]
> **O Pulsar resolve isso de uma vez por todas.**
> Forjado sobre a arquitetura ultrarrápida do **Rust (Tauri v2)** e a reatividade cirúrgica do **Svelte 5**, o Pulsar consome uma fração irrisória dos recursos do seu PC, inicia instantaneamente e entrega uma experiência visual inspirada na mais alta engenharia de design de materiais da Apple (**visionOS & iOS Liquid Glass**).

---

## ✨ Superpoderes do Aplicativo

### 🪟 Mini Player Flutuante Apple Liquid Glass (visionOS Experience)
Precisa de foco total no seu trabalho ou jogo sem abrir mão da sua trilha sonora?
* **Translucidez Dinâmica Multicamada:** Superfície de vidro escuro com desfoque profundo (`backdrop-blur-3xl`) que absorve as cores do seu wallpaper e da capa da música.
* **Luz Especular Superior:** Reflexo de luz físico na borda chanfrada superior, reproduzindo a sensação tátil de uma lente de vidro real.
* **Ambient Capa Glow:** A arte do álbum projeta uma aura luminosa e difusa por trás do vidro em tempo real.
* **Grip Tátil iOS & Movimentação 100% Livre:** Arraste o mini player para qualquer canto da sua área de trabalho com fluidez nativa e sem travamentos.
* **Alternância Áudio/Vídeo Compacta:** Alterne entre a capa da faixa e o vídeo oficial em miniatura com um único clique.

---

### 🎛️ Controles Nativos na Barra de Tarefas do Windows
Você não precisa parar o que está fazendo nem minimizar sua tela cheia para trocar de música:
* Ao passar o mouse sobre o ícone do Pulsar na barra de tarefas do Windows, surge uma **miniatura interativa** (estilo Spotify).
* Controle instantâneo com botões nativos: **[Favoritar]**, **[Faixa Anterior]**, **[Play/Pause]** e **[Próxima Faixa]**, desenhados com ícones nítidos em alta definição via API Win32 `ITaskbarList3`.

---

### 🎵 Last.fm Scrobbler Integrado e Inteligente
* Conecte sua conta do **Last.fm** nativamente em segundos.
* O motor do Pulsar rastreia sua reprodução em tempo real com **Now Playing dinâmico** e efetua o **Scrobble automático** ao atingir 50% ou 4 minutos da faixa.
* Algoritmo inteligente de extração que identifica artistas e títulos mesmo em faixas raras do YouTube sem metadados tradicionais.

---

### 📺 Modo Duplo Sincronizado: Som Cristalino ou Clipe Oficial
* Escolha como você quer curtir:
  * **Modo Áudio:** Som de alta fidelidade sem consumo excessivo de dados de rede.
  * **Modo Vídeo 16:9:** O clipe oficial do YouTube roda sincronizado em alta definição sem travamentos, telas pretas ou recarregamentos súbitos ao pausar e avançar.

---

### ⚡ Importação com 1 Clique (Local-First)
* Cole o link de qualquer música avulsa ou de **playlists inteiras do YouTube**.
* O Pulsar importa as faixas em lote, baixa os metadados, enquadra as capas e organiza tudo localmente no seu computador.
* Crie playlists personalizadas, edite nomes, descrições e faça upload da sua própria capa com nosso **Estúdio de Recorte 1:1 com Zoom e Pan interativo**.

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
> Basta acessar a página de lançamentos, baixar o executável `Pulsar_x.x.x_x64-setup.exe`, instalar no seu Windows em menos de 10 segundos e começar a ouvir!

---

## 📝 Patch Notes: O Que Há de Novo

### 🌟 Versão Atual: `v0.1.1` *(Liquid Glass & Taskbar Revolution)*

* 🪟 **Novo Mini Player Apple Liquid Glass:**
  * Redesign total com base nos materiais translúcidos de vidro do visionOS / iOS.
  * Destravamento da janela flutuante no Windows DWM com o novo comando nativo Rust `window.start_dragging()`.
  * Glow difuso adaptativo gerado a partir da paleta da capa do álbum em reprodução.
* 🎛️ **Controles na Barra de Tarefas do Windows (Taskbar Preview):**
  * Integração nativa com a API Win32 `ITaskbarList3` adicionando 4 botões táteis na miniatura do aplicativo na barra de tarefas.
* 🎵 **Correção Definitiva do Last.fm:**
  * Sincronização em tempo real das stores de sessão com o motor de áudio.
  * Esteira de fallback para captura do nome real de artistas em extrações do YouTube e tratamento de durações em streams prematuros.
* 📐 **Blindagem Contra Quebras Verticais:**
  * Modais com contenção rígida de altura (`max-h-[88vh]`), rolagem interna suave e rodapés sempre visíveis.
  * Cabeçalho de playlist e capa de reprodução com redimensionamento fluido para monitores verticais e janelas compactas.

---

## 🗺️ Roadmap de Funcionalidades

| Recurso / Funcionalidade | Status | Categoria |
|---|:---:|---|
| **Streaming & Busca Instantânea sem Anúncios** | ✅ Pronto | Áudio & Core |
| **Mini Player Flutuante Apple Liquid Glass** | ✅ Pronto | Interface & Desktop |
| **Controles na Barra de Tarefas do Windows (Taskbar)** | ✅ Pronto | Integração Windows |
| **Scrobble Automático no Last.fm & Now Playing** | ✅ Pronto | Serviços Conectados |
| **Perfis Sociais com Tags (#) e Status em Tempo Real** | ✅ Pronto | Social & Presença |
| **Importação Rápida de Músicas e Playlists do YouTube** | ✅ Pronto | Biblioteca Local |
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
* **Nuvem & Sincronização:** [Supabase](https://supabase.com/) com canais WebSockets para presença e mensagens em tempo real.
* **Ícones:** [Lucide Icons](https://lucide.dev/) com estilo linear moderno.

---

<div align="center">
  <sub>Criado com paixão por música e código. Distribuído sob a Licença MIT.</sub>
  <br/>
  <sub>© 2026 Pulsar Team • <a href="https://github.com/pauloviccs/Pulsar">github.com/pauloviccs/Pulsar</a></sub>
</div>
