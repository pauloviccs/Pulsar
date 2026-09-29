<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    onFinish?: () => void;
  }

  let { onFinish }: Props = $props();

  let stage = $state<'pulsar' | 'createdby' | 'exit' | 'done'>('pulsar');
  let isStageTransition = $state(false);

  function finishSplash() {
    if (stage === 'done' || stage === 'exit') return;
    stage = 'exit';
    setTimeout(() => {
      stage = 'done';
      if (typeof window !== 'undefined') {
        localStorage.setItem('pulsar_splash_seen', 'true');
      }
      onFinish?.();
    }, 500);
  }

  onMount(() => {
    // Etapa 1: Apresentação da Marca Pulsar (2.6 segundos para respirar)
    const tStage1 = setTimeout(() => {
      if (stage === 'pulsar') {
        isStageTransition = true;
        setTimeout(() => {
          stage = 'createdby';
          isStageTransition = false;
        }, 400);
      }
    }, 2600);

    // Etapa 2: Apresentação das Marcas "Created by" (Lumia & VICCS) (2.4 segundos)
    const tStage2 = setTimeout(() => {
      finishSplash();
    }, 5400);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        finishSplash();
      }
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      clearTimeout(tStage1);
      clearTimeout(tStage2);
      window.removeEventListener('keydown', handleKey);
    };
  });
</script>

{#if stage !== 'done'}
  <div 
    class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#070A14] select-none cursor-pointer transition-all duration-500 ease-out {stage === 'exit' ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'}"
    onclick={finishSplash}
    role="button"
    tabindex="0"
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') finishSplash(); }}
  >
    <!-- Malha de Iluminação Ambiente Profunda (Liquid Glass Glow) -->
    <div class="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#097198]/25 via-[#EF7D4B]/15 to-[#F3B044]/10 blur-[120px] pointer-events-none animate-pulse"></div>
    <div class="absolute w-[350px] h-[350px] rounded-full bg-[#3093AA]/20 blur-[90px] pointer-events-none"></div>

    <!-- Container com transição suave entre Etapa 1 e Etapa 2 -->
    <div class="relative z-10 flex flex-col items-center justify-center transition-all duration-400 {isStageTransition ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}">
      
      {#if stage === 'pulsar'}
        <!-- ETAPA 1: Identidade Oficial Pulsar -->
        <div class="flex flex-col items-center gap-6 animate-apple-spring">
          <!-- Isotipo com as 5 Barras Sonoras -->
          <div class="relative w-28 h-28 flex items-center justify-center">
            <!-- Base Circular Liquid Glass (#1E1E1C) -->
            <div class="absolute inset-0 rounded-full bg-[#1E1E1C]/85 border border-white/[0.14] shadow-2xl shadow-black/90 flex items-center justify-center backdrop-blur-xl"></div>

            <!-- 5 Barras Inclinadas com Cores Oficiais da Marca -->
            <div class="relative flex items-center justify-center gap-[6px] transform -rotate-[14deg] z-10">
              <div class="w-[7px] h-10 rounded-full bg-[#097198] shadow-sm shadow-[#097198]/50 bar-anim bar-1"></div>
              <div class="w-[7px] h-14 rounded-full bg-[#3093AA] shadow-sm shadow-[#3093AA]/50 bar-anim bar-2"></div>
              <div class="w-[7px] h-18 rounded-full bg-[#EF7D4B] shadow-md shadow-[#EF7D4B]/60 bar-anim bar-3"></div>
              <div class="w-[7px] h-14 rounded-full bg-[#F3B044] shadow-sm shadow-[#F3B044]/50 bar-anim bar-4"></div>
              <div class="w-[7px] h-10 rounded-full bg-[#097198] shadow-sm shadow-[#097198]/50 bar-anim bar-5"></div>
            </div>
          </div>

          <!-- Tipografia Oficial e Tagline -->
          <div class="flex flex-col items-center gap-2">
            <h1 class="text-3xl sm:text-4xl font-black tracking-wider flex items-center logo-text">
              <span class="text-[#F3B044]">P</span>
              <span class="text-white">u</span>
              <span class="text-[#EF7D4B]">l</span>
              <span class="text-white">s</span>
              <span class="text-[#3093AA]">a</span>
              <span class="text-[#097198]">r</span>
            </h1>
            <p class="text-xs tracking-[0.25em] uppercase font-semibold text-[#aeb3c8]/85 tagline-text">
              Música, no seu ritmo
            </p>
          </div>

          <!-- Indicador Sutil de Versão -->
          <div class="mt-4 flex items-center gap-2 text-[11px] font-mono text-white/35">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#EF7D4B] animate-ping"></span>
            <span>v0.2.7</span>
          </div>
        </div>

      {:else}
        <!-- ETAPA 2: "Created by" com as Logos Lumia & VICCS -->
        <div class="flex flex-col items-center gap-8 animate-apple-spring max-w-xl px-6 text-center">
          <!-- Título "Created by" com estética refinada -->
          <div class="flex flex-col items-center gap-1.5">
            <span class="text-[11px] font-bold uppercase tracking-[0.35em] text-[#3093AA]">
              Desenvolvimento & Concepção
            </span>
            <h2 class="text-xl sm:text-2xl font-black tracking-wider text-white">
              Created by
            </h2>
          </div>

          <!-- Bloco com as Logos Lumia e VICCS em destaque Liquid Glass -->
          <div class="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 p-6 sm:p-8 rounded-3xl lq-glass-frost border border-white/[0.12] shadow-2xl backdrop-blur-2xl">
            <!-- Logo Lumia -->
            <div class="flex flex-col items-center gap-2 group">
              <img 
                src="/logos/lumia-logo.svg" 
                alt="Lumia Create Next" 
                class="h-10 sm:h-12 w-auto max-w-[200px] object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105" 
              />
            </div>

            <!-- Divisor Vertical / Ponto de Luz -->
            <div class="hidden sm:block w-px h-10 bg-gradient-to-b from-transparent via-white/25 to-transparent"></div>
            <div class="block sm:hidden w-12 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"></div>

            <!-- Logo VICCS -->
            <div class="flex flex-col items-center gap-2 group">
              <img 
                src="/logos/viccs-logo.svg" 
                alt="VICCS Design" 
                class="h-9 sm:h-11 w-auto max-w-[190px] object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105" 
              />
            </div>
          </div>

          <!-- Dica sutil de clique para pular -->
          <span class="text-[10px] tracking-wider text-white/30 uppercase font-mono">
            Pressione espaço ou clique para avançar
          </span>
        </div>
      {/if}

    </div>
  </div>
{/if}

<style>
  @keyframes barEnter {
    0% {
      transform: scaleY(0.2) translateY(12px);
      opacity: 0;
    }
    100% {
      transform: scaleY(1) translateY(0);
      opacity: 1;
    }
  }

  @keyframes wavePulse1 {
    0%, 100% { transform: scaleY(0.65); }
    50% { transform: scaleY(1.15); }
  }
  @keyframes wavePulse2 {
    0%, 100% { transform: scaleY(0.9); }
    50% { transform: scaleY(1.3); }
  }
  @keyframes wavePulse3 {
    0%, 100% { transform: scaleY(1.1); }
    50% { transform: scaleY(0.75); }
  }
  @keyframes wavePulse4 {
    0%, 100% { transform: scaleY(0.85); }
    50% { transform: scaleY(1.25); }
  }
  @keyframes wavePulse5 {
    0%, 100% { transform: scaleY(0.7); }
    50% { transform: scaleY(1.1); }
  }

  .bar-anim {
    transform-origin: center;
    animation: barEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .bar-1 { animation-delay: 0.05s; }
  .bar-2 { animation-delay: 0.1s; }
  .bar-3 { animation-delay: 0.15s; }
  .bar-4 { animation-delay: 0.2s; }
  .bar-5 { animation-delay: 0.25s; }

  :global(.bar-1) { animation: wavePulse1 1.6s ease-in-out infinite 0.6s; }
  :global(.bar-2) { animation: wavePulse2 1.4s ease-in-out infinite 0.7s; }
  :global(.bar-3) { animation: wavePulse3 1.8s ease-in-out infinite 0.8s; }
  :global(.bar-4) { animation: wavePulse4 1.5s ease-in-out infinite 0.9s; }
  :global(.bar-5) { animation: wavePulse5 1.7s ease-in-out infinite 1.0s; }

  .logo-text {
    animation: fadeInScale 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
  }

  .tagline-text {
    animation: fadeInScale 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both;
  }

  @keyframes fadeInScale {
    0% {
      opacity: 0;
      transform: translateY(8px) scale(0.96);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
