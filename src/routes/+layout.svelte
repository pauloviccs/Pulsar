<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { logger } from '$lib/services/logger';
  import { isNativeFullscreen, playerActions } from '$lib/stores/playerStore';
  import { Minimize2 } from '@lucide/svelte';

  let { children } = $props();

  onMount(() => {
    logger.init();
    console.log('[Pulsar] Frontend inicializado com sucesso.');

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        let isFs = false;
        isNativeFullscreen.subscribe((val) => (isFs = val))();
        if (isFs) {
          playerActions.toggleNativeFullscreen();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

{@render children()}

{#if $isNativeFullscreen}
  <!-- Botão Global Flutuante para Sair da Tela Cheia (Esc) -->
  <div class="fixed top-3 left-1/2 -translate-x-1/2 z-[100] animate-apple-spring pointer-events-auto">
    <button
      type="button"
      onclick={() => playerActions.toggleNativeFullscreen()}
      class="flex items-center gap-2 px-4 py-2 rounded-full bg-black/85 hover:bg-black/95 backdrop-blur-xl border border-white/25 text-[#F0F0F5] shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer text-xs font-semibold select-none group"
      title="Sair do Modo Tela Cheia (Esc)"
    >
      <Minimize2 class="w-3.5 h-3.5 text-[#EF7D4B] group-hover:scale-110 transition-transform" />
      <span>Sair da Tela Cheia</span>
      <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-mono">Esc</span>
    </button>
  </div>
{/if}
