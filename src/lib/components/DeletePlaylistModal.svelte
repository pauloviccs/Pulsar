<script lang="ts">
  import { AlertTriangle, Trash2, X } from '@lucide/svelte';
  import { playlistToDelete, libraryActions } from '../stores/libraryStore';
  import { t } from '../i18n';

  function close() {
    playlistToDelete.set(null);
  }

  async function handleConfirmDelete() {
    if ($playlistToDelete) {
      await libraryActions.deletePlaylist($playlistToDelete.id);
      close();
    }
  }
</script>

{#if $playlistToDelete}
  <div 
    role="presentation"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xl animate-[fade-in_0.2s_ease-out]"
    onclick={close}
  >
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="lq-glass-elevated w-full max-w-md max-h-[90vh] rounded-3xl p-6 flex flex-col gap-5 border border-white/[0.16] shadow-2xl text-[#F0F0F5] animate-apple-spring relative overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Escape') close(); }}
    >
      <!-- Cabeçalho com Ícone Apple-like -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-[#EF7D4B]/15 border border-[#EF7D4B]/30 flex items-center justify-center text-[#EF7D4B] shrink-0 shadow-lg shadow-[#EF7D4B]/10">
            <AlertTriangle class="w-6 h-6" />
          </div>
          <div class="flex flex-col">
            <h3 class="text-base font-bold text-[#F0F0F5] tracking-tight">{$t('playlistDetail.deletePlaylist')}?</h3>
            <p class="text-xs text-[#F0F0F5]/50">{$t('modals.deletePlaylistConfirm')}</p>
          </div>
        </div>

        <button 
          onclick={close}
          class="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Detalhes do impacto -->
      <div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3.5">
        <img 
          src={$playlistToDelete.cover_image} 
          alt={$playlistToDelete.name} 
          class="w-12 h-12 rounded-xl object-cover border border-white/[0.1] shrink-0" 
        />
        <div class="flex flex-col min-w-0">
          <span class="text-xs font-semibold text-[#F0F0F5] truncate">{$playlistToDelete.name}</span>
          <span class="text-[11px] text-[#F0F0F5]/50">{$playlistToDelete.track_count} {$t('common.tracks')}</span>
        </div>
      </div>

      <p class="text-xs text-[#F0F0F5]/60 leading-relaxed">
        {$t('modals.deletePlaylistConfirm')} <strong class="text-[#F0F0F5]">"{$playlistToDelete.name}"</strong>
      </p>

      <!-- Ações -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <button
          onclick={close}
          class="px-4 py-2.5 rounded-xl text-xs font-medium text-[#F0F0F5]/70 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
        >
          {$t('common.cancel')}
        </button>

        <button
          onclick={handleConfirmDelete}
          class="px-5 py-2.5 rounded-xl bg-[#EF7D4B] hover:bg-[#EF7D4B]/90 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-[#EF7D4B]/25 transition active:scale-95 cursor-pointer"
        >
          <Trash2 class="w-4 h-4" />
          <span>{$t('playlistDetail.deletePlaylist')}</span>
        </button>
      </div>
    </div>
  </div>
{/if}
