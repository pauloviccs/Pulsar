<script lang="ts">
  import { X, Copy, Check, FolderOpen, RefreshCw, Trash2, Search, Terminal, AlertTriangle, AlertCircle, Info } from 'lucide-svelte';
  import { logger, type LogEntry } from '../services/logger';

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  let searchTerm = $state('');
  let levelFilter = $state<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  let copied = $state(false);
  let isSyncing = $state(false);
  let logContainer: HTMLDivElement | null = $state(null);

  const logs = logger;

  let filteredLogs = $derived($logs.filter(entry => {
    const matchesLevel = levelFilter === 'ALL' || entry.level === levelFilter;
    const matchesSearch = !searchTerm || 
      entry.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.timestamp.includes(searchTerm);
    return matchesLevel && matchesSearch;
  }));

  $effect(() => {
    if (isOpen) {
      handleSync();
    }
  });

  async function handleSync() {
    isSyncing = true;
    try {
      await logger.syncBackendLogs();
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    } finally {
      setTimeout(() => { isSyncing = false; }, 400);
    }
  }

  async function handleCopy() {
    const ok = await logger.copyLogsToClipboard();
    if (ok) {
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    }
  }

  async function handleOpenFolder() {
    await logger.openLogFolder();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- Backdrop com Blur e Escurecimento -->
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 select-none"
    onclick={() => isOpen = false}
    role="presentation"
  >
    <!-- Modal Container Liquid Glass -->
    <div 
      class="relative w-full max-w-2xl bg-[#0f1016]/95 backdrop-blur-2xl border border-white/[0.1] rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col h-[80vh] animate-in zoom-in-95 duration-200"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logs-modal-title"
      tabindex="-1"
    >
      <!-- Cabeçalho -->
      <div class="p-4 px-5 flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02]">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/20 to-amber-500/40 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Terminal class="w-4 h-4" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 id="logs-modal-title" class="text-sm font-bold text-[#F2EFEA] tracking-tight">
                Console de Diagnóstico & Logs
              </h2>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.06] text-white/70 border border-white/[0.08]">
                {$logs.length} eventos
              </span>
            </div>
            <p class="text-[11px] text-[#F2EFEA]/50">
              Histórico operacional de Bluetooth, streaming, áudio WASAPI e rede
            </p>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <!-- Botão Sincronizar -->
          <button
            onclick={handleSync}
            disabled={isSyncing}
            class="p-2 rounded-xl text-[#F2EFEA]/60 hover:text-[#F2EFEA] hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="Atualizar Logs"
          >
            <RefreshCw class="w-4 h-4 {isSyncing ? 'animate-spin text-[#66D7D1]' : ''}" />
          </button>

          <!-- Botão Copiar -->
          <button
            onclick={handleCopy}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-[#F2EFEA] border border-white/[0.08] transition-all cursor-pointer active:scale-95"
            title="Copiar todos os logs"
          >
            {#if copied}
              <Check class="w-3.5 h-3.5 text-emerald-400" />
              <span class="text-emerald-400">Copiado!</span>
            {:else}
              <Copy class="w-3.5 h-3.5 text-[#F2EFEA]/70" />
              <span>Copiar</span>
            {/if}
          </button>

          <!-- Botão Abrir Pasta -->
          <button
            onclick={handleOpenFolder}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-[#F2EFEA] border border-white/[0.08] transition-all cursor-pointer active:scale-95"
            title="Abrir pasta do arquivo pulsar.log no Explorer"
          >
            <FolderOpen class="w-3.5 h-3.5 text-[#F2EFEA]/70" />
            <span class="hidden sm:inline">Pasta</span>
          </button>

          <!-- Botão Fechar -->
          <button
            onclick={() => isOpen = false}
            class="p-2 rounded-xl text-[#F2EFEA]/50 hover:text-[#F2EFEA] hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer"
            title="Fechar"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Barra de Filtros e Busca -->
      <div class="p-3 px-5 border-b border-white/[0.06] bg-black/30 flex flex-wrap items-center justify-between gap-3">
        <!-- Campo de Busca -->
        <div class="relative flex-1 min-w-[200px]">
          <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            bind:value={searchTerm}
            placeholder="Filtrar por mensagem ou data..."
            class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#F2EFEA] placeholder-white/30 focus:outline-none focus:border-[#66D7D1]/50 transition-colors"
          />
        </div>

        <!-- Filtro de Nível -->
        <div class="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
          <button
            onclick={() => levelFilter = 'ALL'}
            class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer {levelFilter === 'ALL' ? 'bg-white/[0.12] text-white' : 'text-white/50 hover:text-white'}"
          >
            Todos
          </button>
          <button
            onclick={() => levelFilter = 'INFO'}
            class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer {levelFilter === 'INFO' ? 'bg-blue-500/20 text-blue-300' : 'text-white/50 hover:text-white'}"
          >
            Info
          </button>
          <button
            onclick={() => levelFilter = 'WARN'}
            class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer {levelFilter === 'WARN' ? 'bg-amber-500/20 text-amber-300' : 'text-white/50 hover:text-white'}"
          >
            Warn
          </button>
          <button
            onclick={() => levelFilter = 'ERROR'}
            class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer {levelFilter === 'ERROR' ? 'bg-red-500/20 text-red-300' : 'text-white/50 hover:text-white'}"
          >
            Erro
          </button>
        </div>

        <!-- Botão Limpar -->
        <button
          onclick={() => logger.clear()}
          class="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="Limpar visualização de logs"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Área de Logs Terminal-Like -->
      <div 
        bind:this={logContainer}
        class="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs select-text bg-[#090a0f] custom-scrollbar"
      >
        {#if filteredLogs.length === 0}
          <div class="h-full flex flex-col items-center justify-center text-white/30 space-y-2 py-12">
            <Terminal class="w-8 h-8 stroke-1 text-white/20" />
            <p class="text-xs">Nenhum evento registrado com os filtros atuais.</p>
          </div>
        {:else}
          {#each filteredLogs as entry (entry.id)}
            <div class="flex items-start gap-2.5 py-1 px-2 rounded-lg hover:bg-white/[0.02] transition-colors leading-relaxed border-l-2 {entry.level === 'ERROR' ? 'border-red-500/80 bg-red-500/[0.03]' : (entry.level === 'WARN' ? 'border-amber-500/80 bg-amber-500/[0.03]' : 'border-blue-500/30')}">
              <!-- Timestamp -->
              <span class="text-[11px] text-white/30 shrink-0 select-none">
                {entry.timestamp.split(' ')[1] || entry.timestamp}
              </span>

              <!-- Badge Level -->
              <span class="px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 uppercase tracking-wider {entry.level === 'ERROR' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : (entry.level === 'WARN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/15 text-blue-400 border border-blue-500/25')}">
                {entry.level}
              </span>

              <!-- Message -->
              <span class="flex-1 text-[#e2e0db] break-all font-sans text-xs">
                {entry.message}
              </span>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Rodapé com Info do Arquivo -->
      <div class="p-2.5 px-5 border-t border-white/[0.06] bg-black/40 flex items-center justify-between text-[11px] text-white/40">
        <span class="truncate">
          Arquivo: <code class="text-white/60 bg-white/[0.05] px-1.5 py-0.5 rounded">%APPDATA%/com.pulsar.app/logs/pulsar.log</code>
        </span>
        <span class="shrink-0 text-[#66D7D1]">
          Pulsar v0.2.4
        </span>
      </div>
    </div>
  </div>
{/if}
