# Diretrizes Visuais e UI/UX - Pulsar

## 1. Estética Central: "Liquid Glass" (Glassmorphism de Alto Padrão)

O Pulsar não utiliza interfaces monocromáticas planas ou Material Design genérico. O design deve evocar luxo, fluidez e sofisticação, no estilo Apple Music macOS com toques futuristas.

### Elementos-Chave:
- **Translucidez & Desfoque:** Fundos escuros com `backdrop-blur-xl` ou `backdrop-blur-md`, combinados com `bg-black/40` a `bg-black/60` e bordas finas com brilho sutil (`border border-white/10`).
- **Acento Primário (Pulsar Orange / Coral):** `#FC7753` (`rgb(252, 119, 83)`) para botões de destaque, anéis ativos, badges de tag (#PS7D) e barras de progresso.
- **Acento Secundário (Deep Glass Blue / Dark Background):** `#0a0b10` a `#12131c` para fundos de página e superfícies de elevação.
- **Feedback Háptico Visual:** Micro-animações suaves em `hover` e `active` (`transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`).

## 2. Tipografia e Escala Visual
- **Fonte Principal:** Sans-serif moderna e geométrica (`Inter` ou tipografia nativa do sistema Windows).
- **Tipografia de Tags e Identificadores:** Monospaced (`font-mono`) com `tracking-wider` ou `tracking-widest` para a `#tag` do usuário, garantindo fácil diferenciação de caracteres como `O` e `0`, `I` e `1`.
- **Hierarquia de Texto:**
  - Títulos principais: `font-bold text-white tracking-tight`.
  - Subtítulos e metadados secundários: `text-white/60` ou `text-white/40` com tamanhos `text-xs` a `text-sm`.
  - Estados vazios (Empty States): Ícone desbotado centralizado + mensagem descritiva em tom acolhedor.

## 3. Regras de Layout & Responsividade Universal
- **Header Superior (Top Bar):**
  - Espaço de respiro para a pílula de perfil `TopProfileButton`, campo de busca autoexpansível e botão de adicionar link.
  - Em telas estreitas (< 768px), o menu hamburger surge à esquerda para revelar a gaveta lateral.
- **Sidebar (Lateral):**
  - Desobstruída: topo com o logo vetorial do Pulsar, itens de navegação principal, e lista de playlists ocupando todo o espaço vertical restante com rolagem livre (`flex-1 overflow-y-auto`).
  - Nunca colocar cards pesados que colidam com a barra de reprodução inferior.
- **Barra de Reprodução (BottomPlayerBar):**
  - Fixa na parte inferior com desfoque de fundo profundo (`backdrop-blur-2xl bg-black/80`).
  - Defensiva em viewports pequenos: oculta controles de volume expansivos para proteger os botões essenciais (play/pause/skip) e o scrubber de progresso.

## 4. Acessibilidade & Grandma Test
- **Alvos de Toque / Clique:** Mínimo de 36px x 36px para qualquer botão interativo.
- **Contraste de Cores:** Textos principais sempre em branco puro ou com opacidade mínima de 80% sobre fundos escuros.
- **Ações Destrutivas:** Modais de confirmação claros com botões de perigo vermelhos bem destacados (ex: botão de logout ou excluir playlist).
