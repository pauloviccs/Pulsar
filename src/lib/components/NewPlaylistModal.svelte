<script lang="ts">
  import { X, PlusCircle, ListMusic, Globe, Share2, Lock } from '@lucide/svelte';
  import { isNewPlaylistModalOpen, libraryActions } from '../stores/libraryStore';
  import { t } from '../i18n';
  import type { PlaylistVisibility } from '../types';

  let name = $state('');
  let description = $state('');
  let visibility = $state<PlaylistVisibility>('public');

  async function handleSubmit() {
    if (!name.trim()) return;
    const pl = await libraryActions.createPlaylist(name, description, visibility);
    libraryActions.setActiveView('playlist-detail', pl);
    close();
  }

  function close() {
    isNewPlaylistModalOpen.set(false);
    name = '';
    description = '';
    visibility = 'public';
  }
</script>

{#if $isNewPlaylistModalOpen}
  <div 
    role="presentation"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-[fade-in_0.2s_ease-out]"
    onclick={close}
  >
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="lq-glass-elevated w-full max-w-md max-h-[88vh] rounded-3xl p-5 sm:p-6 flex flex-col shadow-2xl border border-white/[0.1] text-[#F0F0F5] overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Escape') close(); }}
    >
      <div class="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="p-2 rounded-lg bg-[#3093AA]/20 text-[#3093AA] shrink-0">
            <ListMusic class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <h2 class="text-sm font-semibold tracking-tight text-[#F0F0F5] truncate">{$t('modals.newPlaylistTitle')}</h2>
            <p class="text-[11px] text-[#F0F0F5]/50 truncate">{$t('playlistDetail.defaultDesc')}</p>
          </div>
        </div>

        <button onclick={close} class="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition cursor-pointer shrink-0">
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto flex flex-col gap-3 py-3 pr-1">
        <div class="flex flex-col gap-1.5">
          <label for="playlist-name-input" class="text-[11px] font-semibold uppercase tracking-wider text-[#F0F0F5]/60">{$t('modals.newPlaylistNamePlaceholder')}</label>
          <input
            id="playlist-name-input"
            type="text"
            bind:value={name}
            placeholder={$t('modals.newPlaylistNamePlaceholder')}
            class="w-full py-2 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-[#3093AA] focus:outline-none text-xs text-[#F0F0F5] placeholder:text-[#F0F0F5]/30 transition"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="playlist-desc-input" class="text-[11px] font-semibold uppercase tracking-wider text-[#F0F0F5]/60">{$t('profile.bio')}</label>
          <textarea
            id="playlist-desc-input"
            bind:value={description}
            rows="2"
            placeholder="..."
            class="w-full py-2 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-[#3093AA] focus:outline-none text-xs text-[#F0F0F5] placeholder:text-[#F0F0F5]/30 transition resize-none"
          ></textarea>
        </div>

        <!-- Seletor de Visibilidade Social / Nuvem -->
        <div class="flex flex-col gap-1.5">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-[#F0F0F5]/60">{$t('editPlaylistModal.visibilityLabel')}</span>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              onclick={() => visibility = 'public'}
              class="p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-center transition cursor-pointer {visibility === 'public' ? 'liquid-glass border-[#3093AA] text-[#3093AA]' : 'border-white/[0.08] bg-white/[0.02] text-[#F0F0F5]/50 hover:text-[#F0F0F5]'}"
            >
              <Globe class="w-4 h-4" />
              <span class="text-[11px] font-bold">{$t('common.public')}</span>
            </button>

            <button
              type="button"
              onclick={() => visibility = 'shared'}
              class="p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-center transition cursor-pointer {visibility === 'shared' ? 'liquid-glass border-[#F3B044] text-[#F3B044]' : 'border-white/[0.08] bg-white/[0.02] text-[#F0F0F5]/50 hover:text-[#F0F0F5]'}"
            >
              <Share2 class="w-4 h-4" />
              <span class="text-[11px] font-bold">{$t('common.friends')}</span>
            </button>

            <button
              type="button"
              onclick={() => visibility = 'private'}
              class="p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-center transition cursor-pointer {visibility === 'private' ? 'liquid-glass border-[#EF7D4B] text-[#EF7D4B]' : 'border-white/[0.08] bg-white/[0.02] text-[#F0F0F5]/50 hover:text-[#F0F0F5]'}"
            >
              <Lock class="w-4 h-4" />
              <span class="text-[11px] font-bold">{$t('common.private')}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08] shrink-0">
        <button
          onclick={close}
          class="px-4 py-2 rounded-xl text-xs text-[#F0F0F5]/60 hover:text-white transition cursor-pointer"
        >
          {$t('common.cancel')}
        </button>
        <button
          onclick={handleSubmit}
          disabled={!name.trim()}
          class="px-4 py-2 rounded-xl bg-[#3093AA] hover:bg-[#3093AA]/90 text-[#121216] font-semibold text-xs transition disabled:opacity-50 cursor-pointer shadow-md shadow-[#3093AA]/20"
        >
          {$t('modals.createPlaylistBtn')}
        </button>
      </div>
    </div>
  </div>
{/if}
