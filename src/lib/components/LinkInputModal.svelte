<script lang="ts">
  import { X, Link2, Download, Play, Plus, Loader2, Sparkles, AlertCircle, ListMusic } from '@lucide/svelte';
  import { isAddLinkModalOpen, libraryActions } from '../stores/libraryStore';
  import { playerActions } from '../stores/playerStore';
  import { t } from '../i18n';
  import type { Track, Playlist } from '../types';
  import { safeInvoke } from '../api/tauri';

  let url = $state<string>('');
  let isResolving = $state<boolean>(false);
  let resolvedTrack = $state<Track | null>(null);
  let resolvedPlaylist = $state<Playlist | null>(null);
  let errorMessage = $state<string | null>(null);
  function cleanUrl(inputUrl: string): string {
    let clean = inputUrl.trim();
    if (clean.includes('music.youtube.com')) {
      clean = clean.replace('music.youtube.com', 'www.youtube.com');
    }
    // Se for faixa única com mix automático de rádio, remover &list= para resolver faixa única
    if (clean.includes('watch?v=') && clean.includes('&list=')) {
      clean = clean.split('&list=')[0];
    }
    return clean;
  }

  let isPlaylistUrl = $derived(
    (url.includes('/playlist') || url.includes('list=')) && !url.includes('/watch?v=')
  );

  async function handlePasteClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        url = text;
        handleAnalyze();
      }
    } catch {
      // Navegador pode bloquear se sem foco
    }
  }

  async function handleAnalyze() {
    if (!url.trim()) return;
    isResolving = true;
    errorMessage = null;
    resolvedTrack = null;
    resolvedPlaylist = null;

    const targetUrl = cleanUrl(url);

    try {
      if (isPlaylistUrl) {
        const pl = await safeInvoke<Playlist>('resolve_playlist', { url: targetUrl });
        resolvedPlaylist = pl;
        libraryActions.addPlaylist(pl);
      } else {
        const track = await safeInvoke<Track>('resolve_track', { url: targetUrl });
        resolvedTrack = track;
      }
    } catch (err) {
      console.error('[Pulsar] Erro na resolução via yt-dlp:', err);
      errorMessage = typeof err === 'string' ? err : 'Falha ao extrair do YouTube. Verifique a conexão e o link.';
    } finally {
      isResolving = false;
    }
  }

  function handlePlayNow() {
    if (!resolvedTrack) return;
    libraryActions.addTrack(resolvedTrack);
    playerActions.playTrack(resolvedTrack);
    close();
  }

  function handleAddToQueue() {
    if (!resolvedTrack) return;
    libraryActions.addTrack(resolvedTrack);
    playerActions.addToQueue(resolvedTrack);
    close();
  }

  function handleOpenPlaylist() {
    if (!resolvedPlaylist) return;
    libraryActions.setActiveView('playlist-detail', resolvedPlaylist);
    close();
  }

  function close() {
    isAddLinkModalOpen.set(false);
    url = '';
    resolvedTrack = null;
    resolvedPlaylist = null;
    errorMessage = null;
  }
</script>

{#if $isAddLinkModalOpen}
  <div 
    role="presentation"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-[fade-in_0.2s_ease-out]"
    onclick={close}
  >
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="glass-panel w-full max-w-lg max-h-[88vh] rounded-3xl p-5 sm:p-6 flex flex-col shadow-2xl border border-white/[0.1] text-[#F2EFEA] overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Escape') close(); }}
    >
      <!-- Modal Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="p-2 rounded-lg bg-[#FC7753]/20 text-[#FC7753] shrink-0">
            {#if isPlaylistUrl}
              <ListMusic class="w-5 h-5" />
            {:else}
              <Link2 class="w-5 h-5" />
            {/if}
          </div>
          <div class="min-w-0">
            <h2 class="text-sm font-semibold tracking-tight text-[#F2EFEA] truncate">
              {$t('modals.pasteLinkTitle')}
            </h2>
            <p class="text-[11px] text-[#F2EFEA]/50 truncate">
              {$t('modals.pasteLinkDesc')}
            </p>
          </div>
        </div>

        <button
          onclick={close}
          class="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition cursor-pointer shrink-0"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Conteúdo Interno Rolável Defensivo -->
      <div class="flex-1 overflow-y-auto flex flex-col gap-5 pr-1 py-3">
        <!-- Input Area -->
        <div class="flex flex-col gap-2">
        <div class="relative flex items-center">
          <input
            type="text"
            bind:value={url}
            placeholder={$t('modals.pastePlaceholder')}
            onkeydown={(e) => { if (e.key === 'Enter') handleAnalyze(); }}
            class="w-full py-2.5 pl-3.5 pr-20 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-[#66D7D1] focus:outline-none text-xs text-[#F2EFEA] placeholder:text-[#F2EFEA]/30 transition"
          />
          <button
            onclick={handlePasteClipboard}
            class="absolute right-2 px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-[10px] font-semibold text-[#66D7D1] transition cursor-pointer"
          >
            {$t('sidebar.pasteLink')}
          </button>
        </div>

        <button
          onclick={handleAnalyze}
          disabled={isResolving || !url.trim()}
          class="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-[#F2EFEA] flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
        >
          {#if isResolving}
            <Loader2 class="w-4 h-4 animate-spin text-[#66D7D1]" />
            <span>{$t('modals.analyzing')}</span>
          {:else}
            <Sparkles class="w-4 h-4 text-[#FC7753]" />
            <span>{$t('modals.analyzeBtn')}</span>
          {/if}
        </button>
      </div>

      <!-- Erro -->
      {#if errorMessage}
        <div class="p-3 rounded-xl bg-[#FC7753]/15 border border-[#FC7753]/30 flex items-center gap-2.5 text-xs text-[#FC7753]">
          <AlertCircle class="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      {/if}

      <!-- Faixa Única Detectada -->
      {#if resolvedTrack}
        <div class="glass-card rounded-xl p-3.5 flex items-center gap-3.5 border border-[#66D7D1]/30 animate-[scale-up_0.2s_ease-out]">
          <img src={resolvedTrack.thumbnail_url} alt="" class="w-12 h-12 rounded-lg object-cover shadow-sm" />
          <div class="flex-1 min-w-0">
            <h4 class="text-xs font-semibold text-[#F2EFEA] truncate">{resolvedTrack.title}</h4>
            <p class="text-[11px] text-[#F2EFEA]/50 truncate">{resolvedTrack.artist_guess || resolvedTrack.channel_name}</p>
            <span class="text-[10px] font-mono text-[#66D7D1]">Áudio Pronto (Stream Local)</span>
          </div>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button
            onclick={handlePlayNow}
            class="flex-1 py-2.5 rounded-xl bg-[#FC7753] hover:bg-[#FC7753]/90 text-[#F2EFEA] text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[#FC7753]/20 transition cursor-pointer"
          >
            <Play class="w-3.5 h-3.5 fill-current" />
            <span>{$t('playlistDetail.play')}</span>
          </button>

          <button
            onclick={handleAddToQueue}
            class="py-2.5 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-[#F2EFEA] text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>{$t('player.queue')}</span>
          </button>
        </div>
      {/if}

      <!-- Playlist Importada Detectada -->
      {#if resolvedPlaylist}
        <div class="glass-card rounded-xl p-3.5 flex items-center gap-3.5 border border-[#66D7D1]/30 animate-[scale-up_0.2s_ease-out]">
          <img src={resolvedPlaylist.cover_image} alt="" class="w-12 h-12 rounded-lg object-cover shadow-sm" />
          <div class="flex-1 min-w-0">
            <h4 class="text-xs font-semibold text-[#F2EFEA] truncate">{resolvedPlaylist.name}</h4>
            <p class="text-[11px] text-[#F2EFEA]/50 truncate">{resolvedPlaylist.track_count} faixas importadas com sucesso</p>
            <span class="text-[10px] font-mono text-[#66D7D1]">Salvo no SQLite</span>
          </div>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button
            onclick={handleOpenPlaylist}
            class="w-full py-2.5 rounded-xl bg-[#66D7D1] hover:bg-[#66D7D1]/90 text-[#121216] text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#66D7D1]/20 transition cursor-pointer"
          >
            <ListMusic class="w-4 h-4" />
            <span>{$t('playlistDetail.backToLibrary')}</span>
          </button>
        </div>
      {/if}
      </div>
    </div>
  </div>
{/if}
