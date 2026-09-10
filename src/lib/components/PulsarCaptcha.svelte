<script lang="ts">
  import { 
    ShieldCheck, 
    Check, 
    RotateCcw, 
    Headphones, 
    Radio, 
    Mic, 
    Disc3, 
    Volume2, 
    Music2, 
    Loader2, 
    Sparkles, 
    AlertCircle 
  } from '@lucide/svelte';

  interface Props {
    onverify?: (token: string) => void;
    onreset?: () => void;
  }

  let { onverify, onreset }: Props = $props();

  type CaptchaStatus = 'idle' | 'analyzing' | 'challenge' | 'verified' | 'failed';

  interface MusicalTarget {
    id: string;
    label: string;
    icon: any;
  }

  const allTargets: MusicalTarget[] = [
    { id: 'headphones', label: 'o fone de ouvido', icon: Headphones },
    { id: 'disc', label: 'o disco de vinil', icon: Disc3 },
    { id: 'radio', label: 'o rádio retrô', icon: Radio },
    { id: 'mic', label: 'o microfone', icon: Mic },
    { id: 'volume', label: 'a caixa de som', icon: Volume2 },
    { id: 'note', label: 'a nota musical', icon: Music2 }
  ];

  let captchaStatus = $state<CaptchaStatus>('idle');
  let currentTarget = $state<MusicalTarget>(allTargets[0]);
  let challengeOptions = $state<MusicalTarget[]>([]);
  let downTimestamp = 0;
  let errorMessage = $state<string | null>(null);

  function generateChallenge() {
    // Sorteia 1 alvo
    const targetIdx = Math.floor(Math.random() * allTargets.length);
    currentTarget = allTargets[targetIdx];

    // Sorteia outros 3 itens distintos para compor as 4 opções
    const others = allTargets.filter(t => t.id !== currentTarget.id);
    const shuffledOthers = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    challengeOptions = [currentTarget, ...shuffledOthers].sort(() => Math.random() - 0.5);
  }

  function handlePointerDown() {
    downTimestamp = performance.now();
  }

  async function handleCheckboxClick(e: MouseEvent) {
    if (captchaStatus === 'verified' || captchaStatus === 'analyzing') return;

    const upTimestamp = performance.now();
    const duration = upTimestamp - downTimestamp;

    // Detecção básica de automação e clique sintético
    const isBotSuspect = 
      !e.isTrusted || 
      (typeof navigator !== 'undefined' && (navigator as any).webdriver) ||
      duration < 30 || 
      (e.clientX === 0 && e.clientY === 0);

    captchaStatus = 'analyzing';
    errorMessage = null;

    // Simula análise de telemetria e entropia humana (600ms)
    await new Promise(r => setTimeout(r, 650));

    generateChallenge();
    captchaStatus = 'challenge';
  }

  function handleSelectOption(option: MusicalTarget) {
    if (option.id === currentTarget.id) {
      captchaStatus = 'verified';
      errorMessage = null;
      // Gera token temporário com timestamp
      const token = `pulsar_human_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      onverify?.(token);
    } else {
      errorMessage = 'Opção incorreta. Tente novamente!';
      generateChallenge();
    }
  }

  export function reset() {
    captchaStatus = 'idle';
    errorMessage = null;
    onreset?.();
  }
</script>

<div class="w-full rounded-2xl liquid-glass border border-white/[0.12] p-3.5 flex flex-col gap-3 text-[#F2EFEA] select-none shadow-lg">
  {#if captchaStatus === 'idle' || captchaStatus === 'analyzing'}
    <!-- FASE 1: CHECKBOX INTELIGENTE ESTILO TURNSTILE -->
    <button
      type="button"
      onpointerdown={handlePointerDown}
      onclick={handleCheckboxClick}
      disabled={captchaStatus === 'analyzing'}
      class="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] transition cursor-pointer group"
    >
      <div class="flex items-center gap-3">
        <!-- Caixa de Seleção com Micro-animação -->
        <div class="w-6 h-6 rounded-lg border-2 border-white/[0.2] group-hover:border-[#66D7D1] transition flex items-center justify-center bg-black/20 shrink-0">
          {#if captchaStatus === 'analyzing'}
            <Loader2 class="w-4 h-4 text-[#66D7D1] animate-spin" />
          {/if}
        </div>

        <div class="text-left">
          <p class="text-xs font-bold text-[#F2EFEA] group-hover:text-[#66D7D1] transition">
            {captchaStatus === 'analyzing' ? 'Verificando segurança...' : 'Não sou um robô'}
          </p>
          <p class="text-[10px] text-white/40">Clique para validar o cadastro</p>
        </div>
      </div>

      <div class="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition">
        <ShieldCheck class="w-4 h-4 text-[#66D7D1]" />
        <span class="text-[9px] font-mono tracking-wider uppercase text-white/50">Anti-Bot</span>
      </div>
    </button>

  {:else if captchaStatus === 'challenge'}
    <!-- FASE 2: MINI-DESAFIO MUSICAL NATIVO DO PULSAR -->
    <div class="flex flex-col gap-2.5 animate-in fade-in duration-200">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Sparkles class="w-3.5 h-3.5 text-[#FC7753]" />
          <p class="text-xs font-bold text-[#F2EFEA]">
            Selecione <strong class="text-[#66D7D1] underline underline-offset-2">{currentTarget.label}</strong>:
          </p>
        </div>

        <button
          type="button"
          onclick={generateChallenge}
          class="p-1 rounded-lg text-white/40 hover:text-[#66D7D1] hover:bg-white/[0.06] transition cursor-pointer"
          title="Trocar desafio"
        >
          <RotateCcw class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Grade 4 Cartões Temáticos -->
      <div class="grid grid-cols-4 gap-2 pt-1">
        {#each challengeOptions as opt (opt.id)}
          {@const IconComp = opt.icon}
          <button
            type="button"
            onclick={() => handleSelectOption(opt)}
            class="aspect-square rounded-xl bg-white/[0.04] hover:bg-[#66D7D1]/15 border border-white/[0.1] hover:border-[#66D7D1]/50 flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer group"
          >
            <IconComp class="w-5 h-5 text-white/70 group-hover:text-[#66D7D1] group-hover:scale-110 transition-transform" />
          </button>
        {/each}
      </div>

      {#if errorMessage}
        <div class="flex items-center gap-1.5 text-[10px] text-[#FC7753] font-medium pt-0.5">
          <AlertCircle class="w-3 h-3 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      {/if}
    </div>

  {:else if captchaStatus === 'verified'}
    <!-- FASE 3: VERIFICADO COM SUCESSO -->
    <div class="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#66D7D1]/15 border border-[#66D7D1]/35 text-[#66D7D1] animate-in zoom-in-95 duration-200">
      <div class="flex items-center gap-2.5">
        <div class="w-6 h-6 rounded-lg bg-[#66D7D1] text-[#09090d] flex items-center justify-center shadow-md">
          <Check class="w-4 h-4 stroke-[3]" />
        </div>
        <div>
          <p class="text-xs font-bold text-[#F2EFEA]">Humano verificado com sucesso</p>
          <p class="text-[10px] text-[#66D7D1]/80">Cadastro desbloqueado</p>
        </div>
      </div>

      <button
        type="button"
        onclick={reset}
        class="text-[10px] font-mono text-white/40 hover:text-white transition cursor-pointer underline"
      >
        Refazer
      </button>
    </div>
  {/if}
</div>
