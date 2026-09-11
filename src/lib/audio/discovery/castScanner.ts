import type { AudioRouter } from '../AudioRouter';
import { CastOutputTarget } from '../targets/CastOutputTarget';
import { safeInvoke } from '../../api/tauri';

export interface CastDeviceDTO {
  id: string;
  friendly_name: string;
  model_name: string;
  ip_address: string;
  port: number;
}

export class CastScanner {
  private audioRouter: AudioRouter;
  private knownDeviceIds = new Set<string>();
  private isScanning = false;
  private periodicTimer: any = null;

  constructor(audioRouter: AudioRouter) {
    this.audioRouter = audioRouter;
  }

  public start() {
    this.scan();

    // Varredura periódica a cada 40 segundos
    this.periodicTimer = setInterval(() => {
      this.scan();
    }, 40000);
  }

  public stop() {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
  }

  public async scan(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const devices = await safeInvoke<CastDeviceDTO[]>('cast_discover_devices').catch(() => []);
      if (!devices || !Array.isArray(devices)) return;

      const currentFoundIds = new Set<string>();

      for (const dev of devices) {
        if (!dev.ip_address) continue;

        const targetId = `cast-${dev.ip_address}`;
        currentFoundIds.add(targetId);

        if (!this.knownDeviceIds.has(targetId)) {
          const target = new CastOutputTarget(
            dev.ip_address,
            dev.friendly_name || `Google Home (${dev.model_name})`,
            dev.port || 8009
          );

          this.knownDeviceIds.add(targetId);
          this.audioRouter.registerTarget(target);
          console.log(`[CastScanner] Dispositivo Google Home/Cast registrado: ${dev.friendly_name} (${targetId})`);
        }
      }

      // Remove dispositivos não encontrados
      for (const oldId of Array.from(this.knownDeviceIds)) {
        if (!currentFoundIds.has(oldId)) {
          console.log(`[CastScanner] Google Cast desconectado: ${oldId}`);
          this.audioRouter.unregisterTarget(oldId);
          this.knownDeviceIds.delete(oldId);
        }
      }
    } catch (err) {
      console.warn('[CastScanner] Erro na descoberta mDNS Google Cast:', err);
    } finally {
      this.isScanning = false;
    }
  }
}
