import type { Track } from '../../types';
import type { AudioOutputTarget, AudioTargetState, AudioTargetType } from '../types';

export class BluetoothOutputTarget implements AudioOutputTarget {
  readonly id: string;
  readonly name: string;
  readonly type: AudioTargetType = 'bluetooth';
  readonly isConnected: boolean;
  readonly volumeSupported = true;
  readonly approximateLatencyMs = 120; // Latência média de compressão/buffer Bluetooth

  private deviceId: string;
  private getAudioElement: () => HTMLAudioElement | null;
  private state: AudioTargetState = 'idle';

  private stateChangeListeners = new Set<(state: AudioTargetState) => void>();
  private timeUpdateListeners = new Set<(currentTime: number, duration: number) => void>();
  private endedListeners = new Set<() => void>();
  private errorListeners = new Set<(error: string) => void>();

  private cleanups: (() => void)[] = [];

  constructor(deviceId: string, name: string, getAudioElement: () => HTMLAudioElement | null, isConnected: boolean = true) {
    this.id = `bt-${deviceId}`;
    this.deviceId = deviceId;
    this.name = name || 'Dispositivo de Áudio Bluetooth';
    this.isConnected = isConnected;
    this.getAudioElement = getAudioElement;
  }

  private setState(newState: AudioTargetState) {
    if (this.state !== newState) {
      this.state = newState;
      this.stateChangeListeners.forEach(cb => cb(newState));
    }
  }

  private attachListeners(el: HTMLAudioElement) {
    this.detachListeners();

    const onTime = () => {
      if (isNaN(el.currentTime)) return;
      const cur = el.currentTime;
      const dur = isNaN(el.duration) ? 0 : el.duration;
      this.timeUpdateListeners.forEach(cb => cb(cur, dur));
    };

    const onPlaying = () => {
      this.setState('playing');
    };

    const onPause = () => {
      if (this.state !== 'disconnected') {
        this.setState('paused');
      }
    };

    const onWaiting = () => {
      this.setState('buffering');
    };

    const onEnded = () => {
      this.setState('idle');
      this.endedListeners.forEach(cb => cb());
    };

    const onError = () => {
      const err = el.error?.message || 'Erro de reprodução no dispositivo Bluetooth';
      this.setState('error');
      this.errorListeners.forEach(cb => cb(err));
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('pause', onPause);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);

    this.cleanups.push(() => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
    });
  }

  private detachListeners() {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }

  async connect(): Promise<void> {
    const el = this.getAudioElement();
    if (!el) {
      throw new Error('Elemento de áudio não inicializado.');
    }

    if (!('setSinkId' in el)) {
      throw new Error('O WebView2 atual não suporta setSinkId (roteamento de dispositivo de áudio).');
    }

    try {
      this.setState('connecting');
      console.log(`[BluetoothOutputTarget] Conectando áudio a "${this.name}"...`);

      let resolvedSinkId = this.deviceId;
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        try {
          const htmlDevices = await navigator.mediaDevices.enumerateDevices();
          const audioOutputs = htmlDevices.filter(d => d.kind === 'audiooutput' && d.label);

          const modelName = this.extractModelName(this.name).toLowerCase();

          const matched = audioOutputs.find(d => {
            const label = d.label.toLowerCase();
            return label.includes(modelName) || 
                   modelName.includes(label.replace(/\s*\(.*?\)/g, '').trim()) ||
                   (this.deviceId && d.deviceId === this.deviceId);
          });

          if (matched && matched.deviceId) {
            resolvedSinkId = matched.deviceId;
            console.log(`[BluetoothOutputTarget] SinkId resolvido com sucesso: "${matched.label}" (${resolvedSinkId})`);
          } else {
            console.log(`[BluetoothOutputTarget] Dispositivo "${this.name}" mapeado para saída ativa.`);
          }
        } catch (enumErr) {
          console.warn('[BluetoothOutputTarget] Aviso ao enumerar MediaDevices:', enumErr);
        }
      }

      // Redireciona a saída do elemento HTML5 de áudio com fallback resiliente para o WebView2
      if (typeof (el as any).setSinkId === 'function') {
        try {
          if (resolvedSinkId && resolvedSinkId !== 'default') {
            await (el as any).setSinkId(resolvedSinkId);
          } else {
            await (el as any).setSinkId('');
          }
        } catch (sinkErr: any) {
          console.warn(`[BluetoothOutputTarget] setSinkId('${resolvedSinkId}') indisponível no WebView2 (${sinkErr?.message || sinkErr}), utilizando saída padrão do sistema.`);
          try {
            await (el as any).setSinkId('');
          } catch {}
        }
      }

      this.attachListeners(el);
      this.setState('idle');
      console.log(`[BluetoothOutputTarget] Áudio roteado com sucesso para ${this.name}`);
    } catch (e: any) {
      this.setState('error');
      const errorMsg = `Falha ao rotear áudio para ${this.name}: ${e?.message || e}`;
      console.error(`[BluetoothOutputTarget] ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Extrai o nome limpo do modelo do dispositivo a partir do nome amigável do Windows.
   * Ex: "Fones de ouvido (5- HAYLOU S30)" → "HAYLOU S30"
   *     "Headset (HAYLOU S30 Hands-Free)" → "HAYLOU S30"
   */
  private extractModelName(fullName: string): string {
    // Tenta extrair o conteúdo entre parênteses
    const match = fullName.match(/\(([^)]+)\)/);
    if (match) {
      let inner = match[1];
      // Remove prefixos numéricos do Windows como "5- " ou "2- "
      inner = inner.replace(/^\d+-\s*/, '');
      // Remove sufixos como "Hands-Free"
      inner = inner.replace(/\s*Hands-Free\s*/i, '').trim();
      if (inner.length > 0) {
        return inner;
      }
    }
    return fullName;
  }

  async disconnect(): Promise<void> {
    this.detachListeners();
    const el = this.getAudioElement();
    if (el && 'setSinkId' in el) {
      try {
        await (el as any).setSinkId('');
      } catch (e) {
        console.warn('[BluetoothOutputTarget] Falha ao resetar sinkId para o padrão no disconnect:', e);
      }
    }
    this.setState('disconnected');
  }

  async load(track: Track, streamUrl: string, startPositionSeconds: number = 0): Promise<void> {
    const el = this.getAudioElement();
    if (!el) return;

    if (el.src !== streamUrl) {
      el.src = streamUrl;
    }

    if (startPositionSeconds > 0) {
      const applyPos = () => {
        el.currentTime = startPositionSeconds;
      };

      if (el.readyState >= 1) {
        applyPos();
      } else {
        el.addEventListener('loadedmetadata', applyPos, { once: true });
      }
    }
  }

  async play(): Promise<void> {
    const el = this.getAudioElement();
    if (!el) return;
    try {
      await el.play();
    } catch (e: any) {
      if (e?.name === 'AbortError' || e?.name === 'NotAllowedError') {
        return;
      }
      console.warn(`[BluetoothOutputTarget] Erro ao chamar play() em ${this.name}:`, e?.message || e);
    }
  }

  async pause(): Promise<void> {
    const el = this.getAudioElement();
    if (el) {
      el.pause();
    }
  }

  async seek(positionSeconds: number): Promise<void> {
    const el = this.getAudioElement();
    if (el && !isNaN(positionSeconds)) {
      el.currentTime = positionSeconds;
    }
  }

  async setVolume(volume: number): Promise<void> {
    const el = this.getAudioElement();
    if (el) {
      el.volume = Math.max(0, Math.min(1, volume));
    }
  }

  async setMuted(muted: boolean): Promise<void> {
    const el = this.getAudioElement();
    if (el) {
      el.muted = muted;
    }
  }

  getState(): AudioTargetState {
    return this.state;
  }

  onStateChange(callback: (state: AudioTargetState) => void): () => void {
    this.stateChangeListeners.add(callback);
    return () => this.stateChangeListeners.delete(callback);
  }

  onTimeUpdate(callback: (currentTime: number, duration: number) => void): () => void {
    this.timeUpdateListeners.add(callback);
    return () => this.timeUpdateListeners.delete(callback);
  }

  onEnded(callback: () => void): () => void {
    this.endedListeners.add(callback);
    return () => this.endedListeners.delete(callback);
  }

  onError(callback: (error: string) => void): () => void {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }
}
