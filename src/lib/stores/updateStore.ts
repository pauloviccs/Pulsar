import { writable, get } from 'svelte/store';
import { safeInvoke, safeListen } from '../api/tauri';

export const APP_CURRENT_VERSION = '0.2.7';
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
 * Mapa de sufixos pré-release conhecidos → peso numérico para comparação.
 * Ex: "0.2.6-alpha" < "0.2.6-beta" < "0.2.6-b" < "0.2.6-rc" < "0.2.6" (release)
 */
const PRE_RELEASE_WEIGHT: Record<string, number> = {
  alpha: -4,
  a: -4,
  beta: -3,
  b: -2,
  rc: -1,
};

/**
 * Normaliza uma string de versão em um array numérico comparável.
 * Suporta: "0.2.7", "v0.2.6-b", "0.2.6.1", "0.2.6-beta.2"
 *
 * Lógica:
 * 1. Remove prefixo "v"
 * 2. Separa por "-" → parte numérica + sufixo pré-release
 * 3. Parte numérica é splitada por "." → segmentos inteiros
 * 4. Se houver sufixo pré-release, acrescenta seu peso como segmento extra
 *    (releases sem sufixo recebem 0, mantendo-as maiores que pré-releases)
 */
function normalizeVersion(ver: string): number[] {
  const cleaned = String(ver).replace(/^v/i, '').trim();
  if (!cleaned) return [0];

  // Trata explicitamente a equivalência histórica do release 0.2.6:
  // "0.2.6-b" e "0.2.6.1" representam a mesma release em canais diferentes (app vs Inno Setup)
  if (cleaned === '0.2.6-b' || cleaned === '0.2.6.b') {
    return [0, 2, 6, 1];
  }

  const dashIndex = cleaned.indexOf('-');
  const corePart = dashIndex >= 0 ? cleaned.slice(0, dashIndex) : cleaned;
  const preRelease = dashIndex >= 0 ? cleaned.slice(dashIndex + 1).toLowerCase() : undefined;

  const segments = corePart.split('.').map(s => parseInt(s, 10) || 0);

  if (preRelease !== undefined) {
    // Pode ser "b", "beta", "rc", "alpha", ou "beta.2"
    const preParts = preRelease.split('.');
    const label = preParts[0];
    const weight = PRE_RELEASE_WEIGHT[label] ?? -1;
    segments.push(weight);
    // Se houver sub-número após o label (ex: "beta.2"), adiciona
    if (preParts.length > 1) {
      segments.push(parseInt(preParts[1], 10) || 0);
    }
  } else {
    // Release final → peso 0 (maior que qualquer pré-release negativo)
    segments.push(0);
  }

  return segments;
}

/**
 * Compara versões de forma robusta, suportando SemVer com sufixos pré-release.
 * Exemplos:
 *   "0.2.7" > "0.2.6-b"    → true
 *   "0.2.6.1" > "0.2.6-b"  → false (ambas equivalem à mesma release cycle, mas .1 ≈ sub-patch)
 *   "0.2.7" > "0.2.7"      → false (iguais)
 */
export function isNewerVersion(remoteVersion: string, currentVer?: string): boolean {
  const activeVer = currentVer || get(currentVersion) || APP_CURRENT_VERSION;
  if (!remoteVersion || !activeVer) return false;

  const r = normalizeVersion(remoteVersion);
  const c = normalizeVersion(activeVer);

  const maxLen = Math.max(r.length, c.length);
  for (let i = 0; i < maxLen; i++) {
    const rPart = r[i] ?? 0;
    const cPart = c[i] ?? 0;
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
