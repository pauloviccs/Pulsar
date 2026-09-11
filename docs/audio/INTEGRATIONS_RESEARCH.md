# Pesquisa Técnica de Integrações de Saída Remota (Pulsar Connect)

> **Documento Oficial de Engenharia — Fase 3 do Pulsar Connect**  
> **Status:** Concluído com Recomendação Registrada  
> **Depende de:** [`docs/audio/CURRENT_STATE.md`](file:///g:/GitHub/Vibecoding/VICCS_Git/VICCS_Pullsar/docs/audio/CURRENT_STATE.md) e [`docs/audio/OUTPUT_ABSTRACTION.md`](file:///g:/GitHub/Vibecoding/VICCS_Git/VICCS_Pullsar/docs/audio/OUTPUT_ABSTRACTION.md)  
> **Escopo:** Dispositivos 100% focados em áudio na rede local (sem TV / sem nuvem externa).

---

## 1. Visão Geral das Três Vias de Integração

O ecossistema de áudio doméstico atual divide-se em três grandes famílias de dispositivos:
1. **Bluetooth (WASAPI Core Audio):** Caixas de som portáteis (JBL, Sony, Bose, Marshall), soundbars pareadas no PC e fones sem fio de alta fidelidade.
2. **UPnP / DLNA (MediaRenderer):** Receivers Hi-Fi de sala (Yamaha MusicCast, Denon/Marantz HEOS, Pioneer), caixas Wi-Fi multiroom (Sonos, Audio Pro), soundbars de rede e mini-systems.
3. **Google Cast Audio (Cast v2):** Caixas inteligentes (Google Nest Mini, Google Nest Audio, Google Home), dongles dedicados (Chromecast Audio 3.5mm/óptico) e soundbars com "Chromecast built-in".

Abaixo detalhamos o funcionamento, complexidade, dependências e limitações de cada tecnologia no ambiente do Pulsar (Windows + Rust + WebView2).

---

## 2. Investigação Detalhada por Protocolo

### 2.1. Bluetooth via WASAPI (Dispositivos Pareados no Windows)

#### Como funciona?
- Quando o usuário pareia uma caixa ou fone Bluetooth no Windows 10/11, o subsistema de áudio do sistema cria um **Endpoint de Renderização WASAPI** (`eRender`).
- Ao contrário do que muitos pensam, o aplicativo **não** precisa alterar o dispositivo de áudio padrão de todo o Windows. O Chromium/WebView2 e a API Web Audio/HTMLMediaElement suportam a API de hardware **`HTMLMediaElement.setSinkId(deviceId)`**.
- No frontend, `navigator.mediaDevices.enumerateDevices()` lista todos os dispositivos `audiooutput` registrados no SO.
- No backend Rust, as APIs `IMMDeviceEnumerator` (`windows::Win32::Media::Audio`) permitem enriquecer essa listagem identificando amigavelmente se o endpoint é Bluetooth, fone USB ou alto-falante integrado.

#### Vantagens:
- **Zero Latência Adicional:** A latência de buffer permanece idêntica à reprodução local (~20ms a 50ms).
- **Sem Dependência de Rede / Firewall:** Não requer abrir portas de rede local nem sofrer bloqueios do Windows Defender Firewall.
- **Estabilidade Máxima:** Usa o pipeline de áudio nativo já homologado do sistema operacional.
- **Volume Nativo:** Controlado diretamente pelo app ou pelo hardware da caixa via AVRCP.

#### Limitações:
- O dispositivo deve ser pareado previamente pelo usuário no painel de configurações do Windows (o Pulsar lista os pareados/conectados, não faz o pareamento RF inicial).

---

### 2.2. UPnP / DLNA (MediaRenderer via SSDP + SOAP)

#### Como funciona?
1. **Descoberta na LAN via SSDP (Simple Service Discovery Protocol):**
   - O Pulsar envia um pacote UDP Multicast em `239.255.255.250:1900`:
     ```http
     M-SEARCH * HTTP/1.1
     HOST: 239.255.255.250:1900
     MAN: "ssdp:discover"
     MX: 3
     ST: urn:schemas-upnp-org:device:MediaRenderer:1
     ```
   - Receivers e caixas de som respondem via unicast com cabeçalho `LOCATION` apontando para o arquivo XML de descrição do dispositivo (ex.: `http://192.168.1.150:8080/description.xml`).
2. **Exposição do Stream pelo Pulsar:**
   - O servidor Axum do Pulsar (que hoje escuta em `127.0.0.1:41235`) passa a escutar em `0.0.0.0:41235`.
   - O Pulsar detecta o IP local da máquina na LAN (ex.: `192.168.1.100`) e gera a URL pública de stream:
     ```text
     http://192.168.1.100:41235/stream/{youtube_video_id}
     ```
3. **Controle de Transporte (SOAP / AVTransport):**
   - **Play:** Requisição HTTP POST para o `controlURL` com a ação `SetAVTransportURI`, passando a URL do Axum e metadados DIDL-Lite (nome da faixa, artista, capa), seguido da ação `Play`.
   - **Pause / Stop:** Ações `Pause` e `Stop`.
   - **Seek:** Ação `Seek` com `Unit="REL_TIME"` e `Target="00:02:15"`.
   - **Volume:** Serviço `RenderingControl:1` -> ação `SetVolume` (0 a 100).
   - **Acompanhamento de Tempo:** Polling periódico (a cada 1s) da ação `GetPositionInfo` para obter `RelTime` e `TrackDuration`.

#### Vantagens:
- **Padrão Aberto e Universal:** Suportado por 90%+ dos receivers residenciais e soundbars com Wi-Fi.
- **Áudio Bit-Perfect (Lossless):** O dispositivo busca o stream original diretamente via HTTP sem compressão bluetooth lossy intermediária.
- **Implementação Leve em Rust:** Não depende de SDKs proprietários; utiliza apenas sockets UDP assíncronos (`tokio::net::UdpSocket`) e requisições HTTP (`reqwest`).

#### Limitações e Desafios:
- **Windows Firewall:** Ao escutar em `0.0.0.0`, o Windows pode exibir o diálogo de permissão de rede local na primeira execução.
- **Latência de Buffer:** Receivers de rede possuem buffers de 500ms a 1500ms para evitar engasgos de Wi-Fi; a resposta ao play/pause não é instantânea como no fone local.

---

### 2.3. Google Cast (Áudio Puro via mDNS + Cast v2)

#### Como funciona?
1. **Descoberta via mDNS:**
   - Envio de query multicast DNS para `224.0.0.251:5353` buscando o serviço `_googlecast._tcp.local`.
   - O registro TXT do mDNS contém `fn` (Friendly Name) e `ca` (Capabilities flag). Se o bit de vídeo não estiver setado ou `md` (Model) for de caixa/áudio, identificamos caixas como Google Nest Mini, Google Nest Audio ou Chromecast Audio.
2. **Conexão e Protocolo Cast v2:**
   - Abre socket TCP TLS na porta `8009` do dispositivo Cast.
   - O handshake TLS exige aceitar certificados auto-assinados emitidos pelo hardware do Google.
   - Mensagens são serializadas em **Protocol Buffers (Protobuf)** via `CastMessage`.
3. **Sessão de Mídia:**
   - O Pulsar conecta ao namespace `urn:x-cast:com.google.cast.receiver` e inicializa a aplicação de mídia padrão (`CC1AD845`).
   - Conecta ao namespace `urn:x-cast:com.google.cast.media` e envia o payload JSON de `LOAD`:
     ```json
     {
       "type": "LOAD",
       "media": {
         "contentId": "http://192.168.1.100:41235/stream/{id}",
         "contentType": "audio/mp4",
         "streamType": "BUFFERED",
         "metadata": {
           "metadataType": 3,
           "title": "Nome da Música",
           "artist": "Nome do Artista"
         }
       },
       "autoplay": true
     }
     ```

#### Vantagens:
- Cobertura excelente para usuários que possuem ecossistema Google Home / Nest.
- Suporte a grupos de caixas de áudio sincronizadas configuradas no app Google Home.

#### Limitações e Riscos Críticos:
- **Complexidade de Protocolo:** Exige implementação de Protobuf binário, túnel TLS customizado e keep-alive por heartbeat (`PING`/`PONG` a cada 5s).
- **Dependências no Rust:** Crates antigas de Cast no crates.io possuem conflitos com versões modernas do Tokio (1.x) e exigem pin de versões legadas de bibliotecas de SSL/Protobuf.
- **Fragilidade:** Atualizações de firmware do Google já quebraram receptores de terceiros não-oficiais no passado.

---

## 3. Matriz Comparativa de Engenharia

| Critério | Bluetooth (WASAPI) | UPnP / DLNA Audio | Google Cast (Audio) |
| :--- | :--- | :--- | :--- |
| **Tipo de Dispositivo Focado** | Fones, caixas JBL, soundbars pareadas | Receivers de Home Theater, caixas Wi-Fi, soundbars | Caixas Google Nest, Chromecast Audio |
| **Descoberta** | Sistema Operacional (Instantânea) | SSDP Multicast na LAN (1-3 seg) | mDNS Multicast na LAN (1-3 seg) |
| **Complexidade de Código** | **Baixa** (`setSinkId` + Windows API) | **Média** (UDP Multicast + SOAP XML) | **Alta** (Protobuf + TLS 8009 + Hearbeat) |
| **Novas Dependências** | Nenhuma (APIs nativas do Chromium / Win32) | Apenas parsing XML leve (já temos `reqwest` e `tokio`) | Protobuf compiler, TLS framing |
| **Impacto no Firewall** | **Zero** (100% interno) | Baixo (Exige bind em `0.0.0.0` para stream) | Médio (Bind em `0.0.0.0` + socket TLS de controle) |
| **Latência Típica** | ~20ms - 50ms | ~500ms - 1500ms | ~800ms - 2000ms |
| **Confiabilidade da Conexão** | Altíssima (Driver do Windows) | Alta (Protocolo HTTP 206 padrão) | Média (Sessões TLS proprietárias expiram) |

---

## 4. Decisão Arquitetural e Ordem de Implementação (Recomendação)

Com base nos princípios de **estabilidade inegociável**, **foco 100% em áudio** e **entrega incremental**, a recomendação de engenharia para o roadmap do **Pulsar Connect** é:

### 🏆 Fase 4.1 — Prioridade 1 (Obrigatório na v1 do Pulsar Connect):
1. **Bluetooth & Dispositivos de Áudio do Sistema (WASAPI Sink):**
   - **Justificativa:** Proporciona gratificação instantânea ao usuário sem introduzir riscos de rede. Permite alternar entre o alto-falante do notebook e uma caixa de som Bluetooth na sala com 1 clique e latência zero.
2. **UPnP / DLNA MediaRenderer:**
   - **Justificativa:** É a espinha dorsal de receivers e aparelhos de som dedicados de alta fidelidade (Yamaha, Denon, Marantz, Sonos). Utiliza HTTP puro suportado pelo nosso proxy Axum sem custos de licenciamento ou SDKs obscuros.

### ⏳ Fase 4.2 — Prioridade 2 (v1.1 ou Extensão Modular):
3. **Google Cast Audio:**
   - **Justificativa:** Deve ser isolado em módulo opcional devido ao peso do protocolo Protobuf e risco de fragilidade de firmware. Focado estritamente em caixas Nest/Mini e Chromecast Audio.

---

## 5. Critério de Conclusão da Fase 3

- [x] Avaliação técnica aprofundada dos três protocolos concluída e documentada em `docs/audio/INTEGRATIONS_RESEARCH.md`.
- [x] Riscos de dependências, latência e compatibilidade com o ecossistema Windows mapeados.
- [x] Decisão da v1 formalizada: **Bluetooth/WASAPI + UPnP/DLNA** selecionados como o núcleo inicial do **Pulsar Connect**.
