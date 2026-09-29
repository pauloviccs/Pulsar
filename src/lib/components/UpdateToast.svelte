<script lang="ts">
  import { Sparkles, ArrowRight, X } from '@lucide/svelte';
  import { 
    isUpdateToastOpen, 
    updateManifest, 
    updateActions 
  } from '../stores/updateStore';
</script>

{#if $isUpdateToastOpen && $updateManifest}
  <div 
    class="fixed bottom-24 right-6 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
  >
    <div class="relative overflow-hidden rounded-2xl bg-[#0B1020]/85 backdrop-blur-xl border border-white/[0.12] p-4 shadow-2xl shadow-black/80 flex items-center gap-3.5 group">
      <!-- Glow Decorativo Apple -->
      <div class="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-[#EF7D4B] opacity-20 blur-2xl pointer-events-none"></div>
      <div class="absolute -bottom-10 -left-10 w-24 h-24 rounded-full bg-[#3093AA] opacity-15 blur-2xl pointer-events-none"></div>

      <!-- Ícone Hero -->
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EF7D4B]/20 to-[#3093AA]/10 border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
        <Sparkles class="w-5 h-5 text-[#EF7D4B]" />
      </div>

      <!-- Texto e Versão -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 mb-0.5">
          <span class="text-[11px] font-bold uppercase tracking-wider text-[#3093AA]">Nova Versão</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/[0.08] text-white/90 border border-white/10">
            v{$updateManifest.version}
          </span>
        </div>
        <p class="text-xs text-white/70 truncate">
          {$updateManifest.name || 'Nova versão do Pulsar disponível!'}
        </p>
      </div>

      <!-- Ações -->
      <div class="flex items-center gap-1 shrink-0">
        <button
          onclick={() => updateActions.openModal()}
          class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#EF7D4B] to-[#ff8f70] text-[#0B1020] text-xs font-bold shadow-md shadow-[#EF7D4B]/25 hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>Ver</span>
          <ArrowRight class="w-3.5 h-3.5" />
        </button>

        <button
          onclick={() => updateActions.dismissToast()}
          class="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
{/if}
