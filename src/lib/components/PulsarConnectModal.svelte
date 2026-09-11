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
    Cast,
    Power,
    Bluetooth,
    Terminal
  } from '@lucide/svelte';
  import { audioRouter } from '../audio/AudioRouter';
  import type { AudioDevice } from '../audio/types';
  import { safeInvoke } from '../api/tauri';
  import { t } from '../i18n';
  import LogsModal from './LogsModal.svelte';

  let { isOpen = $bindable(false), onScanRequested }: { 
    isOpen: boolean; 
    onScanRequested?: () => Promise<void> | void; 
  } = $props();

  const availableDevices = audioRouter.availableDevices;
  const activeDevice = audioRouter.activeDevice;
  const connectStatus = audioRouter.connectStatus;

  let isScanningManual = $state(false);
  let isLogsOpen = $state(false);
  let connectingDeviceId = $state<string | null>(null);

  // Filtros reativos por tipo
  let localDevices = $derived($availableDevices.filter(d => d.type === 'local'));
  let bluetoothDevices = $derived($availableDevices.filter(d => d.type === 'bluetooth'));
  let castDevices = $derived($availableDevices.filter(d => d.type === 'cast'));
  let upnpDevices = $derived($availableDevices.filter(d => d.type === 'upnp'));

  // Separa fones/speakers Bluetooth reais de saídas HDMI de vídeo (NVIDIA, LG TV, Philco)
  let isTvDevice = (d: AudioDevice) => {
    const n = d.name.toLowerCase();
    return n.includes('tv') || n.includes('hdmi') || n.includes('philco') || n.includes('lg tv') || n.includes('nvidia') || n.includes('samsung');
  };
  let realBluetoothDevices = $derived(bluetoothDevices.filter(d => !isTvDevice(d)));
  let tvDevices = $derived(bluetoothDevices.filter(d => isTvDevice(d)));

  async function handleOpenBluetoothSettings() {
    try {
      await safeInvoke('open_bluetooth_settings');
    } catch (err) {
      console.warn('[PulsarConnect] Falha ao abrir configurações de Bluetooth:', err);
    }
  }

  // Ao abrir o modal, dispara varredura em todos os scanners
  $effect(() => {
    if (isOpen) {
      handleRefresh();
    }
  });

  async function selectDevice(device: AudioDevice) {
    if ($activeDevice.id === device.id) {
      if (device.type !== 'local') {
        await disconnectDevice();
      }
      return;
    }
    connectingDeviceId = device.id;
    try {
      await audioRouter.selectDevice(device.id);
    } finally {
      connectingDeviceId = null;
    }
  }

  async function disconnectDevice() {
    connectingDeviceId = $activeDevice.id;
    try {
      await audioRouter.disconnectActiveDevice();
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
          <!-- Botão Console de Logs & Diagnóstico -->
          <button
            onclick={() => isLogsOpen = true}
            class="p-2 rounded-xl text-[#F2EFEA]/60 hover:text-amber-400 hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer"
            title="Abrir Console de Diagnóstico e Logs"
          >
            <Terminal class="w-4 h-4" />
          </button>

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
              {realBluetoothDevices.length}
            </span>
          </div>

          {#if realBluetoothDevices.length === 0}
            <div class="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-center space-y-2.5">
              <p class="text-xs text-[#F2EFEA]/50">
                Nenhum fone ou speaker Bluetooth conectado no momento.
              </p>
              <p class="text-[10px] text-[#F2EFEA]/30 max-w-xs mx-auto">
                Ligue seu fone ou conecte-o pelo Windows. O Pulsar reconhece a conexão na mesma hora.
              </p>
            </div>
          {:else}
            <div class="space-y-1.5">
              {#each realBluetoothDevices as dev}
                {@const isActive = $activeDevice.id === dev.id}
                {@const isConnecting = connectingDeviceId === dev.id}
                {@const isSpeaker = dev.name.toLowerCase().includes('jbl') || dev.name.toLowerCase().includes('speaker') || dev.name.toLowerCase().includes('alto-falante') || dev.name.toLowerCase().includes('som') || dev.name.toLowerCase().includes('caixa')}
                {@const isHaylou = dev.name.toLowerCase().includes('haylou') || dev.name.toLowerCase().includes('hi-lo') || dev.name.toLowerCase().includes('s30')}
                {@const isJbl = dev.name.toLowerCase().includes('jbl')}
                {@const isSony = dev.name.toLowerCase().includes('sony')}

                <div
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectDevice(dev); }}
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
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-xs font-semibold text-[#F2EFEA] truncate">
                          {dev.name}
                        </span>
                        {#if isHaylou}
                          <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Hi-Lo / Haylou
                          </span>
                        {:else if isJbl}
                          <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            JBL
                          </span>
                        {:else if isSony}
                          <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            SONY
                          </span>
                        {/if}
                      </div>
                      <span class="text-[11px] {isActive ? 'text-[#66D7D1]' : 'text-[#F2EFEA]/40'} truncate">
                        {isActive ? $t('connect.playingHere') : `Disponível para reproduzir (~${dev.approximateLatencyMs}ms)`}
                      </span>
                    </div>
                  </div>

                  <div class="shrink-0 flex items-center gap-2">
                    {#if isConnecting}
                      <Loader2 class="w-4 h-4 text-[#66D7D1] animate-spin" />
                    {:else if isActive}
                      <button
                        type="button"
                        onclick={(e) => { e.stopPropagation(); disconnectDevice(); }}
                        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 text-[10px] font-bold border border-red-500/30 transition-all cursor-pointer shadow-sm active:scale-95 group/disc"
                        title="Desconectar e voltar para os alto-falantes do computador"
                      >
                        <Power class="w-3 h-3 text-red-400 group-hover/disc:rotate-12 transition-transform" />
                        <span>Desconectar</span>
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Botão Silencioso de Parear / Conectar no Windows -->
          <button
            type="button"
            onclick={handleOpenBluetoothSettings}
            class="w-full mt-1.5 py-2 px-3 rounded-2xl bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 hover:border-blue-500/35 text-blue-300 hover:text-blue-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
            title="Abrir configurações de Bluetooth do Windows para conectar ou parear"
          >
            <Bluetooth class="w-3.5 h-3.5 text-blue-400" />
            <span>+ Conectar / Parear Dispositivo Bluetooth no Windows</span>
          </button>
        </div>

        <!-- Categoria Opcional: Monitores & TVs HDMI -->
        {#if tvDevices.length > 0}
          <div class="space-y-2">
            <div class="flex items-center justify-between px-1">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-[#F2EFEA]/40">
                Monitores & Saídas de Vídeo (HDMI)
              </span>
              <span class="text-[11px] text-[#F2EFEA]/30">
                {tvDevices.length}
              </span>
            </div>

            <div class="space-y-1.5">
              {#each tvDevices as dev}
                {@const isActive = $activeDevice.id === dev.id}
                {@const isConnecting = connectingDeviceId === dev.id}

                <div
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectDevice(dev); }}
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
                        {isActive ? $t('connect.playingHere') : `Saída HDMI do Sistema (~${dev.approximateLatencyMs}ms)`}
                      </span>
                    </div>
                  </div>

                  <div class="shrink-0 flex items-center gap-2">
                    {#if isConnecting}
                      <Loader2 class="w-4 h-4 text-[#66D7D1] animate-spin" />
                    {:else if isActive}
                      <button
                        type="button"
                        onclick={(e) => { e.stopPropagation(); disconnectDevice(); }}
                        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 text-[10px] font-bold border border-red-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <Power class="w-3 h-3 text-red-400" />
                        <span>Desconectar</span>
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

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

                <div
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectDevice(dev); }}
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
                      <button
                        type="button"
                        onclick={(e) => { e.stopPropagation(); disconnectDevice(); }}
                        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 text-[10px] font-bold border border-red-500/30 transition-all cursor-pointer shadow-sm active:scale-95 group/disc"
                        title="Desconectar e voltar para os alto-falantes do computador"
                      >
                        <Power class="w-3 h-3 text-red-400 group-hover/disc:rotate-12 transition-transform" />
                        <span>Desconectar</span>
                      </button>
                    {/if}
                  </div>
                </div>
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

                <div
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectDevice(dev); }}
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
                      <button
                        type="button"
                        onclick={(e) => { e.stopPropagation(); disconnectDevice(); }}
                        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 text-[10px] font-bold border border-red-500/30 transition-all cursor-pointer shadow-sm active:scale-95 group/disc"
                        title="Desconectar e voltar para os alto-falantes do computador"
                      >
                        <Power class="w-3 h-3 text-red-400 group-hover/disc:rotate-12 transition-transform" />
                        <span>Desconectar</span>
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Banner de Transmissão Ativa com Botão de Desconectar Rápido -->
      {#if $activeDevice.type !== 'local'}
        <div class="mx-5 mb-3 p-3 rounded-2xl bg-gradient-to-r from-[#66D7D1]/12 via-[#66D7D1]/6 to-transparent border border-[#66D7D1]/25 flex items-center justify-between shadow-lg backdrop-blur-sm animate-in fade-in duration-200">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="relative flex h-2.5 w-2.5 shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#66D7D1] opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#66D7D1]"></span>
            </span>
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-bold text-[#F2EFEA] truncate">
                {$activeDevice.name}
              </span>
              <span class="text-[10px] text-[#66D7D1] truncate">
                Transmitindo agora via {$activeDevice.type.toUpperCase()}
              </span>
            </div>
          </div>

          <button
            type="button"
            onclick={disconnectDevice}
            class="shrink-0 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 text-xs font-semibold border border-red-500/30 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Power class="w-3.5 h-3.5" />
            <span>Desconectar</span>
          </button>
        </div>
      {/if}

      <!-- Rodapé Informativo com Transparência Apple-Like -->
      <div class="p-4 bg-white/[0.02] border-t border-white/[0.06] text-center">
        <p class="text-[11px] text-[#F2EFEA]/40 leading-relaxed">
          {$t('connect.localNotice')}
        </p>
      </div>
    </div>
  </div>
{/if}

<!-- Modal de Diagnóstico e Logs do Sistema -->
<LogsModal bind:isOpen={isLogsOpen} />

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
