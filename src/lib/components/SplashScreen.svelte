<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    onFinish?: () => void;
  }

  let { onFinish }: Props = $props();

  let phase = $state<'enter' | 'pulse' | 'exit' | 'done'>('enter');
  let isExiting = $state(false);

  function finishSplash() {
    if (phase === 'done') return;
    isExiting = true;
    setTimeout(() => {
      phase = 'done';
      if (typeof window !== 'undefined') {
        localStorage.setItem('pulsar_splash_seen', 'true');
      }
      onFinish?.();
    }, 450);
  }

  onMount(() => {
    const isFirstTime = typeof window !== 'undefined' ? !localStorage.getItem('pulsar_splash_seen') : true;
    const totalDuration = isFirstTime ? 2200 : 700;

    const timer1 = setTimeout(() => {
      if (phase !== 'done') phase = 'pulse';
    }, isFirstTime ? 400 : 150);

    const timer2 = setTimeout(() => {
      finishSplash();
    }, totalDuration);

    const handleKey = () => finishSplash();
    window.addEventListener('keydown', handleKey, { once: true });

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('keydown', handleKey);
    };
  });
</script>

{#if phase !== 'done'}
  <div 
    class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0B1020] select-none cursor-pointer transition-opacity duration-500 ease-out {isExiting ? 'opacity-0 scale-102 pointer-events-none' : 'opacity-100 scale-100'}"
    onclick={finishSplash}
    role="button"
    tabindex="0"
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') finishSplash(); }}
  >
    <!-- Efeito de Luzes Ambientais de Fundo (Liquid Glow) -->
    <div class="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#097198]/20 via-[#EF7D4B]/15 to-[#F3B044]/10 blur-[100px] pointer-events-none animate-pulse"></div>
    <div class="absolute w-[300px] h-[300px] rounded-full bg-[#3093AA]/15 blur-[80px] pointer-events-none"></div>

    <div class="relative z-10 flex flex-col items-center gap-6">
      <!-- Isotipo com as 5 Barras Sonoras da Nova Marca Pulsar -->
      <div class="relative w-28 h-28 flex items-center justify-center">
        <!-- Círculo Base de Fundo estilo Isotipo Oficial (#1E1E1C) com borda Liquid Glass -->
        <div class="absolute inset-0 rounded-full bg-[#1E1E1C]/80 border border-white/[0.12] shadow-2xl shadow-black/80 flex items-center justify-center backdrop-blur-xl"></div>

        <!-- 5 Barras Inclinadas com Cores Oficiais da Marca -->
        <div class="relative flex items-center justify-center gap-[6px] transform -rotate-[14deg] z-10">
          <!-- Barra 1: Teal Deep (#097198) -->
          <div 
            class="w-[7px] h-10 rounded-full bg-[#097198] shadow-sm shadow-[#097198]/50 bar-anim bar-1"
          ></div>

          <!-- Barra 2: Teal (#3093AA) -->
          <div 
            class="w-[7px] h-14 rounded-full bg-[#3093AA] shadow-sm shadow-[#3093AA]/50 bar-anim bar-2"
          ></div>

          <!-- Barra 3: Coral (#EF7D4B) - Principal & Mais Alta -->
          <div 
            class="w-[7px] h-18 rounded-full bg-[#EF7D4B] shadow-md shadow-[#EF7D4B]/60 bar-anim bar-3"
          ></div>

          <!-- Barra 4: Gold (#F3B044) -->
          <div 
            class="w-[7px] h-14 rounded-full bg-[#F3B044] shadow-sm shadow-[#F3B044]/50 bar-anim bar-4"
          ></div>

          <!-- Barra 5: Teal Deep (#097198) -->
          <div 
            class="w-[7px] h-10 rounded-full bg-[#097198] shadow-sm shadow-[#097198]/50 bar-anim bar-5"
          ></div>
        </div>
      </div>

      <!-- Tipografia Oficial da Nova Identidade Visual -->
      <div class="flex flex-col items-center gap-2">
        <h1 class="text-3xl sm:text-4xl font-black tracking-wider flex items-center logo-text">
          <span class="text-[#F3B044]">P</span>
          <span class="text-white">u</span>
          <span class="text-[#EF7D4B]">l</span>
          <span class="text-white">s</span>
          <span class="text-[#3093AA]">a</span>
          <span class="text-[#097198]">r</span>
        </h1>
        <p class="text-xs tracking-[0.22em] uppercase font-semibold text-[#aeb3c8]/80 tagline-text">
          Música, no seu ritmo
        </p>
      </div>

      <!-- Indicador Sutil de Versão / Carregamento -->
      <div class="mt-4 flex items-center gap-2 text-[11px] font-mono text-white/30">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#EF7D4B] animate-ping"></span>
        <span>v0.2.7</span>
      </div>
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
    animation: barEnter 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .bar-1 {
    animation: barEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0ms forwards,
               wavePulse1 1.4s ease-in-out 0.4s infinite;
  }
  .bar-2 {
    animation: barEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) 70ms forwards,
               wavePulse2 1.4s ease-in-out 0.47s infinite;
  }
  .bar-3 {
    animation: barEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) 140ms forwards,
               wavePulse3 1.4s ease-in-out 0.54s infinite;
  }
  .bar-4 {
    animation: barEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) 210ms forwards,
               wavePulse4 1.4s ease-in-out 0.61s infinite;
  }
  .bar-5 {
    animation: barEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) 280ms forwards,
               wavePulse5 1.4s ease-in-out 0.68s infinite;
  }

  @keyframes logoFadeIn {
    0% {
      opacity: 0;
      transform: translateY(8px) scale(0.97);
      letter-spacing: 0.25em;
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
      letter-spacing: 0.1em;
    }
  }

  .logo-text {
    animation: logoFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s backwards;
  }

  @keyframes taglineFadeIn {
    0% {
      opacity: 0;
      letter-spacing: 0.35em;
    }
    100% {
      opacity: 0.8;
      letter-spacing: 0.22em;
    }
  }

  .tagline-text {
    animation: taglineFadeIn 0.8s ease-out 0.4s backwards;
  }

  @media (prefers-reduced-motion: reduce) {
    .bar-anim, .logo-text, .tagline-text {
      animation: none !important;
      opacity: 1 !important;
    }
  }
</style>
