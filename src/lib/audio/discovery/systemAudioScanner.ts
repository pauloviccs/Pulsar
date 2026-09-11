import type { AudioRouter } from '../AudioRouter';
import { BluetoothOutputTarget } from '../targets/BluetoothOutputTarget';
import { safeInvoke } from '../../api/tauri';

export interface NativeSystemAudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  is_bluetooth: boolean;
  is_connected: boolean;
  device_type: 'speaker' | 'headphones' | 'bluetooth' | 'tv' | 'generic';
}

export class SystemAudioScanner {
  private audioRouter: AudioRouter;
  private knownDeviceIds = new Set<string>();
  private isScanning = false;
  private debounceTimer: any = null;
  private deviceChangeListener: (() => void) | null = null;
  private pollTimer: any = null;

  constructor(audioRouter: AudioRouter) {
    this.audioRouter = audioRouter;
  }

  public start() {
    this.scan();

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      this.deviceChangeListener = () => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.scan();
        }, 500);
      };

      navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeListener);
    }

    // Polling suave a cada 15 segundos para capturar conexões e desconexões de caixas JBL / fones Bluetooth
    this.pollTimer = setInterval(() => {
      this.scan();
    }, 15000);
  }

  public stop() {
    if (this.deviceChangeListener && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeListener);
      this.deviceChangeListener = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    clearTimeout(this.debounceTimer);
  }

  public async scan(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      // 1. Obter a lista oficial e nativa de dispositivos do Windows pelo backend Rust
      const nativeDevices = await safeInvoke<NativeSystemAudioDevice[]>('get_system_audio_devices').catch(() => []);

      // 2. Obter dispositivos expostos pelo Chromium/WebView2
      let htmlDevices: MediaDeviceInfo[] = [];
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        try {
          htmlDevices = await navigator.mediaDevices.enumerateDevices();
        } catch {
          // Silencia erro se API indisponível
        }
      }

      const audioOutputs = htmlDevices.filter(d => d.kind === 'audiooutput');
      const hasLabels = audioOutputs.some(d => d.label && d.label.trim().length > 0);

      // Se WebView2 não expor nomes, tenta autorizar silenciosamente se possível
      if (!hasLabels && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          tempStream.getTracks().forEach(t => t.stop());
          const recheck = await navigator.mediaDevices.enumerateDevices();
          audioOutputs.length = 0;
          audioOutputs.push(...recheck.filter(d => d.kind === 'audiooutput'));
        } catch {
          // Permissão não concedida, usaremos nomes nativos do Rust
        }
      }

      const currentFoundIds = new Set<string>();

      // 3. Processar dispositivos nativos do Windows (speakers JBL, fones Bluetooth, som HDMI)
      if (Array.isArray(nativeDevices) && nativeDevices.length > 0) {
        for (const natDev of nativeDevices) {
          // Ignora o alto-falante padrão primário para evitar duplicata com o LocalOutputTarget
          if (natDev.is_default && !natDev.is_bluetooth) {
            continue;
          }

          // Busca se há um deviceId correspondente no HTML5 MediaDevices
          let matchedSinkId = '';
          const matchedHtml = audioOutputs.find(d => 
            d.label && (
              d.label.toLowerCase().includes(natDev.name.toLowerCase()) || 
              natDev.name.toLowerCase().includes(d.label.toLowerCase())
            )
          );

          if (matchedHtml && matchedHtml.deviceId && matchedHtml.deviceId !== 'default') {
            matchedSinkId = matchedHtml.deviceId;
          }

          const targetId = `bt-${natDev.id}`;
          currentFoundIds.add(targetId);

          if (!this.knownDeviceIds.has(targetId)) {
            const target = new BluetoothOutputTarget(
              matchedSinkId || natDev.id,
              natDev.name,
              () => this.audioRouter.getAudioElement()
            );

            this.knownDeviceIds.add(targetId);
            this.audioRouter.registerTarget(target);
            console.log(`[SystemAudioScanner] Endpoint Windows/Bluetooth registrado: ${natDev.name} (${targetId})`);
          }
        }
      } else {
        // Fallback para quando o Rust não retornar dispositivos
        for (const device of audioOutputs) {
          if (!device.deviceId || device.deviceId === 'default' || device.deviceId === 'communications') {
            continue;
          }

          const targetId = `bt-${device.deviceId}`;
          currentFoundIds.add(targetId);

          if (!this.knownDeviceIds.has(targetId)) {
            const friendlyName = this.formatDeviceLabel(device.label);
            const target = new BluetoothOutputTarget(
              device.deviceId,
              friendlyName,
              () => this.audioRouter.getAudioElement()
            );

            this.knownDeviceIds.add(targetId);
            this.audioRouter.registerTarget(target);
          }
        }
      }

      // Remover dispositivos que foram desligados fisicamente
      for (const oldId of Array.from(this.knownDeviceIds)) {
        if (!currentFoundIds.has(oldId)) {
          console.log(`[SystemAudioScanner] Dispositivo desconectado: ${oldId}`);
          this.audioRouter.unregisterTarget(oldId);
          this.knownDeviceIds.delete(oldId);
        }
      }
    } catch (err) {
      console.warn('[SystemAudioScanner] Erro ao escanear dispositivos de áudio:', err);
    } finally {
      this.isScanning = false;
    }
  }

  private formatDeviceLabel(rawLabel: string): string {
    if (!rawLabel || rawLabel.trim().length === 0) {
      return 'Dispositivo de Áudio Externo';
    }

    return rawLabel
      .replace(/\s*\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)/g, '')
      .replace(/\s*\{[0-9a-fA-F-]+\}/g, '')
      .trim();
  }
}
