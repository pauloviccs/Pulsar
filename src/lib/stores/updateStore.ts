import { writable, get } from 'svelte/store';
import { safeInvoke, safeListen } from '../api/tauri';

export const APP_CURRENT_VERSION = '0.2.6';
export const DEFAULT_MANIFEST_URL = 'https://raw.githubusercontent.com/pauloviccs/Pulsar/main/latest.json';

export interface UpdateManifest {
  version: string;
  name?: string;
  url: string;
  notes?: string;
  pub_date?: string;
  mandatory?: boolean;
}

export interface UpdateProgressPayload {
  downloaded_bytes: number;
  total_bytes: number;
  percentage: number;
}

export const currentVersion = writable<string>(APP_CURRENT_VERSION);

// Consulta a versão real em tempo de execução via backend Rust do Tauri
if (typeof window !== 'undefined') {
  safeInvoke<string>('get_app_version').then(ver => {
    if (ver) {
      currentVersion.set(ver);
    }
  }).catch(() => {});
}

export const updateManifest = writable<UpdateManifest | null>(null);
export const isCheckingUpdates = writable<boolean>(false);
export const updateAvailable = writable<boolean>(false);
export const isUpdateModalOpen = writable<boolean>(false);
export const isUpdateToastOpen = writable<boolean>(false);
export const isDownloading = writable<boolean>(false);
export const downloadProgress = writable<UpdateProgressPayload>({
  downloaded_bytes: 0,
  total_bytes: 0,
  percentage: 0
});
export const updateError = writable<string | null>(null);
export const updateStatusMessage = writable<string>('');
export const lastCheckTime = writable<string | null>(null);

/**
 * Compara versões SemVer (ex: "0.2.5" > "0.2.2")
 */
export function isNewerVersion(remoteVersion: string, currentVer?: string): boolean {
  const activeVer = currentVer || get(currentVersion) || APP_CURRENT_VERSION;
  if (!remoteVersion || !activeVer) return false;
  const r = String(remoteVersion).replace(/^v/i, '').trim().split('.').map(n => parseInt(n, 10) || 0);
  const c = String(activeVer).replace(/^v/i, '').trim().split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rPart = r[i] || 0;
    const cPart = c[i] || 0;
    if (rPart > cPart) return true;
    if (rPart < cPart) return false;
  }
  return false;
}

export const updateActions = {
  /**
   * Consulta o manifesto de atualização (automático em background ou manual via Configurações)
   */
  async checkForUpdates(manual: boolean = false, customUrl?: string): Promise<boolean> {
    const url = customUrl || DEFAULT_MANIFEST_URL;
    isCheckingUpdates.set(true);
    updateError.set(null);

    try {
      const manifest = await safeInvoke<UpdateManifest>('fetch_update_manifest', { manifestUrl: url });
      
      if (!manifest || !manifest.version) {
        throw new Error('Manifesto retornado inválido ou sem versão.');
      }

      lastCheckTime.set(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const activeCurrentVer = get(currentVersion) || APP_CURRENT_VERSION;
      const hasUpdate = isNewerVersion(manifest.version, activeCurrentVer);

      if (hasUpdate) {
        updateManifest.set(manifest);
        updateAvailable.set(true);

        if (manifest.mandatory || manual) {
          isUpdateToastOpen.set(false);
          isUpdateModalOpen.set(true);
        } else {
          // Em background: mostra apenas a pílula sutil Toast
          isUpdateToastOpen.set(true);
        }
        return true;
      } else {
        updateAvailable.set(false);
        isUpdateToastOpen.set(false);
        isUpdateModalOpen.set(false);
        updateManifest.set(manifest);
        if (manual) {
          // Feedback opcional para checagem manual onde já está atualizado
          updateStatusMessage.set('O Pulsar já está atualizado na versão mais recente.');
        }
        return false;
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.warn('[Pulsar UpdateStore] Falha ao verificar atualizações:', msg);
      updateError.set(msg);
      return false;
    } finally {
      isCheckingUpdates.set(false);
    }
  },

  /**
   * Inicia o download em streaming e a execução com elevação UAC do instalador
   */
  async startInstall(): Promise<void> {
    const manifest = get(updateManifest);
    if (!manifest || !manifest.url) {
      updateError.set('Nenhum pacote de atualização disponível para download.');
      return;
    }

    isDownloading.set(true);
    updateError.set(null);
    updateStatusMessage.set('Iniciando download do pacote...');
    downloadProgress.set({ downloaded_bytes: 0, total_bytes: 0, percentage: 0 });

    let unlisten: (() => void) | undefined;

    try {
      unlisten = await safeListen<UpdateProgressPayload>('updater-progress', (event) => {
        const payload = event.payload;
        downloadProgress.set(payload);
        const pct = Math.min(100, Math.max(0, payload.percentage || 0));
        const downMB = ((payload.downloaded_bytes || 0) / (1024 * 1024)).toFixed(1);
        const totalMB = ((payload.total_bytes || 0) / (1024 * 1024)).toFixed(1);

        if (pct >= 100) {
          updateStatusMessage.set('Download 100% concluído! Executando instalador e reiniciando o Pulsar...');
        } else {
          updateStatusMessage.set(`Baixando atualização... ${pct.toFixed(0)}% (${downMB} MB / ${totalMB} MB)`);
        }
      });

      console.log('[UpdateStore] Invocando download_and_run_installer:', manifest.url);
      await safeInvoke('download_and_run_installer', { installerUrl: manifest.url });
    } catch (e: any) {
      console.error('[UpdateStore] Erro ao baixar ou aplicar atualização:', e);
      const msg = e?.message || String(e);
      updateError.set(`Falha na atualização: ${msg}`);
      updateStatusMessage.set('');
    } finally {
      isDownloading.set(false);
      if (unlisten) unlisten();
    }
  },

  openModal() {
    isUpdateToastOpen.set(false);
    isUpdateModalOpen.set(true);
  },

  closeModal() {
    const manifest = get(updateManifest);
    if (manifest?.mandatory && get(updateAvailable)) {
      return; // Se for mandatório, não fecha
    }
    isUpdateModalOpen.set(false);
  },

  dismissToast() {
    isUpdateToastOpen.set(false);
  }
};
