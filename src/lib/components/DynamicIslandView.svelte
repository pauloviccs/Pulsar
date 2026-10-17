<script lang="ts">
  import { 
    Play, 
    Pause, 
    SkipBack, 
    SkipForward, 
    Maximize2, 
    Minus,
    Music, 
    Inbox,
    EyeOff
  } from '@lucide/svelte';
  import { 
    currentTrack, 
    isPlaying, 
    currentTime, 
    duration, 
    playerActions,
    minimizeToTray 
  } from '../stores/playerStore';
  import { safeInvoke, isTauri } from '../api/tauri';
  import { get } from 'svelte/store';

  let isHovered = $state(false);
  let showContextMenu = $state(false);
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);

  // Iniciar o arrasto nativo da janela no desktop de forma síncrona
  function handleStartDrag(e: MouseEvent | PointerEvent) {
    if (e.button !== 0) return; // Apenas botão esquerdo
    const target = e.target as HTMLElement;
    if (target.closest('button, input, a, [data-no-drag]')) return;
    
    showContextMenu = false;

    if (isTauri()) {
      // Dispara imediatamente o comando nativo de drag
      safeInvoke('drag_window').catch(() => {});
      import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) => {
        getCurrentWebviewWindow().startDragging().catch(() => {});
      }).catch(() => {});
    }
  }

  // Minimizar janela da Dynamic Island
  async function handleMinimizeWindow() {
    showContextMenu = false;
    if (isTauri()) {
      try {
        await safeInvoke('minimize_window');
      } catch (e) {
        console.warn('[Dynamic Island] Erro ao minimizar janela:', e);
      }
    }
  }

  // Ocultar/Minimizar para a Bandeja do Sistema (Tray)
  async function handleMinimizeToTray() {
    showContextMenu = false;
    if (isTauri()) {
      try {
        await safeInvoke('hide_to_tray');
      } catch (e) {
        console.warn('[Dynamic Island] Erro ao ocultar para o tray:', e);
      }
    }
  }

  // Ação inteligente do botão de minimizar: respeita preferência ou minimiza
  async function handleSmartMinimize() {
    const toTray = get(minimizeToTray);
    if (toTray) {
      await handleMinimizeToTray();
    } else {
      await handleMinimizeWindow();
    }
  }

  function handleExpandMain() {
    showContextMenu = false;
    playerActions.toggleMiniPlayer(false);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuX = Math.min(window.innerWidth - 180, Math.max(10, e.clientX));
    contextMenuY = Math.min(window.innerHeight - 130, Math.max(10, e.clientY));
    showContextMenu = !showContextMenu;
  }

  // Progresso em porcentagem para a barra fluida na base da pílula
  let progressPercent = $derived.by(() => {
    const cur = $currentTime;
    const dur = $duration;
    if (!dur || dur <= 0) return 0;
    return Math.min(100, Math.max(0, (cur / dur) * 100));
  });

  let artistDisplay = $derived(
    $currentTrack ? ($currentTrack.artist || $currentTrack.artist_guess || $currentTrack.channel_name || 'Desconhecido') : 'Pulsar'
  );
</script>

<!-- 
  PÍLULA DYNAMIC ISLAND ESTILO APPLE (macOS / iPhone)
  Fundo ultra black com reflexos de vidro líquido, arrasto nativo em tela inteira e física elástica.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div 
  role="application"
  tabindex="-1"
  data-tauri-drag-region
  style="-webkit-app-region: drag;"
  onpointerdown={handleStartDrag}
  onmousedown={handleStartDrag}
  oncontextmenu={handleContextMenu}
  onmouseenter={() => isHovered = true}
  onmouseleave={() => { isHovered = false; showContextMenu = false; }}
  class="w-full h-full flex flex-col justify-between select-none overflow-hidden relative cursor-grab active:cursor-grabbing p-2 text-[#F0F0F5] bg-black/95 backdrop-blur-3xl border border-white/[0.18] rounded-[30px] shadow-[0_16px_40px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.12)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
>
  <!-- Reflexo de Vidro Especular no Topo (Apple Glass Highlight) -->
  <div class="absolute inset-x-5 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" data-tauri-drag-region></div>

  <!-- Iluminação Dinâmica Difusa Traseira da Capa -->
  {#if $currentTrack?.thumbnail_url}
    <div class="absolute inset-0 pointer-events-none -z-10 overflow-hidden opacity-30 blur-2xl" data-tauri-drag-region>
      <img
        src={$currentTrack.thumbnail_url}
        alt=""
        class="w-full h-full object-cover scale-150 filter saturate-200"
      />
    </div>
  {/if}

  <!-- Corpo Principal da Pílula (Alinhamento em Linha Única Ultra Compacta) -->
  <div class="flex-1 flex items-center justify-between gap-2.5 px-1 min-w-0" data-tauri-drag-region style="-webkit-app-region: drag;">
    <!-- Esquerda: Mini Capa com Cantos Arredondados + Indicador de Som -->
    <div class="relative shrink-0 flex items-center" data-tauri-drag-region style="-webkit-app-region: drag;">
      {#if $currentTrack?.thumbnail_url}
        <div class="w-10 h-10 rounded-2xl overflow-hidden shadow-lg border border-white/[0.16] relative group" data-tauri-drag-region>
          <img
            src={$currentTrack.thumbnail_url}
            alt={$currentTrack.title}
            class="w-full h-full object-cover {$isPlaying ? 'scale-105' : 'scale-100'} transition-transform duration-500 pointer-events-none"
          />
          <!-- Equalizador sutil sobre a capa quando tocando -->
          {#if $isPlaying}
            <div class="absolute bottom-1 right-1 flex items-end gap-[1.5px] h-2.5 px-0.5 bg-black/60 backdrop-blur-xs rounded-sm pointer-events-none">
              <span class="w-[1.5px] bg-[#EF7D4B] rounded-full animate-bounce h-2"></span>
              <span class="w-[1.5px] bg-[#3093AA] rounded-full animate-bounce [animation-delay:0.15s] h-1.5"></span>
              <span class="w-[1.5px] bg-[#F3B044] rounded-full animate-bounce [animation-delay:0.3s] h-2.5"></span>
            </div>
          {/if}
        </div>
      {:else}
        <div class="w-10 h-10 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center" data-tauri-drag-region>
          <Music class="w-4 h-4 text-white/40" />
        </div>
      {/if}
    </div>

    <!-- Centro: Informações da Faixa em Linha Compacta -->
    <div class="flex-1 min-w-0 flex flex-col justify-center leading-tight pr-1" data-tauri-drag-region style="-webkit-app-region: drag;">
      <h4 
        class="text-xs font-semibold text-white truncate tracking-tight"
        title={$currentTrack?.title || 'Nenhuma música tocando'}
        data-tauri-drag-region
      >
        {$currentTrack?.title || 'Pulsar Desktop'}
      </h4>
      <p 
        class="text-[10px] text-white/55 truncate font-medium"
        data-tauri-drag-region
      >
        {artistDisplay}
      </p>
    </div>

    <!-- Direita: BOTÕES LIMITADOS (Voltar, Play/Pause, Avançar, Expandir, Minimizar Janela e Minimizar Tray) -->
    <div 
      class="flex items-center gap-1 shrink-0" 
      data-no-drag="true" 
      data-tauri-drag-region="false"
      style="-webkit-app-region: no-drag;"
    >
      <!-- 1. Botão Voltar (1 clique reinicia faixa, 2 cliques faixa anterior) -->
      <button
        type="button"
        data-no-drag="true"
        data-tauri-drag-region="false"
        style="-webkit-app-region: no-drag;"
        onclick={(e) => { e.stopPropagation(); playerActions.previous(); }}
        class="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.12] active:scale-90 transition-all cursor-pointer"
        title="Voltar (1 clique reinicia / 2 cliques anterior)"
      >
        <SkipBack class="w-3.5 h-3.5 fill-current" />
      </button>

      <!-- 2. Botão Play / Pause com Destaque Coral Pulsar -->
      <button
        type="button"
        data-no-drag="true"
        data-tauri-drag-region="false"
        style="-webkit-app-region: no-drag;"
        onclick={(e) => { e.stopPropagation(); playerActions.togglePlay(); }}
        class="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
        title={$isPlaying ? "Pausar" : "Reproduzir"}
      >
        {#if $isPlaying}
          <Pause class="w-3.5 h-3.5 fill-current text-black" />
        {:else}
          <Play class="w-3.5 h-3.5 fill-current text-black ml-0.5" />
        {/if}
      </button>

      <!-- 3. Botão Avançar -->
      <button
        type="button"
        data-no-drag="true"
        data-tauri-drag-region="false"
        style="-webkit-app-region: no-drag;"
        onclick={(e) => { e.stopPropagation(); playerActions.next(); }}
        class="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.12] active:scale-90 transition-all cursor-pointer"
        title="Avançar"
      >
        <SkipForward class="w-3.5 h-3.5 fill-current" />
      </button>

      <!-- Divisor sutil vertical -->
      <div class="w-[1px] h-4 bg-white/15 mx-0.5 pointer-events-none" data-tauri-drag-region></div>

      <!-- 4. Botão Expandir (Voltar para Tela Cheia / Janela Normal) -->
      <button
        type="button"
        data-no-drag="true"
        data-tauri-drag-region="false"
        style="-webkit-app-region: no-drag;"
        onclick={(e) => { e.stopPropagation(); handleExpandMain(); }}
        class="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-[#3093AA] hover:bg-white/[0.12] active:scale-90 transition-all cursor-pointer"
        title="Expandir para Janela Principal"
      >
        <Maximize2 class="w-3.5 h-3.5" />
      </button>

      <!-- 5. Botão Minimizar Janela (-) -->
      <button
        type="button"
        data-no-drag="true"
        data-tauri-drag-region="false"
        style="-webkit-app-region: no-drag;"
        onclick={(e) => { e.stopPropagation(); handleMinimizeWindow(); }}
        class="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.12] active:scale-90 transition-all cursor-pointer"
        title="Minimizar Janela"
      >
        <Minus class="w-3.5 h-3.5" />
      </button>

      <!-- 6. Botão Ocultar na Bandeja (Tray) -->
      <button
        type="button"
        data-no-drag="true"
        data-tauri-drag-region="false"
        style="-webkit-app-region: no-drag;"
        onclick={(e) => { e.stopPropagation(); handleMinimizeToTray(); }}
        class="w-7 h-7 rounded-full flex items-center justify-center text-white/50 hover:text-[#EF7D4B] hover:bg-white/[0.12] active:scale-90 transition-all cursor-pointer"
        title="Minimizar para a Bandeja (Tray)"
      >
        <Inbox class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>

  <!-- Barra de Progresso Fina Integrada na Borda Inferior da Pílula -->
  <div class="absolute inset-x-6 bottom-0.5 h-[2px] bg-white/[0.1] rounded-full overflow-hidden pointer-events-none" data-tauri-drag-region>
    <div 
      class="h-full bg-gradient-to-r from-[#3093AA] via-[#EF7D4B] to-[#F3B044] rounded-full transition-all duration-300 pointer-events-none"
      style="width: {progressPercent}%;"
    ></div>
  </div>

  <!-- Menu de Contexto Rápido com Clique Direito (Apple Glass Popup) -->
  {#if showContextMenu}
    <div 
      class="fixed z-50 p-1.5 rounded-2xl bg-black/95 backdrop-blur-2xl border border-white/[0.16] shadow-2xl flex flex-col gap-1 min-w-[170px] text-xs animate-scale-up"
      style="left: {contextMenuX}px; top: {contextMenuY}px; -webkit-app-region: no-drag;"
      data-no-drag="true"
    >
      <button
        type="button"
        onclick={handleExpandMain}
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-white/80 hover:text-white hover:bg-white/[0.1] transition cursor-pointer"
      >
        <Maximize2 class="w-3.5 h-3.5 text-[#3093AA]" />
        <span>Restaurar Janela</span>
      </button>
      <button
        type="button"
        onclick={handleMinimizeWindow}
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-white/80 hover:text-white hover:bg-white/[0.1] transition cursor-pointer"
      >
        <Minus class="w-3.5 h-3.5 text-white/60" />
        <span>Minimizar Janela</span>
      </button>
      <button
        type="button"
        onclick={handleMinimizeToTray}
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-white/80 hover:text-[#EF7D4B] hover:bg-white/[0.1] transition cursor-pointer"
      >
        <Inbox class="w-3.5 h-3.5 text-[#EF7D4B]" />
        <span>Minimizar para Tray</span>
      </button>
    </div>
  {/if}
</div>
