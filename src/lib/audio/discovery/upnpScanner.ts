import type { AudioRouter } from '../AudioRouter';
import { UpnpOutputTarget } from '../targets/UpnpOutputTarget';
import { safeInvoke } from '../../api/tauri';

export interface UpnpDeviceDTO {
  id: string;
  friendly_name: string;
  location_url: string;
  av_transport_url?: string;
  rendering_control_url?: string;
}

export class UpnpScanner {
  private audioRouter: AudioRouter;
  private knownDeviceIds = new Set<string>();
  private isScanning = false;
  private periodicTimer: any = null;

  constructor(audioRouter: AudioRouter) {
    this.audioRouter = audioRouter;
  }

  public start() {
    // Escaneia inicialmente
    this.scan();

    // Varredura periódica sutil a cada 45 segundos para atualizar a rede local
    this.periodicTimer = setInterval(() => {
      this.scan();
    }, 45000);
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
      const devices = await safeInvoke<UpnpDeviceDTO[]>('upnp_discover_devices').catch(() => []);
      if (!devices || !Array.isArray(devices)) return;

      const currentFoundIds = new Set<string>();

      for (const dev of devices) {
        if (!dev.av_transport_url) continue;

        const targetId = `upnp-${dev.id}`;
        currentFoundIds.add(targetId);

        if (!this.knownDeviceIds.has(targetId)) {
          const target = new UpnpOutputTarget(
            dev.id,
            dev.friendly_name || 'Receptor DLNA',
            dev.av_transport_url,
            dev.rendering_control_url
          );

          this.knownDeviceIds.add(targetId);
          this.audioRouter.registerTarget(target);
          console.log(`[UpnpScanner] Dispositivo UPnP/DLNA registrado: ${dev.friendly_name} (${targetId})`);
        }
      }

      // Remover dispositivos UPnP que não responderam mais na LAN
      for (const oldId of Array.from(this.knownDeviceIds)) {
        if (!currentFoundIds.has(oldId)) {
          console.log(`[UpnpScanner] Dispositivo UPnP desconectado da LAN: ${oldId}`);
          this.audioRouter.unregisterTarget(oldId);
          this.knownDeviceIds.delete(oldId);
        }
      }
    } catch (err) {
      console.warn('[UpnpScanner] Erro na descoberta SSDP UPnP:', err);
    } finally {
      this.isScanning = false;
    }
  }
}
