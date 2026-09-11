<script lang="ts">
  import { 
    Sparkles, 
    Download, 
    ArrowRight, 
    X, 
    AlertCircle, 
    ExternalLink, 
    CheckCircle2,
    RefreshCw
  } from '@lucide/svelte';
  import { 
    isUpdateModalOpen, 
    updateManifest, 
    currentVersion, 
    isDownloading, 
    downloadProgress, 
    updateError, 
    updateStatusMessage, 
    updateActions 
  } from '../stores/updateStore';
  import { openUrl } from '@tauri-apps/plugin-opener';

  function parseSimpleMarkdown(text: string = ''): string {
    if (!text) return '';
    return text
      .replace(/^### (.*$)/gim, '<h4 class="font-bold text-white text-sm mt-2 mb-1">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 class="font-bold text-white text-base mt-2 mb-1">$1</h3>')
      .replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc text-white/80 my-0.5">$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#F2EFEA]">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-white/[0.08] font-mono text-[11px] text-[#66D7D1]">$1</code>')
      .replace(/\n\n/g, '<br/>');
  }

  async function handleOpenFallbackUrl(url: string) {
    try {
      await openUrl(url);
    } catch (_) {
      window.open(url, '_blank');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !$isDownloading && !$updateManifest?.mandatory) {
      updateActions.closeModal();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $isUpdateModalOpen && $updateManifest}
  <div 
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-200"
    role="dialog"
    aria-modal="true"
  >
    <!-- Modal Window Apple Liquid Glass -->
    <div 
      class="relative w-full max-w-lg overflow-hidden rounded-3xl bg-[#0c0e17]/90 border border-white/[0.12] p-6 sm:p-7 shadow-2xl shadow-black flex flex-col gap-5 animate-in zoom-in-95 duration-200"
    >
      <!-- Ambient Glows -->
      <div class="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-[#FC7753] opacity-25 blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-[#66D7D1] opacity-20 blur-3xl pointer-events-none"></div>

      <!-- Header: Ícone, Título e Badges de Versão -->
      <div class="flex items-start justify-between gap-3 relative z-10">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FC7753] to-[#66D7D1] p-0.5 shadow-lg shadow-[#FC7753]/20 shrink-0">
            <div class="w-full h-full rounded-[14px] bg-[#0c0e17] flex items-center justify-center">
              <Sparkles class="w-6 h-6 text-[#FC7753]" />
            </div>
          </div>

          <div>
            <div class="flex items-center gap-2 mb-1">
              <h3 class="text-base font-bold text-[#F2EFEA] tracking-tight">
                {$updateManifest.name || 'Nova Versão do Pulsar'}
              </h3>
              {#if $updateManifest.mandatory}
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                  Obrigatório
                </span>
              {/if}
            </div>

            <!-- Segmented Pill de Versão Apple -->
            <div class="flex items-center gap-1.5 text-xs text-white/60">
              <span class="px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/10 font-mono text-white/70">
                v{$currentVersion}
              </span>
              <ArrowRight class="w-3.5 h-3.5 text-[#66D7D1]" />
              <span class="px-2 py-0.5 rounded-lg bg-[#66D7D1]/10 border border-[#66D7D1]/30 font-mono font-bold text-[#66D7D1]">
                v{$updateManifest.version}
              </span>
            </div>
          </div>
        </div>

        <!-- Botão Fechar (apenas se não for mandatório e não estiver baixando) -->
        {#if !$updateManifest.mandatory && !$isDownloading}
          <button
            onclick={() => updateActions.closeModal()}
            class="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Fechar"
          >
            <X class="w-5 h-5" />
          </button>
        {/if}
      </div>

      <!-- Release Notes Rolável -->
      <div class="relative z-10 flex flex-col gap-1.5">
        <span class="text-[11px] font-bold uppercase tracking-wider text-white/40">
          O que há de novo
        </span>
        <div class="max-h-52 overflow-y-auto pr-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 text-xs text-white/80 leading-relaxed shadow-inner">
          {@html parseSimpleMarkdown($updateManifest.notes || 'Nenhuma nota de versão especificada.')}
        </div>
      </div>

      <!-- Seção de Progresso e Streaming (Visível durante o download) -->
      {#if $isDownloading || $downloadProgress.percentage > 0}
        <div class="relative z-10 flex flex-col gap-2 rounded-2xl bg-white/[0.04] border border-white/10 p-4 animate-in fade-in duration-200">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-white/80 truncate max-w-[280px]">
              {$updateStatusMessage || 'Baixando instalador...'}
            </span>
            <span class="font-mono font-bold text-[#66D7D1] tabular-nums">
              {$downloadProgress.percentage.toFixed(0)}%
            </span>
          </div>

          <!-- Barra de Progresso com Shimmer -->
          <div class="w-full h-3 bg-white/[0.08] rounded-full overflow-hidden p-0.5 border border-white/[0.08] shadow-inner relative">
            <div 
              class="h-full rounded-full bg-gradient-to-r from-[#66D7D1] via-[#FC7753] to-[#ff8f70] transition-all duration-200 shadow-md shadow-[#FC7753]/30 relative overflow-hidden"
              style="width: {$downloadProgress.percentage}%"
            >
              <!-- Shimmer animado -->
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
            </div>
          </div>

          <!-- Estatísticas em MB -->
          <div class="flex items-center justify-between text-[11px] font-mono text-white/40">
            <span>
              {((($downloadProgress.downloaded_bytes || 0) / (1024 * 1024))).toFixed(1)} MB transferidos
            </span>
            {#if $downloadProgress.total_bytes > 0}
              <span>
                Total: {((($downloadProgress.total_bytes || 0) / (1024 * 1024))).toFixed(1)} MB
              </span>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Caixa de Erro (se houver) -->
      {#if $updateError}
        <div class="relative z-10 rounded-2xl bg-red-500/10 border border-red-500/30 p-3.5 flex items-start gap-3 text-xs text-red-200">
          <AlertCircle class="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div class="flex-1">
            <p class="font-medium">{$updateError}</p>
            {#if $updateManifest.url}
              <button
                onclick={() => handleOpenFallbackUrl($updateManifest!.url)}
                class="mt-2 text-xs font-semibold text-[#66D7D1] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Baixar instalador manualmente pelo navegador</span>
                <ExternalLink class="w-3 h-3" />
              </button>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Rodapé de Ações Apple-Like -->
      <div class="flex items-center justify-end gap-3 pt-1 relative z-10">
        {#if !$updateManifest.mandatory && !$isDownloading}
          <button
            onclick={() => updateActions.closeModal()}
            class="px-4 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white text-xs font-semibold transition-all cursor-pointer border border-white/5 active:scale-95"
          >
            Lembrar Mais Tarde
          </button>
        {/if}

        <button
          onclick={() => updateActions.startInstall()}
          disabled={$isDownloading}
          class="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#FC7753] to-[#ff8f70] text-[#0b0c13] text-xs font-bold shadow-lg shadow-[#FC7753]/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
        >
          {#if $isDownloading}
            <RefreshCw class="w-4 h-4 animate-spin text-[#0b0c13]" />
            <span>Atualizando...</span>
          {:else}
            <Download class="w-4 h-4 text-[#0b0c13]" />
            <span>Atualizar Agora</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .animate-shimmer {
    animation: shimmer 1.8s infinite linear;
  }
</style>
