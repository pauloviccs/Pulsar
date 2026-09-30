<script lang="ts">
  import { onMount } from 'svelte';
  import {
    SlidersHorizontal,
    Monitor,
    Tv,
    Laptop,
    Ratio,
    Film,
    Sparkles,
    Check,
    Maximize2,
    Minimize2,
    ChevronDown,
    Layers,
    X,
    Scan
  } from '@lucide/svelte';
  import {
    videoAspectRatio,
    videoScale,
    videoQuality,
    videoFit,
    isNativeFullscreen,
    playerActions
  } from '../stores/playerStore';
  import type { VideoPlayerAspectRatio, VideoPlayerScale, VideoQualityPreference, VideoFitMode } from '../types';

  let isOpen = $state(false);
  let activeTab = $state<'size' | 'ratio' | 'quality'>('size');
  let containerRef = $state<HTMLDivElement>();

  const aspectRatios: { id: VideoPlayerAspectRatio; label: string; desc: string }[] = [
    { id: '16:9', label: '16:9 Widescreen Padrão', desc: 'TVs e Monitores (1080p, 2K QHD, 4K UHD)' },
    { id: '16:10', label: '16:10 Full HD+ Expandido', desc: '1920×1200 — Laptops e Monitores de Trabalho' },
    { id: '19.5:9', label: '19.5:9 Mobile / Ultra-Wide', desc: '2400×1080, 2556×1179 — Formato Ultra-Alongado' },
    { id: '21:9', label: '21:9 Cinema Ultrawide', desc: 'Monitores Ultrawide 34" (3440×1440)' },
    { id: '32:9', label: '32:9 Super Ultrawide', desc: 'Monitores Super Ultrawide 49" (5120×1440)' }
  ];

  const fitModes: { id: VideoFitMode; label: string; desc: string }[] = [
    { id: 'contain', label: 'Ajustar à Tela (Original)', desc: 'Mantém enquadramento 100% fiel da mídia sem cortes' },
    { id: 'cover', label: 'Preencher Tela (Zoom Imersivo)', desc: 'Expande para preencher o contêiner ultrawide' }
  ];

  const scalePresets: { id: VideoPlayerScale; label: string; category: string; iconType: 'laptop' | 'monitor' | 'ultrawide' | 'tv' }[] = [
    { id: 'compact', label: 'Compacto (Laptops / Janela)', category: 'Notebooks (~576px)', iconType: 'laptop' },
    { id: 'monitor-24', label: 'Monitores 21.5" - 24"', category: 'Full HD (~768px)', iconType: 'monitor' },
    { id: 'monitor-32', label: 'Monitores 27" - 32"', category: 'Quad HD & 4K (~1024px)', iconType: 'monitor' },
    { id: 'ultrawide', label: 'Monitores 34" - 49"', category: 'Ultrawide & Cinema (~1200px)', iconType: 'ultrawide' },
    { id: 'tv-large', label: 'TVs 32" até 98"+', category: 'Imersão Total Sala (92vw)', iconType: 'tv' }
  ];

  const qualityOptions: { id: VideoQualityPreference; label: string; badge: string }[] = [
    { id: 'auto', label: 'Automático', badge: 'Adaptativo' },
    { id: '2160p', label: 'Ultra HD 4K', badge: '3840×2160' },
    { id: '1440p', label: 'Quad HD 2K', badge: '2560×1440' },
    { id: '1080p', label: 'Full HD', badge: '1920×1080' },
    { id: '720p', label: 'Alta Definição', badge: '1280×720' }
  ];

  function toggleOpen(e: MouseEvent) {
    e.stopPropagation();
    isOpen = !isOpen;
  }

  function handleDocumentClick(e: MouseEvent) {
    if (isOpen && containerRef && !containerRef.contains(e.target as Node)) {
      isOpen = false;
    }
  }

  onMount(() => {
    window.addEventListener('click', handleDocumentClick);
    return () => {
      window.removeEventListener('click', handleDocumentClick);
    };
  });
</script>

<!-- Backdrop de Proteção contra Overlap (garante clique limpo fora e fecha o menu) -->
{#if isOpen}
  <div
    role="presentation"
    class="fixed inset-0 z-[55] bg-black/40 backdrop-blur-[2px] transition-opacity animate-[fade-in_0.15s_ease-out]"
    onclick={() => isOpen = false}
  ></div>
{/if}

<div class="relative inline-block text-left z-[58]" bind:this={containerRef}>
  <!-- Botão Disparador do Menu Drop-down Liquid Glass -->
  <button
    type="button"
    onclick={toggleOpen}
    class="px-3.5 py-2 rounded-full lq-glass-pill transition cursor-pointer flex items-center gap-2 text-xs font-semibold {isOpen ? 'bg-white/[0.18] border-white/[0.30] text-white shadow-lg' : 'text-white/80 hover:text-white'} active:scale-95"
    title="Configurar Formato de Tela, Resolução e Presets de Display"
    aria-haspopup="true"
    aria-expanded={isOpen}
  >
    <SlidersHorizontal class="w-3.5 h-3.5 text-[#3093AA]" />
    <span>{$videoScale === 'tv-large' ? 'TV Imersiva' : $videoAspectRatio}</span>
    <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-white/70 font-mono">
      {$videoQuality.toUpperCase()}
    </span>
    <ChevronDown class="w-3 h-3 text-white/50 transition-transform duration-300 {isOpen ? 'rotate-180' : ''}" />
  </button>

  <!-- Painel Flutuante Liquid Glass Suspenso com Animação Apple-Spring e Z-Index 60 Garantido -->
  {#if isOpen}
    <div
      role="menu"
      tabindex="-1"
      class="absolute right-0 top-full mt-2 w-80 sm:w-88 max-w-[calc(100vw-24px)] rounded-3xl lq-glass-elevated border border-white/[0.18] shadow-2xl shadow-black/90 p-4 z-[60] animate-apple-spring overflow-hidden text-[#F0F0F5] select-none"
    >
      <!-- Cabeçalho do Menu com Identidade Pulsar e Botão Fechar -->
      <div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div class="flex items-center gap-2">
          <div class="p-1.5 rounded-xl bg-[#3093AA]/20 text-[#3093AA] border border-[#3093AA]/30">
            <Film class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-xs font-bold tracking-tight text-white">Visualizador do Player</h3>
            <p class="text-[10px] text-white/50">Proporções, Displays & Fidelidade</p>
          </div>
        </div>

        <button
          type="button"
          onclick={() => isOpen = false}
          class="p-1.5 rounded-full hover:bg-white/[0.1] text-white/50 hover:text-white transition cursor-pointer"
          title="Fechar Menu"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Seletor de Abas Liquid Glass -->
      <div class="flex items-center p-0.5 rounded-xl bg-white/[0.05] border border-white/[0.08] my-3">
        <button
          type="button"
          onclick={() => activeTab = 'size'}
          class="flex-1 py-1 rounded-lg text-[11px] font-semibold transition text-center cursor-pointer {activeTab === 'size' ? 'bg-[#EF7D4B] text-white shadow-sm' : 'text-white/60 hover:text-white'}"
        >
          Displays
        </button>
        <button
          type="button"
          onclick={() => activeTab = 'ratio'}
          class="flex-1 py-1 rounded-lg text-[11px] font-semibold transition text-center cursor-pointer {activeTab === 'ratio' ? 'bg-[#EF7D4B] text-white shadow-sm' : 'text-white/60 hover:text-white'}"
        >
          Formato
        </button>
        <button
          type="button"
          onclick={() => activeTab = 'quality'}
          class="flex-1 py-1 rounded-lg text-[11px] font-semibold transition text-center cursor-pointer {activeTab === 'quality' ? 'bg-[#EF7D4B] text-white shadow-sm' : 'text-white/60 hover:text-white'}"
        >
          Qualidade
        </button>
      </div>

      <!-- Conteúdo da Aba 1: Tamanho do Visualizador (Displays & TVs) -->
      {#if activeTab === 'size'}
        <div class="pb-2 flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-white/40 px-1 pb-0.5">
            Presets de Escala (Monitores e TVs)
          </div>

          {#each scalePresets as preset}
            {@const isSelected = $videoScale === preset.id}
            <button
              type="button"
              onclick={() => playerActions.setVideoScale(preset.id)}
              class="w-full flex items-center justify-between p-2.5 rounded-2xl transition cursor-pointer {isSelected ? 'bg-[#3093AA]/20 border border-[#3093AA]/40 text-white shadow-sm' : 'hover:bg-white/[0.06] text-white/80 border border-transparent'}"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="p-2 rounded-xl {isSelected ? 'bg-[#3093AA] text-white' : 'bg-white/[0.06] text-white/60'} shrink-0">
                  {#if preset.iconType === 'laptop'}
                    <Laptop class="w-4 h-4" />
                  {:else if preset.iconType === 'monitor'}
                    <Monitor class="w-4 h-4" />
                  {:else if preset.iconType === 'ultrawide'}
                    <Layers class="w-4 h-4" />
                  {:else}
                    <Tv class="w-4 h-4" />
                  {/if}
                </div>
                <div class="text-left min-w-0">
                  <div class="text-xs font-semibold truncate {isSelected ? 'text-white' : 'text-white/90'}">{preset.label}</div>
                  <div class="text-[10px] text-white/50 truncate">{preset.category}</div>
                </div>
              </div>

              {#if isSelected}
                <div class="p-1 rounded-full bg-[#3093AA] text-white shrink-0 ml-2">
                  <Check class="w-3 h-3 stroke-[2.5]" />
                </div>
              {/if}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Conteúdo da Aba 2: Proporção (Aspect Ratio) & Enquadramento -->
      {#if activeTab === 'ratio'}
        <div class="pb-2 flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1">
          <div class="flex flex-col gap-1">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-white/40 px-1 pb-0.5">
              Proporções Suportadas
            </div>

            {#each aspectRatios as ratio}
              {@const isSelected = $videoAspectRatio === ratio.id}
              <button
                type="button"
                onclick={() => playerActions.setVideoAspectRatio(ratio.id)}
                class="w-full flex items-center justify-between p-2 rounded-2xl transition cursor-pointer {isSelected ? 'bg-[#EF7D4B]/20 border border-[#EF7D4B]/40 text-white shadow-sm' : 'hover:bg-white/[0.06] text-white/80 border border-transparent'}"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="p-1.5 rounded-xl {isSelected ? 'bg-[#EF7D4B] text-white' : 'bg-white/[0.06] text-white/60'} shrink-0">
                    <Ratio class="w-3.5 h-3.5" />
                  </div>
                  <div class="text-left min-w-0">
                    <div class="text-xs font-semibold truncate {isSelected ? 'text-white' : 'text-white/90'}">{ratio.label}</div>
                    <div class="text-[10px] text-white/50 truncate">{ratio.desc}</div>
                  </div>
                </div>

                {#if isSelected}
                  <div class="p-1 rounded-full bg-[#EF7D4B] text-white shrink-0 ml-2">
                    <Check class="w-3 h-3 stroke-[2.5]" />
                  </div>
                {/if}
              </button>
            {/each}
          </div>

          <!-- Seletor de Enquadramento (Ajustar vs Preencher) -->
          <div class="pt-2 border-t border-white/[0.08] flex flex-col gap-1.5">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-white/40 px-1">
              Modo de Enquadramento
            </div>

            <div class="grid grid-cols-2 gap-1.5">
              {#each fitModes as mode}
                {@const isFitSelected = $videoFit === mode.id}
                <button
                  type="button"
                  onclick={() => playerActions.setVideoFit(mode.id)}
                  class="flex items-center gap-2 p-2 rounded-xl border text-left transition cursor-pointer {isFitSelected ? 'bg-white/[0.12] border-[#3093AA]/60 text-white' : 'border-white/[0.08] hover:bg-white/[0.05] text-white/70'}"
                >
                  <Scan class="w-3.5 h-3.5 {isFitSelected ? 'text-[#3093AA]' : 'text-white/40'} shrink-0" />
                  <div class="min-w-0">
                    <div class="text-[11px] font-semibold truncate">{mode.label.split(' ')[0]}</div>
                    <div class="text-[9px] text-white/45 truncate">{mode.id === 'contain' ? 'Original' : 'Preencher'}</div>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      <!-- Conteúdo da Aba 3: Qualidade de Transmissão -->
      {#if activeTab === 'quality'}
        <div class="pb-2 flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-white/40 px-1 pb-0.5">
            Qualidade do Stream de Vídeo
          </div>

          {#each qualityOptions as q}
            {@const isSelected = $videoQuality === q.id}
            <button
              type="button"
              onclick={() => playerActions.setVideoQuality(q.id)}
              class="w-full flex items-center justify-between p-2.5 rounded-2xl transition cursor-pointer {isSelected ? 'bg-[#3093AA]/20 border border-[#3093AA]/40 text-white shadow-sm' : 'hover:bg-white/[0.06] text-white/80 border border-transparent'}"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="p-2 rounded-xl {isSelected ? 'bg-[#3093AA] text-white' : 'bg-white/[0.06] text-white/60'} shrink-0">
                  <Sparkles class="w-4 h-4" />
                </div>
                <div class="text-left min-w-0">
                  <div class="text-xs font-semibold truncate {isSelected ? 'text-white' : 'text-white/90'}">{q.label}</div>
                  <div class="text-[10px] text-white/50 truncate">{q.badge}</div>
                </div>
              </div>

              {#if isSelected}
                <div class="p-1 rounded-full bg-[#3093AA] text-white shrink-0 ml-2">
                  <Check class="w-3 h-3 stroke-[2.5]" />
                </div>
              {/if}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Rodapé: Botão de Alternância de Tela Cheia Nativa -->
      <div class="pt-3 border-t border-white/[0.08] flex items-center justify-between gap-2">
        <button
          type="button"
          onclick={() => playerActions.toggleNativeFullscreen()}
          class="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-2xl lq-glass-pill hover:bg-white/[0.14] text-xs font-semibold text-white/90 transition cursor-pointer"
        >
          {#if $isNativeFullscreen}
            <Minimize2 class="w-4 h-4 text-[#EF7D4B]" />
            <span>Sair da Tela Cheia</span>
          {:else}
            <Maximize2 class="w-4 h-4 text-[#3093AA]" />
            <span>Tela Cheia Nativa</span>
          {/if}
        </button>
      </div>
    </div>
  {/if}
</div>
