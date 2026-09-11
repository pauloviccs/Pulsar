<script lang="ts">
  import { 
    X, 
    RefreshCw, 
    Laptop, 
    Headphones, 
    Radio, 
    Volume2, 
    Check, 
    Loader2, 
    Wifi,
    Tv,
    Cast
  } from '@lucide/svelte';
  import { audioRouter } from '../audio/AudioRouter';
  import type { AudioDevice } from '../audio/types';
  import { t } from '../i18n';

  let { isOpen = $bindable(false), onScanRequested }: { 
    isOpen: boolean; 
    onScanRequested?: () => Promise<void> | void; 
  } = $props();

  const availableDevices = audioRouter.availableDevices;
  const activeDevice = audioRouter.activeDevice;
  const connectStatus = audioRouter.connectStatus;

  let isScanningManual = $state(false);
  let connectingDeviceId = $state<string | null>(null);

  // Filtros reativos por tipo
  let localDevices = $derived($availableDevices.filter(d => d.type === 'local'));
  let bluetoothDevices = $derived($availableDevices.filter(d => d.type === 'bluetooth'));
  let castDevices = $derived($availableDevices.filter(d => d.type === 'cast'));
  let upnpDevices = $derived($availableDevices.filter(d => d.type === 'upnp'));

  // Ao abrir o modal, dispara varredura em todos os scanners
  $effect(() => {
    if (isOpen) {
      handleRefresh();
    }
  });

  async function selectDevice(device: AudioDevice) {
    if ($activeDevice.id === device.id) return;
    connectingDeviceId = device.id;
    try {
      await audioRouter.selectDevice(device.id);
    } finally {
      connectingDeviceId = null;
    }
  }

  async function handleRefresh() {
    if (isScanningManual) return;
    isScanningManual = true;
    try {
      if (onScanRequested) {
        await onScanRequested();
      } else {
        await audioRouter.scanAll();
      }
    } finally {
      setTimeout(() => {
        isScanningManual = false;
      }, 1000);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- Backdrop Escurecido com Blur Profundo -->
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 select-none"
    onclick={() => isOpen = false}
    role="presentation"
  >
    <!-- Modal Container Liquid Glass -->
    <div 
      class="relative w-full max-w-md bg-[#13141f]/95 backdrop-blur-2xl border border-white/[0.1] rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pulsar-connect-title"
      tabindex="-1"
    >
      <!-- Cabeçalho com Brilho Superior -->
      <div class="p-5 pb-4 flex items-center justify-between border-b border-white/[0.06] relative bg-gradient-to-b from-white/[0.04] to-transparent">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#66D7D1]/20 to-[#66D7D1]/40 border border-[#66D7D1]/30 flex items-center justify-center text-[#66D7D1] shadow-inner">
            <Radio class="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 id="pulsar-connect-title" class="text-base font-bold text-[#F2EFEA] tracking-tight">
                {$t('connect.title')}
              </h2>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#66D7D1]/15 text-[#66D7D1] border border-[#66D7D1]/30">
                LAN & BT
              </span>
            </div>
            <p class="text-xs text-[#F2EFEA]/60 truncate max-w-[260px]">
              {$t('connect.subtitle')}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <!-- Botão Recarregar / Buscar Dispositivos -->
          <button
            onclick={handleRefresh}
            disabled={isScanningManual}
            class="p-2 rounded-xl text-[#F2EFEA]/50 hover:text-[#F2EFEA] hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="{$t('connect.scanBtn')}"
          >
            <RefreshCw class="w-4 h-4 {isScanningManual ? 'animate-spin text-[#66D7D1]' : ''}" />
          </button>

          <!-- Botão Fechar -->
          <button
            onclick={() => isOpen = false}
            class="p-2 rounded-xl text-[#F2EFEA]/50 hover:text-[#F2EFEA] hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer"
            title="{$t('common.close')}"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Lista Rolável de Dispositivos por Categoria -->
      <div class="p-5 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
        <!-- Categoria 1: Este Dispositivo (Local) -->
        <div class="space-y-2">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-[#F2EFEA]/40 px-1">
            {$t('connect.thisDevice')}
          </span>

          <div class="space-y-1.5">
            {#each localDevices as dev}
              {@const isActive = $activeDevice.id === dev.id}
              {@const isConnecting = connectingDeviceId === dev.id}

              <button
                type="button"
                onclick={() => selectDevice(dev)}
                class="w-full p-3 rounded-2xl flex items-center justify-between border transition-all duration-200 cursor-pointer text-left {isActive ? 'bg-[#66D7D1]/12 border-[#66D7D1]/40 shadow-[0_0_20px_rgba(102,215,209,0.15)]' : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.05] hover:border-white/[0.1] active:scale-[0.99]'}"
              >
                <div class="flex items-center gap-3.5 min-w-0">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 {isActive ? 'bg-[#66D7D1] text-[#121216] shadow-md' : 'bg-white/[0.06] text-[#F2EFEA]/70'}">
                    <Laptop class="w-5 h-5" />
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-semibold text-[#F2EFEA] truncate">
                      {$t('connect.systemDefault')}
                    </span>
                    <span class="text-[11px] {isActive ? 'text-[#66D7D1]' : 'text-[#F2EFEA]/40'} truncate">
                      {isActive ? $t('connect.playingHere') : `Latência mínima (~${dev.approximateLatencyMs}ms)`}
                    </span>
                  </div>
                </div>

                <div class="shrink-0 flex items-center gap-2">
                  {#if isConnecting}
                    <Loader2 class="w-4 h-4 text-[#66D7D1] animate-spin" />
                  {:else if isActive}
                    <div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#66D7D1]/20 text-[#66D7D1] text-[10px] font-bold border border-[#66D7D1]/30">
                      <Check class="w-3 h-3" />
                      <span>Ativo</span>
                    </div>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Categoria 2: Speakers JBL, Fones & Bluetooth -->
        <div class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-[#F2EFEA]/40">
              {$t('connect.bluetoothDevices')}
            </span>
            <span class="text-[11px] text-[#F2EFEA]/30">
              {bluetoothDevices.length}
            </span>
          </div>

          {#if bluetoothDevices.length === 0}
            <div class="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-center space-y-1">
              <p class="text-xs text-[#F2EFEA]/40">
                {$t('connect.noBluetooth')}
              </p>
              <span class="text-[10px] text-[#F2EFEA]/30 block">
                Speakers da JBL, caixas de som e fones pareados no Windows aparecerão aqui automaticamente.
              </span>
            </div>
          {:else}
            <div class="space-y-1.5">
              {#each bluetoothDevices as dev}
                {@const isActive = $activeDevice.id === dev.id}
                {@const isConnecting = connectingDeviceId === dev.id}
                {@const isSpeaker = dev.name.toLowerCase().includes('jbl') || dev.name.toLowerCase().includes('speaker') || dev.name.toLowerCase().includes('alto-falante')}

                <button
                  type="button"
                  onclick={() => selectDevice(dev)}
                  class="w-full p-3 rounded-2xl flex items-center justify-between border transition-all duration-200 cursor-pointer text-left {isActive ? 'bg-[#66D7D1]/12 border-[#66D7D1]/40 shadow-[0_0_20px_rgba(102,215,209,0.15)]' : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.05] hover:border-white/[0.1] active:scale-[0.99]'}"
                >
                  <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 {isActive ? 'bg-[#66D7D1] text-[#121216] shadow-md' : 'bg-white/[0.06] text-[#F2EFEA]/70'}">
                      {#if isSpeaker}
                        <Volume2 class="w-5 h-5" />
                      {:else}
                        <Headphones class="w-5 h-5" />
                      {/if}
                    </div>
                    <div class="flex flex-col min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs font-semibold text-[#F2EFEA] truncate">
                          {dev.name}
                        </span>
                        {#if dev.name.toLowerCase().includes('jbl')}
                          <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            JBL
                          </span>
                        {/if}
                      </div>
                      <span class="text-[11px] {isActive ? 'text-[#66D7D1]' : 'text-[#F2EFEA]/40'} truncate">
                        {isActive ? $t('connect.playingHere') : `Bluetooth Direct (~${dev.approximateLatencyMs}ms)`}
                      </span>
                    </div>
                  </div>

                  <div class="shrink-0 flex items-center gap-2">
                    {#if isConnecting}
                      <Loader2 class="w-4 h-4 text-[#66D7D1] animate-spin" />
                    {:else if isActive}
                      <div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#66D7D1]/20 text-[#66D7D1] text-[10px] font-bold border border-[#66D7D1]/30">
                        <Check class="w-3 h-3" />
                        <span>Ativo</span>
                      </div>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Categoria 3: Google Home & Nest (Google Cast) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-[#F2EFEA]/40">
              {$t('connect.castDevices')}
            </span>
            <span class="text-[11px] text-[#F2EFEA]/30">
              {castDevices.length}
            </span>
          </div>

          {#if castDevices.length === 0}
            <div class="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-center space-y-1">
              <p class="text-xs text-[#F2EFEA]/40">
                {$t('connect.noCast')}
              </p>
              <span class="text-[10px] text-[#F2EFEA]/30 block">
                Google Home, Nest Mini e Chromecast conectados na mesma rede Wi-Fi são detectados automaticamente via mDNS.
              </span>
            </div>
          {:else}
            <div class="space-y-1.5">
              {#each castDevices as dev}
                {@const isActive = $activeDevice.id === dev.id}
                {@const isConnecting = connectingDeviceId === dev.id}

                <button
                  type="button"
                  onclick={() => selectDevice(dev)}
                  class="w-full p-3 rounded-2xl flex items-center justify-between border transition-all duration-200 cursor-pointer text-left {isActive ? 'bg-[#66D7D1]/12 border-[#66D7D1]/40 shadow-[0_0_20px_rgba(102,215,209,0.15)]' : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.05] hover:border-white/[0.1] active:scale-[0.99]'}"
                >
                  <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 {isActive ? 'bg-[#66D7D1] text-[#121216] shadow-md' : 'bg-white/[0.06] text-[#F2EFEA]/70'}">
                      <Cast class="w-5 h-5" />
                    </div>
                    <div class="flex flex-col min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs font-semibold text-[#F2EFEA] truncate">
                          {dev.name}
                        </span>
                        <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          Cast
                        </span>
                      </div>
                      <span class="text-[11px] {isActive ? 'text-[#66D7D1]' : 'text-[#F2EFEA]/40'} truncate">
                        {isActive ? $t('connect.playingHere') : `Google Cast (~${dev.approximateLatencyMs}ms)`}
                      </span>
                    </div>
                  </div>

                  <div class="shrink-0 flex items-center gap-2">
                    {#if isConnecting}
                      <Loader2 class="w-4 h-4 text-[#66D7D1] animate-spin" />
                    {:else if isActive}
                      <div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#66D7D1]/20 text-[#66D7D1] text-[10px] font-bold border border-[#66D7D1]/30">
                        <Check class="w-3 h-3" />
                        <span>Ativo</span>
                      </div>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Categoria 4: Smart TVs & Receptores DLNA (LG TV, Samsung) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-[#F2EFEA]/40">
              {$t('connect.upnpDevices')}
            </span>
            <span class="text-[11px] text-[#F2EFEA]/30">
              {upnpDevices.length}
            </span>
          </div>

          {#if upnpDevices.length === 0}
            <div class="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-center space-y-1">
              <p class="text-xs text-[#F2EFEA]/40">
                {$t('connect.noUpnp')}
              </p>
              <span class="text-[10px] text-[#F2EFEA]/30 block">
                Compatível com Smart TVs LG WebOS, Samsung Tizen e caixas DLNA na mesma rede Wi-Fi.
              </span>
            </div>
          {:else}
            <div class="space-y-1.5">
              {#each upnpDevices as dev}
                {@const isActive = $activeDevice.id === dev.id}
                {@const isConnecting = connectingDeviceId === dev.id}

                <button
                  type="button"
                  onclick={() => selectDevice(dev)}
                  class="w-full p-3 rounded-2xl flex items-center justify-between border transition-all duration-200 cursor-pointer text-left {isActive ? 'bg-[#66D7D1]/12 border-[#66D7D1]/40 shadow-[0_0_20px_rgba(102,215,209,0.15)]' : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.05] hover:border-white/[0.1] active:scale-[0.99]'}"
                >
                  <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 {isActive ? 'bg-[#66D7D1] text-[#121216] shadow-md' : 'bg-white/[0.06] text-[#F2EFEA]/70'}">
                      <Tv class="w-5 h-5" />
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="text-xs font-semibold text-[#F2EFEA] truncate">
                        {dev.name}
                      </span>
                      <span class="text-[11px] {isActive ? 'text-[#66D7D1]' : 'text-[#F2EFEA]/40'} truncate">
                        {isActive ? $t('connect.playingHere') : `DLNA Stream (~${dev.approximateLatencyMs}ms)`}
                      </span>
                    </div>
                  </div>

                  <div class="shrink-0 flex items-center gap-2">
                    {#if isConnecting}
                      <Loader2 class="w-4 h-4 text-[#66D7D1] animate-spin" />
                    {:else if isActive}
                      <div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#66D7D1]/20 text-[#66D7D1] text-[10px] font-bold border border-[#66D7D1]/30">
                        <Check class="w-3 h-3" />
                        <span>Ativo</span>
                      </div>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Rodapé Informativo com Transparência Apple-Like -->
      <div class="p-4 bg-white/[0.02] border-t border-white/[0.06] text-center">
        <p class="text-[11px] text-[#F2EFEA]/40 leading-relaxed">
          {$t('connect.localNotice')}
        </p>
      </div>
    </div>
  </div>
{/if}

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
