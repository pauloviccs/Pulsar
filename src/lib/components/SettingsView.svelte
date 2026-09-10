<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    Settings, 
    Sliders, 
    HardDrive, 
    AppWindow, 
    User, 
    Radio, 
    LogOut, 
    Trash2, 
    Check, 
    Sparkles, 
    Layers, 
    Volume2, 
    RefreshCw,
    Globe,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    X,
    Copy,
    KeyRound,
    ChevronDown,
    ChevronUp
  } from '@lucide/svelte';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { 
    crossfadeSeconds, 
    audioNormalization, 
    minimizeToTray, 
    lastFmEnabled, 
    lastFmUsername, 
    playerActions 
  } from '../stores/playerStore';
  import { currentProfile, authActions, isAuthModalOpen } from '../stores/authStore';
  import { safeInvoke } from '../api/tauri';
  import { 
    currentLocale, 
    setLocale, 
    restartApplication, 
    SUPPORTED_LOCALES, 
    t 
  } from '../i18n';
  import type { SupportedLocale, LocaleInfo } from '../i18n/types';
  import { 
    lastFmService, 
    lastFmConnected, 
    lastFmAccountName 
  } from '../services/lastfm';

  let cacheSize = $state('Calculando...');
  let cacheFiles = $state(0);
  let isClearingCache = $state(false);
  let cacheClearFeedback = $state<string | null>(null);

  // Estado do Modal de Reinício de Idioma
  let showRestartModal = $state(false);
  let newlySelectedLocale = $state<LocaleInfo | null>(null);

  // Estado de Autenticação do Last.fm
  let isConnectingLastFm = $state(false);
  let lastFmAuthToken = $state<string | null>(null);
  let lastFmAuthDirectUrl = $state<string | null>(null);
  let copiedAuthUrl = $state(false);
  let lastFmError = $state<string | null>(null);
  let lastFmSuccess = $state<string | null>(null);

  // Chaves de API Personalizadas da Last.fm
  let showAdvancedLastFm = $state(false);
  let customApiKey = $state(typeof window !== 'undefined' ? localStorage.getItem('pulsar_lastfm_custom_key') || '' : '');
  let customApiSecret = $state(typeof window !== 'undefined' ? localStorage.getItem('pulsar_lastfm_custom_secret') || '' : '');
  let savedCustomKeysNotice = $state(false);

  onMount(async () => {
    await updateCacheInfo();
  });

  async function updateCacheInfo() {
    try {
      const info = await safeInvoke<{ formatted_size: string; file_count: number }>('get_cache_info');
      if (info) {
        cacheSize = info.formatted_size;
        cacheFiles = info.file_count;
      }
    } catch {
      cacheSize = '0 MB';
      cacheFiles = 0;
    }
  }

  async function handleClearCache() {
    isClearingCache = true;
    cacheClearFeedback = null;
    try {
      const res = await safeInvoke<{ formatted_size: string; file_count: number }>('clear_audio_cache');
      if (res) {
        cacheClearFeedback = `${$t('common.success')}! ${res.formatted_size}`;
        await updateCacheInfo();
      }
    } catch (e) {
      cacheClearFeedback = $t('common.error');
    } finally {
      isClearingCache = false;
      setTimeout(() => {
        cacheClearFeedback = null;
      }, 3500);
    }
  }

  function handleSelectLanguage(loc: LocaleInfo) {
    if (loc.code === $currentLocale) return;
    setLocale(loc.code);
    newlySelectedLocale = loc;
    showRestartModal = true;
  }

  async function handleStartLastFmAuth() {
    isConnectingLastFm = true;
    lastFmError = null;
    lastFmSuccess = null;
    try {
      const token = await lastFmService.getAuthToken();
      lastFmAuthToken = token;
      const authUrl = lastFmService.getAuthUrl(token);
      lastFmAuthDirectUrl = authUrl;
      try {
        await openUrl(authUrl);
      } catch (openerErr) {
        console.warn('[Pulsar Last.fm] Falha ao abrir via plugin-opener:', openerErr);
        try { window.open(authUrl, '_blank'); } catch {}
      }
    } catch (err: any) {
      lastFmError = err.message || 'Erro ao comunicar com Last.fm';
    } finally {
      isConnectingLastFm = false;
    }
  }

  async function handleOpenAuthUrlManually() {
    if (!lastFmAuthDirectUrl) return;
    try {
      await openUrl(lastFmAuthDirectUrl);
    } catch {
      window.open(lastFmAuthDirectUrl, '_blank');
    }
  }

  async function handleCopyAuthUrl() {
    if (!lastFmAuthDirectUrl) return;
    try {
      await navigator.clipboard.writeText(lastFmAuthDirectUrl);
      copiedAuthUrl = true;
      setTimeout(() => { copiedAuthUrl = false; }, 2500);
    } catch (err) {
      console.error('Erro ao copiar URL:', err);
    }
  }

  function handleSaveCustomKeys() {
    if (typeof window !== 'undefined') {
      if (customApiKey.trim()) {
        localStorage.setItem('pulsar_lastfm_custom_key', customApiKey.trim());
      } else {
        localStorage.removeItem('pulsar_lastfm_custom_key');
      }
      if (customApiSecret.trim()) {
        localStorage.setItem('pulsar_lastfm_custom_secret', customApiSecret.trim());
      } else {
        localStorage.removeItem('pulsar_lastfm_custom_secret');
      }
      savedCustomKeysNotice = true;
      setTimeout(() => { savedCustomKeysNotice = false; }, 3000);
    }
  }

  function handleResetCustomKeys() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pulsar_lastfm_custom_key');
      localStorage.removeItem('pulsar_lastfm_custom_secret');
      customApiKey = '';
      customApiSecret = '';
      savedCustomKeysNotice = true;
      setTimeout(() => { savedCustomKeysNotice = false; }, 3000);
    }
  }

  async function handleCompleteLastFmAuth() {
    if (!lastFmAuthToken) return;
    isConnectingLastFm = true;
    lastFmError = null;
    try {
      const { name } = await lastFmService.createSession(lastFmAuthToken);
      lastFmSuccess = `Conectado com sucesso como @${name}!`;
      playerActions.setLastFm(true, name);
      lastFmAuthToken = null;
      lastFmAuthDirectUrl = null;
    } catch (err: any) {
      lastFmError = err.message || 'Autorização não confirmada. Certifique-se de ter aceito no navegador.';
    } finally {
      isConnectingLastFm = false;
    }
  }

  function handleDisconnectLastFm() {
    lastFmService.disconnect();
    playerActions.setLastFm(false, '');
    lastFmAuthToken = null;
    lastFmAuthDirectUrl = null;
    lastFmSuccess = null;
    lastFmError = null;
  }

  function handleLogout() {
    authActions.logout();
  }
</script>

<div class="flex flex-col gap-8 max-w-4xl mx-auto w-full pb-20 text-[#F2EFEA]">
  <!-- Header de Configurações -->
  <div class="flex items-center gap-3.5 pb-2 border-b border-white/[0.08]">
    <div class="p-3 rounded-2xl bg-[#66D7D1]/15 text-[#66D7D1] border border-[#66D7D1]/30 shadow-lg shadow-[#66D7D1]/10">
      <Settings class="w-6 h-6" />
    </div>
    <div>
      <h1 class="text-2xl font-extrabold tracking-tight text-[#F2EFEA]">{$t('settings.title')}</h1>
      <p class="text-xs text-[#F2EFEA]/50">{$t('settings.subtitle')}</p>
    </div>
  </div>

  <!-- SEÇÃO 1: IDIOMA DO APLICATIVO (6 IDIOMAS) -->
  <div class="liquid-glass rounded-3xl p-6 border border-white/[0.12] flex flex-col gap-5 shadow-xl">
    <div class="flex items-center gap-2.5">
      <Globe class="w-5 h-5 text-[#66D7D1]" />
      <h2 class="text-sm font-bold tracking-tight text-[#F2EFEA] uppercase">{$t('settings.language')}</h2>
    </div>

    <p class="text-xs text-white/60">{$t('settings.languageDesc')}</p>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
      {#each SUPPORTED_LOCALES as loc}
        <button
          type="button"
          onclick={() => handleSelectLanguage(loc)}
          class="flex items-center gap-3 p-3.5 rounded-2xl border transition text-left cursor-pointer {loc.code === $currentLocale ? 'bg-[#66D7D1]/15 border-[#66D7D1]/50 text-[#F2EFEA] shadow-md shadow-[#66D7D1]/10' : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.07] text-white/70'}"
        >
          <span class="text-2xl">{loc.flag}</span>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold leading-tight truncate {loc.code === $currentLocale ? 'text-[#66D7D1]' : 'text-[#F2EFEA]'}">{loc.nativeName}</p>
            <p class="text-[10px] text-white/40 truncate">{loc.name}</p>
          </div>
          {#if loc.code === $currentLocale}
            <div class="w-2 h-2 rounded-full bg-[#66D7D1] shadow-sm shadow-[#66D7D1]"></div>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- SEÇÃO 2: REPRODUÇÃO & MIXAGEM (CROSSFADE SPOTIFY-LIKE) -->
  <div class="liquid-glass rounded-3xl p-6 border border-white/[0.12] flex flex-col gap-5 shadow-xl">
    <div class="flex items-center gap-2.5">
      <Sliders class="w-5 h-5 text-[#FC7753]" />
      <h2 class="text-sm font-bold tracking-tight text-[#F2EFEA] uppercase">{$t('settings.playback')}</h2>
    </div>

    <!-- Controle de Crossfade -->
    <div class="flex flex-col gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-[#F2EFEA]">{$t('settings.crossfade')}</p>
          <p class="text-[11px] text-white/50">{$t('settings.crossfadeDesc')}</p>
        </div>
        <span class="px-2.5 py-1 rounded-xl bg-white/[0.06] text-xs font-mono font-bold text-[#66D7D1]">
          {$crossfadeSeconds === 0 ? $t('common.disabled') : `${$crossfadeSeconds}s`}
        </span>
      </div>

      <div class="flex items-center gap-3 pt-1">
        <span class="text-[10px] font-mono text-white/40">0s</span>
        <input
          type="range"
          min="0"
          max="12"
          step="1"
          value={$crossfadeSeconds}
          oninput={(e) => playerActions.setCrossfade(parseInt((e.target as HTMLInputElement).value))}
          class="flex-1 h-1.5 bg-white/[0.1] rounded-full appearance-none cursor-pointer accent-[#66D7D1]"
        />
        <span class="text-[10px] font-mono text-white/40">12s</span>
      </div>
    </div>

    <!-- Normalização de Volume -->
    <div class="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      <div>
        <p class="text-xs font-bold text-[#F2EFEA]">{$t('settings.normalization')}</p>
        <p class="text-[11px] text-white/50">{$t('settings.normalizationDesc')}</p>
      </div>

      <button
        type="button"
        aria-label="Ativar ou desativar normalização de áudio"
        onclick={() => playerActions.toggleNormalization()}
        class="w-12 h-6 rounded-full p-0.5 transition cursor-pointer {$audioNormalization ? 'bg-[#66D7D1]' : 'bg-white/[0.1]'}"
      >
        <div class="w-5 h-5 rounded-full bg-white transition-transform {$audioNormalization ? 'translate-x-6' : 'translate-x-0'}"></div>
      </button>
    </div>
  </div>

  <!-- SEÇÃO 3: COMPORTAMENTO DA JANELA (TRAY) -->
  <div class="liquid-glass rounded-3xl p-6 border border-white/[0.12] flex flex-col gap-5 shadow-xl">
    <div class="flex items-center gap-2.5">
      <AppWindow class="w-5 h-5 text-[#DBD56E]" />
      <h2 class="text-sm font-bold tracking-tight text-[#F2EFEA] uppercase">{$t('settings.windowBehavior')}</h2>
    </div>

    <div class="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      <div>
        <p class="text-xs font-bold text-[#F2EFEA]">{$t('settings.minimizeTray')}</p>
        <p class="text-[11px] text-white/50">{$t('settings.minimizeTrayDesc')}</p>
      </div>

      <button
        type="button"
        aria-label="Ativar ou desativar minimizar para bandeja ao fechar"
        onclick={() => playerActions.toggleMinimizeToTray()}
        class="w-12 h-6 rounded-full p-0.5 transition cursor-pointer {$minimizeToTray ? 'bg-[#DBD56E]' : 'bg-white/[0.1]'}"
      >
        <div class="w-5 h-5 rounded-full bg-white transition-transform {$minimizeToTray ? 'translate-x-6' : 'translate-x-0'}"></div>
      </button>
    </div>
  </div>

  <!-- SEÇÃO 4: ARMAZENAMENTO & CACHE LOCAL -->
  <div class="liquid-glass rounded-3xl p-6 border border-white/[0.12] flex flex-col gap-5 shadow-xl">
    <div class="flex items-center gap-2.5">
      <HardDrive class="w-5 h-5 text-[#66D7D1]" />
      <h2 class="text-sm font-bold tracking-tight text-[#F2EFEA] uppercase">{$t('settings.storage')}</h2>
    </div>

    <div class="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      <div>
        <div class="flex items-center gap-2">
          <p class="text-xs font-bold text-[#F2EFEA]">{$t('settings.audioCache')}</p>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-[#66D7D1]/15 text-[#66D7D1] font-mono font-bold">
            {cacheSize} ({cacheFiles} itens)
          </span>
        </div>
        <p class="text-[11px] text-white/50 pt-0.5">{$t('settings.audioCacheDesc')}</p>
      </div>

      <button
        type="button"
        onclick={handleClearCache}
        disabled={isClearingCache}
        class="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FC7753]/20 hover:bg-[#FC7753]/30 border border-[#FC7753]/40 text-xs font-bold text-[#FC7753] transition cursor-pointer disabled:opacity-50"
      >
        {#if isClearingCache}
          <RefreshCw class="w-3.5 h-3.5 animate-spin" />
          <span>{$t('settings.clearing')}</span>
        {:else}
          <Trash2 class="w-3.5 h-3.5" />
          <span>{$t('settings.clearCache')}</span>
        {/if}
      </button>
    </div>

    {#if cacheClearFeedback}
      <div class="p-3 rounded-2xl bg-[#66D7D1]/15 border border-[#66D7D1]/30 flex items-center gap-2 text-xs text-[#66D7D1] animate-in fade-in">
        <Check class="w-4 h-4" />
        <span>{cacheClearFeedback}</span>
      </div>
    {/if}
  </div>

  <!-- SEÇÃO 5: INTEGRAÇÃO COM LAST.FM OFICIAL -->
  <div class="liquid-glass rounded-3xl p-6 border border-white/[0.12] flex flex-col gap-5 shadow-xl">
    <div class="flex items-center gap-2.5">
      <Radio class="w-5 h-5 text-[#FC7753]" />
      <h2 class="text-sm font-bold tracking-tight text-[#F2EFEA] uppercase">{$t('settings.lastfm')}</h2>
    </div>

    <div class="flex flex-col gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-[#F2EFEA]">Scrobble Automático (API 2.0)</p>
          <p class="text-[11px] text-white/50">{$t('settings.lastfmDesc')}</p>
        </div>

        {#if $lastFmConnected}
          <span class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#66D7D1]/15 border border-[#66D7D1]/30 text-xs font-bold text-[#66D7D1]">
            <CheckCircle2 class="w-3.5 h-3.5" />
            <span>{$t('settings.lastfmConnected')} @{$lastFmAccountName}</span>
          </span>
        {:else}
          <span class="text-xs text-white/40 font-mono">{$t('settings.lastfmDisconnected')}</span>
        {/if}
      </div>

      {#if $lastFmConnected}
        <div class="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <div class="flex items-center gap-2">
            <button
              type="button"
              aria-label="Ativar ou desativar scrobble do Last.fm"
              onclick={() => playerActions.setLastFm(!$lastFmEnabled, $lastFmAccountName)}
              class="w-12 h-6 rounded-full p-0.5 transition cursor-pointer {$lastFmEnabled ? 'bg-[#66D7D1]' : 'bg-white/[0.1]'}"
            >
              <div class="w-5 h-5 rounded-full bg-white transition-transform {$lastFmEnabled ? 'translate-x-6' : 'translate-x-0'}"></div>
            </button>
            <span class="text-xs text-white/70">{$lastFmEnabled ? $t('common.enabled') : $t('common.disabled')}</span>
          </div>

          <button
            type="button"
            onclick={handleDisconnectLastFm}
            class="px-4 py-2 rounded-2xl bg-[#FC7753]/15 hover:bg-[#FC7753]/25 border border-[#FC7753]/30 text-xs font-bold text-[#FC7753] transition cursor-pointer"
          >
            {$t('settings.lastfmDisconnectBtn')}
          </button>
        </div>
      {:else}
        <div class="flex flex-col gap-3 pt-3 border-t border-white/[0.06]">
          {#if !lastFmAuthToken}
            <div class="flex items-center justify-between">
              <p class="text-xs text-white/60">{$t('settings.lastfmDesc')}</p>
              <button
                type="button"
                onclick={handleStartLastFmAuth}
                disabled={isConnectingLastFm}
                class="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FC7753] hover:bg-[#FC7753]/90 text-xs font-bold text-white shadow-md shadow-[#FC7753]/20 transition cursor-pointer disabled:opacity-50"
              >
                {#if isConnectingLastFm}
                  <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                  <span>Aguardando...</span>
                {:else}
                  <ExternalLink class="w-3.5 h-3.5" />
                  <span>{$t('settings.lastfmConnectBtn')}</span>
                {/if}
              </button>
            </div>
          {:else}
            <!-- Passo de Confirmação OAuth -->
            <div class="flex flex-col gap-3 p-4 rounded-2xl bg-[#66D7D1]/10 border border-[#66D7D1]/30">
              <div class="flex flex-col gap-1">
                <p class="text-xs font-bold text-[#66D7D1]">{$t('settings.lastfmAuthStep1')}</p>
                <p class="text-[11px] text-white/70">{$t('settings.lastfmAuthStep2')}</p>
              </div>

              {#if lastFmAuthDirectUrl}
                <div class="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onclick={handleOpenAuthUrlManually}
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-medium text-[#66D7D1] transition cursor-pointer"
                  >
                    <ExternalLink class="w-3.5 h-3.5" />
                    <span>{$t('settings.lastfmOpenBrowser')}</span>
                  </button>

                  <button
                    type="button"
                    onclick={handleCopyAuthUrl}
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-white/80 transition cursor-pointer"
                  >
                    {#if copiedAuthUrl}
                      <Check class="w-3.5 h-3.5 text-[#66D7D1]" />
                      <span class="text-[#66D7D1]">{$t('settings.lastfmLinkCopied')}</span>
                    {:else}
                      <Copy class="w-3.5 h-3.5 text-white/50" />
                      <span>{$t('settings.lastfmCopyLink')}</span>
                    {/if}
                  </button>
                </div>
              {/if}

              <div class="flex items-center gap-3 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onclick={handleCompleteLastFmAuth}
                  disabled={isConnectingLastFm}
                  class="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#66D7D1] hover:bg-[#66D7D1]/90 text-xs font-bold text-[#09090D] shadow-md shadow-[#66D7D1]/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
                >
                  {#if isConnectingLastFm}
                    <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                    <span>Confirmando...</span>
                  {:else}
                    <Check class="w-3.5 h-3.5" />
                    <span>{$t('settings.lastfmConfirmBtn')}</span>
                  {/if}
                </button>
                <button
                  type="button"
                  onclick={() => { lastFmAuthToken = null; lastFmAuthDirectUrl = null; }}
                  class="px-3 py-2 text-xs text-white/50 hover:text-white transition cursor-pointer"
                >
                  {$t('common.cancel')}
                </button>
              </div>
            </div>
          {/if}

          <!-- Chaves de API Personalizadas (Avançado) -->
          <div class="pt-2 border-t border-white/[0.06] flex flex-col gap-2.5">
            <button
              type="button"
              onclick={() => showAdvancedLastFm = !showAdvancedLastFm}
              class="flex items-center justify-between py-1 text-xs text-white/50 hover:text-white transition cursor-pointer"
            >
              <span class="flex items-center gap-1.5 font-semibold">
                <KeyRound class="w-3.5 h-3.5 text-[#DBD56E]" />
                <span>{$t('settings.lastfmCustomApiToggle')}</span>
              </span>
              {#if showAdvancedLastFm}
                <ChevronUp class="w-3.5 h-3.5" />
              {:else}
                <ChevronDown class="w-3.5 h-3.5" />
              {/if}
            </button>

            {#if showAdvancedLastFm}
              <div class="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-3 text-xs">
                <p class="text-[11px] text-white/60 leading-relaxed">
                  {$t('settings.lastfmCustomApiDesc')}
                </p>

                <div class="flex flex-col gap-1">
                  <label for="custom-api-key" class="text-[10px] uppercase font-bold text-white/40">{$t('settings.lastfmCustomApiKey')}</label>
                  <input
                    id="custom-api-key"
                    type="text"
                    bind:value={customApiKey}
                    placeholder="94b31a524883e32f92eb88142d3e3546 (Oficial)"
                    class="w-full py-1.5 px-3 rounded-xl liquid-input font-mono text-xs text-[#F2EFEA] focus:outline-none"
                  />
                </div>

                <div class="flex flex-col gap-1">
                  <label for="custom-api-secret" class="text-[10px] uppercase font-bold text-white/40">{$t('settings.lastfmCustomApiSecret')}</label>
                  <input
                    id="custom-api-secret"
                    type="password"
                    bind:value={customApiSecret}
                    placeholder="••••••••••••••••••••••••••••••••"
                    class="w-full py-1.5 px-3 rounded-xl liquid-input font-mono text-xs text-[#F2EFEA] focus:outline-none"
                  />
                </div>

                <div class="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onclick={handleSaveCustomKeys}
                    class="px-3.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-[#66D7D1] transition cursor-pointer"
                  >
                    {$t('settings.lastfmCustomApiSave')}
                  </button>
                  <button
                    type="button"
                    onclick={handleResetCustomKeys}
                    class="px-3 py-1.5 rounded-xl text-xs text-white/40 hover:text-white transition cursor-pointer"
                  >
                    Redefinir
                  </button>
                  {#if savedCustomKeysNotice}
                    <span class="text-[11px] text-[#66D7D1]">Salvo!</span>
                  {/if}
                </div>
              </div>
            {/if}
          </div>

          {#if lastFmError}
            <div class="p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-xs text-red-400">
              <AlertCircle class="w-4 h-4 shrink-0" />
              <span>{lastFmError}</span>
            </div>
          {/if}

          {#if lastFmSuccess}
            <div class="p-3 rounded-xl bg-[#66D7D1]/15 border border-[#66D7D1]/30 flex items-center gap-2 text-xs text-[#66D7D1]">
              <CheckCircle2 class="w-4 h-4 shrink-0" />
              <span>{lastFmSuccess}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- SEÇÃO 6: CONTA & SESSÃO -->
  <div class="liquid-glass rounded-3xl p-6 border border-white/[0.12] flex flex-col gap-5 shadow-xl">
    <div class="flex items-center gap-2.5">
      <User class="w-5 h-5 text-[#66D7D1]" />
      <h2 class="text-sm font-bold tracking-tight text-[#F2EFEA] uppercase">{$t('profile.title')} & Sessão</h2>
    </div>

    {#if $currentProfile && !$currentProfile.id.startsWith('guest')}
      <div class="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
        <div class="flex items-center gap-3">
          <img
            src={$currentProfile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${$currentProfile.username}`}
            alt={$currentProfile.display_name}
            class="w-11 h-11 rounded-full object-cover border border-white/[0.15]"
          />
          <div>
            <p class="text-xs font-bold text-[#F2EFEA]">{$currentProfile.display_name}</p>
            <p class="text-[11px] font-mono text-white/40">@{$currentProfile.username}#{$currentProfile.tag}</p>
          </div>
        </div>

        <button
          type="button"
          onclick={handleLogout}
          class="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FC7753]/10 hover:bg-[#FC7753]/20 border border-[#FC7753]/30 text-xs font-bold text-[#FC7753] transition cursor-pointer"
        >
          <LogOut class="w-3.5 h-3.5" />
          <span>{$t('common.logout')}</span>
        </button>
      </div>
    {:else}
      <div class="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
        <div>
          <p class="text-xs font-bold text-[#F2EFEA]">Modo Convidado (Offline)</p>
          <p class="text-[11px] text-white/50">Conecte sua conta para salvar playlists em nuvem e conversar com amigos.</p>
        </div>

        <button
          type="button"
          onclick={() => isAuthModalOpen.set(true)}
          class="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FC7753] hover:bg-[#FC7753]/90 text-white text-xs font-bold shadow-md shadow-[#FC7753]/25 transition cursor-pointer"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>{$t('auth.login')} / {$t('auth.register')}</span>
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- MODAL DE REINICIALIZAÇÃO PARA IDIOMA -->
{#if showRestartModal && newlySelectedLocale}
  <div 
    role="presentation"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-2xl animate-[fade-in_0.2s_ease-out]"
  >
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="liquid-modal w-full max-w-md rounded-3xl p-6 flex flex-col gap-4 border border-white/[0.16] shadow-2xl text-[#F2EFEA] animate-apple-spring relative"
    >
      <div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-[#66D7D1]/15 text-[#66D7D1] border border-[#66D7D1]/30">
            <Globe class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-[#F2EFEA]">{$t('common.restartRequired')}</h3>
            <p class="text-[10px] text-white/50">{newlySelectedLocale.flag} {newlySelectedLocale.nativeName}</p>
          </div>
        </div>
        <button onclick={() => showRestartModal = false} class="p-1 rounded-lg text-white/40 hover:text-white transition cursor-pointer">
          <X class="w-4 h-4" />
        </button>
      </div>

      <p class="text-xs text-white/70 leading-relaxed">
        {$t('common.restartNotice')}
      </p>

      <div class="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onclick={() => showRestartModal = false}
          class="px-4 py-2 rounded-xl liquid-glass text-xs font-semibold text-white/60 hover:text-white transition cursor-pointer"
        >
          {$t('common.close')}
        </button>

        <button
          type="button"
          onclick={() => restartApplication()}
          class="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#66D7D1] hover:bg-[#66D7D1]/90 text-xs font-bold text-[#09090D] shadow-lg shadow-[#66D7D1]/20 transition cursor-pointer"
        >
          <RefreshCw class="w-3.5 h-3.5" />
          <span>{$t('common.restartNow')}</span>
        </button>
      </div>
    </div>
  </div>
{/if}
