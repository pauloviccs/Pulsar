import type { Track } from '../../types';
import type { AudioOutputTarget, AudioTargetState, AudioTargetType } from '../types';

export class BluetoothOutputTarget implements AudioOutputTarget {
  readonly id: string;
  readonly name: string;
  readonly type: AudioTargetType = 'bluetooth';
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

  constructor(deviceId: string, name: string, getAudioElement: () => HTMLAudioElement | null) {
    this.id = `bt-${deviceId}`;
    this.deviceId = deviceId;
    this.name = name || 'Dispositivo de Áudio Bluetooth';
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
      throw new Error('O navegador/WebView2 atual não suporta setSinkId (roteamento de dispositivo de áudio).');
    }

    try {
      this.setState('connecting');
      // Redireciona a saída do áudio para o sinkId específico
      await (el as any).setSinkId(this.deviceId);
      this.attachListeners(el);
      this.setState('idle');
    } catch (e: any) {
      this.setState('error');
      throw new Error(`Falha ao rotear áudio para ${this.name}: ${e?.message || e}`);
    }
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
      if (e?.name !== 'AbortError') {
        console.warn(`[BluetoothOutputTarget] Erro ao chamar play() em ${this.name}:`, e);
      }
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
