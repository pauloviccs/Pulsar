<script lang="ts">
  import { X, Link2, Download, Play, Plus, Loader2, Sparkles, AlertCircle, ListMusic, Music, Disc3, CheckCircle2, AlertTriangle, Clipboard, ExternalLink, Key } from '@lucide/svelte';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { isAddLinkModalOpen, libraryActions } from '../stores/libraryStore';
  import { playerActions } from '../stores/playerStore';
  import { t } from '../i18n';
  import type { Track, Playlist, LinkDetection, SpotifyImportProgress } from '../types';
  import { safeInvoke } from '../api/tauri';

  let url = $state<string>('');
  let isResolving = $state<boolean>(false);
  let resolvedTrack = $state<Track | null>(null);
  let resolvedPlaylist = $state<Playlist | null>(null);
  let errorMessage = $state<string | null>(null);
  let linkDetection = $state<LinkDetection | null>(null);
  let spotifyProgress = $state<SpotifyImportProgress | null>(null);
  let importStats = $state<{ high: number; medium: number; low: number; notFound: number } | null>(null);

  // Configuração rápida de credenciais Spotify
  let showSpotifyConfig = $state<boolean>(false);
  let spotifyClientId = $state<string>('');
  let spotifyClientSecret = $state<string>('');
  let isSavingSpotify = $state<boolean>(false);

  async function loadSpotifyCredentials() {
    try {
      const creds = await safeInvoke<{ client_id: string; client_secret: string; is_default: boolean }>('get_spotify_credentials');
      if (creds && !creds.is_default) {
        spotifyClientId = creds.client_id;
        spotifyClientSecret = creds.client_secret;
      }
    } catch {
      // Ignorar falha silenciosa
    }
  }

  async function handleSaveSpotifyCredentials() {
    if (!spotifyClientId.trim() || !spotifyClientSecret.trim()) return;
    isSavingSpotify = true;
    errorMessage = null;
    try {
      await safeInvoke('configure_spotify_credentials', {
        clientId: spotifyClientId.trim(),
        clientSecret: spotifyClientSecret.trim(),
      });
      showSpotifyConfig = false;
      // Re-executar a análise do link automaticamente
      await handleAnalyze();
    } catch (err) {
      errorMessage = typeof err === 'string' ? err : 'Falha ao salvar credenciais do Spotify.';
    } finally {
      isSavingSpotify = false;
    }
  }

  // Detectar plataforma ao digitar/colar
  let detectDebounce: ReturnType<typeof setTimeout> | null = null;

  function onUrlChange() {
    if (detectDebounce) clearTimeout(detectDebounce);
    linkDetection = null;

    if (!url.trim()) return;

    detectDebounce = setTimeout(async () => {
      try {
        const detection = await safeInvoke<LinkDetection>('detect_link_platform', { url: url.trim() });
        linkDetection = detection;
      } catch {
        linkDetection = null;
      }
    }, 300);
  }

  $effect(() => {
    url; // track dependency
    onUrlChange();
  });

  // Ícone e cor da plataforma detectada
  let platformBadge = $derived.by(() => {
    if (!linkDetection) return null;
    switch (linkDetection.platform) {
      case 'youtube':
        return { label: 'YouTube', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: Play };
      case 'youtube_music':
        return { label: 'YouTube Music', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: Music };
      case 'spotify':
        return { label: 'Spotify', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: Disc3 };
      default:
        return { label: $t('modals.unknownPlatform'), color: 'bg-white/10 text-white/50 border-white/20', icon: Link2 };
    }
  });

  let isPlaylistOrAlbum = $derived(
    linkDetection?.link_type === 'playlist' || linkDetection?.link_type === 'album'
  );

  async function handlePasteClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        url = text;
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
    spotifyProgress = null;
    importStats = null;

    try {
      // Detectar plataforma se não detectado ainda
      if (!linkDetection) {
        linkDetection = await safeInvoke<LinkDetection>('detect_link_platform', { url: url.trim() });
      }

      const platform = linkDetection?.platform || 'unknown';
      const linkType = linkDetection?.link_type || 'unknown';
      const normalizedUrl = linkDetection?.normalized_url || url.trim();

      if (platform === 'spotify') {
        await handleSpotifyImport(normalizedUrl, linkType);
      } else if (platform === 'youtube' || platform === 'youtube_music') {
        await handleYouTubeImport(normalizedUrl, linkType);
      } else {
        // Tentar como YouTube padrão
        await handleYouTubeImport(url.trim(), 'unknown');
      }
    } catch (err) {
      console.error('[Pulsar] Erro na resolução:', err);
      const str = typeof err === 'string' ? err : '';
      if (str.includes('invalid_client') || str.includes('Credenciais') || str.includes('Spotify não configuradas') || str.includes('autenticação')) {
        showSpotifyConfig = true;
        loadSpotifyCredentials();
        errorMessage = 'Para importar playlists e músicas do Spotify, configure seu Client ID e Client Secret gratuitos do Spotify abaixo.';
      } else {
        errorMessage = str || $t('modals.analyzeFailed');
      }
    } finally {
      isResolving = false;
    }
  }

  async function handleYouTubeImport(targetUrl: string, linkType: string) {
    if (linkType === 'playlist') {
      const pl = await safeInvoke<Playlist>('resolve_playlist', { url: targetUrl });
      resolvedPlaylist = pl;
      libraryActions.addPlaylist(pl);
    } else {
      const track = await safeInvoke<Track>('resolve_track', { url: targetUrl });
      resolvedTrack = track;
    }
  }

  async function handleSpotifyImport(targetUrl: string, linkType: string) {
    if (linkType === 'track') {
      const track = await safeInvoke<Track>('resolve_spotify_track', { url: targetUrl });
      resolvedTrack = track;
    } else {
      // Playlist ou álbum — escutar progresso
      const stats = { high: 0, medium: 0, low: 0, notFound: 0 };

      // Listener de progresso via Tauri events
      let unlisten: (() => void) | null = null;
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<SpotifyImportProgress>('spotify-import-progress', (event) => {
          spotifyProgress = event.payload;
          // Acumular stats de confiança
          switch (event.payload.confidence) {
            case 'high': stats.high++; break;
            case 'medium': stats.medium++; break;
            case 'low': stats.low++; break;
            case 'not_found': stats.notFound++; break;
          }
        });
      } catch {
        // Fallback web — sem eventos
      }

      try {
        const pl = await safeInvoke<Playlist>('resolve_spotify_playlist', { url: targetUrl });
        resolvedPlaylist = pl;
        libraryActions.addPlaylist(pl);
        importStats = stats;
      } finally {
        if (unlisten) unlisten();
        spotifyProgress = null;
      }
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
    linkDetection = null;
    spotifyProgress = null;
    importStats = null;
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
            {#if isPlaylistOrAlbum}
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
      <div class="flex-1 overflow-y-auto flex flex-col gap-4 pr-1 py-3">
        <!-- Input Area com Botão Colar Separado (Sem Sobreposição) -->
        <div class="flex flex-col gap-2.5">
          <div class="flex items-center gap-2">
            <div class="relative flex-1 min-w-0">
              <input
                type="text"
                bind:value={url}
                placeholder={$t('modals.pastePlaceholder')}
                onkeydown={(e) => { if (e.key === 'Enter') handleAnalyze(); }}
                class="w-full py-2.5 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-[#66D7D1] focus:outline-none text-xs text-[#F2EFEA] placeholder:text-[#F2EFEA]/30 transition"
              />
            </div>
            <button
              type="button"
              onclick={handlePasteClipboard}
              class="shrink-0 px-3 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-[#66D7D1] transition cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Colar da área de transferência"
            >
              <Clipboard class="w-3.5 h-3.5" />
              <span>Colar</span>
            </button>
          </div>

          <!-- Badge de Plataforma Detectada -->
          {#if platformBadge}
            {@const badge = platformBadge}
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border {badge.color} transition-all animate-[scale-up_0.15s_ease-out]">
                  <badge.icon class="w-3 h-3" />
                  {badge.label}
                </span>
                {#if linkDetection?.link_type && linkDetection.link_type !== 'unknown'}
                  <span class="text-[10px] text-[#F2EFEA]/40 capitalize">
                    {linkDetection.link_type === 'album' ? 'Álbum' : linkDetection.link_type === 'playlist' ? 'Playlist' : 'Música'}
                  </span>
                {/if}
              </div>

              {#if linkDetection?.platform === 'spotify'}
                <button
                  type="button"
                  onclick={() => { showSpotifyConfig = !showSpotifyConfig; if (showSpotifyConfig) loadSpotifyCredentials(); }}
                  class="inline-flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300 font-medium transition cursor-pointer hover:underline"
                >
                  <Key class="w-3 h-3" />
                  <span>{showSpotifyConfig ? 'Ocultar API' : 'Configurar API Spotify'}</span>
                </button>
              {/if}
            </div>
          {/if}

          <!-- Painel Inline de Configuração da API Spotify -->
          {#if showSpotifyConfig}
            <div class="flex flex-col gap-3 p-4 rounded-2xl bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border border-green-500/30 animate-[scale-up_0.2s_ease-out]">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2.5">
                  <div class="p-2 rounded-xl bg-green-500/20 text-green-400 shrink-0">
                    <Key class="w-4 h-4" />
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-[#F2EFEA]">Credenciais da API Spotify</h4>
                    <p class="text-[10px] text-white/50">Gratuito para qualquer conta Spotify</p>
                  </div>
                </div>
                <button
                  type="button"
                  onclick={() => showSpotifyConfig = false}
                  class="p-1 text-white/40 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>

              <div class="text-[11px] text-white/70 space-y-1.5 bg-black/30 p-2.5 rounded-xl border border-white/[0.06]">
                <p class="text-white/80">1. Acesse o portal e crie um App (gratuito em 30 seg):</p>
                <button
                  type="button"
                  onclick={() => openUrl('https://developer.spotify.com/dashboard')}
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 font-semibold transition cursor-pointer text-[10px]"
                >
                  <span>developer.spotify.com/dashboard</span>
                  <ExternalLink class="w-3 h-3" />
                </button>
                <p class="text-white/80 pt-1">2. Copie o <b>Client ID</b> e o <b>Client Secret</b> (em Basic Information) e cole abaixo:</p>
              </div>

              <div class="flex flex-col gap-2">
                <input
                  type="text"
                  bind:value={spotifyClientId}
                  placeholder="Spotify Client ID"
                  class="w-full py-2 px-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs font-mono text-[#F2EFEA] placeholder:text-white/30 focus:border-green-400 focus:outline-none transition"
                />
                <input
                  type="password"
                  bind:value={spotifyClientSecret}
                  placeholder="Spotify Client Secret"
                  class="w-full py-2 px-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs font-mono text-[#F2EFEA] placeholder:text-white/30 focus:border-green-400 focus:outline-none transition"
                />
                <button
                  type="button"
                  onclick={handleSaveSpotifyCredentials}
                  disabled={isSavingSpotify || !spotifyClientId.trim() || !spotifyClientSecret.trim()}
                  class="w-full py-2 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-green-500/20 active:scale-95"
                >
                  {#if isSavingSpotify}
                    <Loader2 class="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando e processando...</span>
                  {:else}
                    <CheckCircle2 class="w-3.5 h-3.5" />
                    <span>Salvar e Importar</span>
                  {/if}
                </button>
              </div>
            </div>
          {/if}

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

        <!-- Barra de Progresso Spotify -->
        {#if spotifyProgress}
          <div class="flex flex-col gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 animate-[scale-up_0.2s_ease-out]">
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-green-400 font-medium">
                {$t('modals.spotifySearching').replace('{track}', spotifyProgress.current_track_title)}
              </span>
              <span class="text-[#F2EFEA]/50 font-mono">
                {spotifyProgress.current}/{spotifyProgress.total}
              </span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div 
                class="h-full rounded-full bg-gradient-to-r from-green-500 to-[#66D7D1] transition-all duration-300"
                style="width: {(spotifyProgress.current / spotifyProgress.total) * 100}%"
              ></div>
            </div>
          </div>
        {/if}

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
              <span class="text-[10px] font-mono text-[#66D7D1]">
                {#if linkDetection?.platform === 'spotify'}
                  Spotify → YouTube (Stream Local)
                {:else}
                  Áudio Pronto (Stream Local)
                {/if}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-3 pt-1">
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

        <!-- Playlist/Álbum Importado -->
        {#if resolvedPlaylist}
          <div class="glass-card rounded-xl p-3.5 flex items-center gap-3.5 border border-[#66D7D1]/30 animate-[scale-up_0.2s_ease-out]">
            <img src={resolvedPlaylist.cover_image} alt="" class="w-12 h-12 rounded-lg object-cover shadow-sm" />
            <div class="flex-1 min-w-0">
              <h4 class="text-xs font-semibold text-[#F2EFEA] truncate">{resolvedPlaylist.name}</h4>
              <p class="text-[11px] text-[#F2EFEA]/50 truncate">{resolvedPlaylist.track_count} {$t('modals.tracksImported')}</p>
              <span class="text-[10px] font-mono text-[#66D7D1]">{$t('modals.savedToSQLite')}</span>
            </div>
          </div>

          <!-- Relatório de Confiança (Spotify) -->
          {#if importStats}
            <div class="flex flex-col gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              {#if importStats.high > 0}
                <div class="flex items-center gap-2 text-[11px] text-green-400">
                  <CheckCircle2 class="w-3.5 h-3.5" />
                  <span>{$t('modals.spotifyHighConfidence').replace('{count}', String(importStats.high))}</span>
                </div>
              {/if}
              {#if importStats.medium > 0}
                <div class="flex items-center gap-2 text-[11px] text-yellow-400">
                  <AlertTriangle class="w-3.5 h-3.5" />
                  <span>{$t('modals.spotifyLowConfidence').replace('{count}', String(importStats.medium + importStats.low))}</span>
                </div>
              {/if}
              {#if importStats.notFound > 0}
                <div class="flex items-center gap-2 text-[11px] text-red-400">
                  <AlertCircle class="w-3.5 h-3.5" />
                  <span>{$t('modals.spotifyNoMatch').replace('{count}', String(importStats.notFound))}</span>
                </div>
              {/if}
            </div>
          {/if}

          <div class="flex items-center gap-3 pt-1">
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
