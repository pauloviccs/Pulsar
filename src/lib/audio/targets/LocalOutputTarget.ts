import type { Track } from '../../types';
import type { AudioOutputTarget, AudioTargetState, AudioTargetType } from '../types';

export class LocalOutputTarget implements AudioOutputTarget {
  readonly id = 'local-system-default';
  readonly name = 'Alto-falantes do Sistema (Padrão)';
  readonly type: AudioTargetType = 'local';
  readonly volumeSupported = true;
  readonly approximateLatencyMs = 20;

  private audioElement: HTMLAudioElement | null = null;
  private state: AudioTargetState = 'idle';

  private stateChangeListeners = new Set<(state: AudioTargetState) => void>();
  private timeUpdateListeners = new Set<(currentTime: number, duration: number) => void>();
  private endedListeners = new Set<() => void>();
  private errorListeners = new Set<(error: string) => void>();

  private cleanups: (() => void)[] = [];

  attachAudioElement(el: HTMLAudioElement) {
    this.detachAudioElement();
    this.audioElement = el;

    const onTime = () => {
      if (!this.audioElement || isNaN(this.audioElement.currentTime)) return;
      const cur = this.audioElement.currentTime;
      const dur = isNaN(this.audioElement.duration) ? 0 : this.audioElement.duration;
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
      // Ignora erro se não há src atribuído ou se o erro for apenas interrupção de troca (código 1)
      if (!this.audioElement?.src || this.audioElement.error?.code === 1) {
        return;
      }
      const mediaErr = this.audioElement.error;
      let errDetail = 'Erro desconhecido na reprodução local';
      if (mediaErr) {
        switch (mediaErr.code) {
          case 2: errDetail = 'Erro de rede ao carregar o fluxo de áudio'; break;
          case 3: errDetail = 'Falha na decodificação do codec de áudio'; break;
          case 4: errDetail = 'URL de áudio indisponível ou expirada'; break;
        }
        if (mediaErr.message) {
          errDetail += ` (${mediaErr.message})`;
        }
      }
      this.setState('error');
      this.errorListeners.forEach(cb => cb(errDetail));
    };

    const onLoadedMetadata = () => {
      if (!this.audioElement || isNaN(this.audioElement.duration)) return;
      const cur = isNaN(this.audioElement.currentTime) ? 0 : this.audioElement.currentTime;
      const dur = this.audioElement.duration;
      this.timeUpdateListeners.forEach(cb => cb(cur, dur));
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('pause', onPause);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);

    this.cleanups.push(() => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
    });

    this.setState('idle');
  }

  detachAudioElement() {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
    this.audioElement = null;
    this.setState('disconnected');
  }

  private setState(newState: AudioTargetState) {
    if (this.state !== newState) {
      this.state = newState;
      this.stateChangeListeners.forEach(cb => cb(newState));
    }
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.audioElement;
  }

  async connect(): Promise<void> {
    if (this.audioElement && 'setSinkId' in this.audioElement) {
      try {
        await (this.audioElement as any).setSinkId('');
      } catch (e) {
        console.warn('[LocalOutputTarget] Falha ao resetar sinkId para o padrão:', e);
      }
    }
    if (this.state === 'disconnected') {
      this.setState('idle');
    }
  }

  async disconnect(): Promise<void> {
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.setState('disconnected');
  }

  async load(track: Track, streamUrl: string, startPositionSeconds: number = 0): Promise<void> {
    if (!this.audioElement) {
      console.warn('[LocalOutputTarget] audioElement não vinculado');
      return;
    }

    if (this.audioElement.src !== streamUrl) {
      this.audioElement.src = streamUrl;
    }

    if (startPositionSeconds > 0) {
      const applyPosition = () => {
        if (this.audioElement) {
          this.audioElement.currentTime = startPositionSeconds;
        }
      };

      if (this.audioElement.readyState >= 1) {
        applyPosition();
      } else {
        this.audioElement.addEventListener('loadedmetadata', applyPosition, { once: true });
      }
    }
  }

  async play(): Promise<void> {
    if (!this.audioElement) return;
    try {
      await this.audioElement.play();
    } catch (e: any) {
      // Ignora abortos normais causados por nova carga, pause rápido ou política de autoplay
      if (e?.name === 'AbortError' || e?.name === 'NotAllowedError') {
        return;
      }
      console.warn('[LocalOutputTarget] Erro ao chamar play():', e?.message || e);
    }
  }

  async pause(): Promise<void> {
    if (!this.audioElement) return;
    this.audioElement.pause();
  }

  async seek(positionSeconds: number): Promise<void> {
    if (!this.audioElement || isNaN(positionSeconds)) return;
    this.audioElement.currentTime = positionSeconds;
  }

  async setVolume(volume: number): Promise<void> {
    if (!this.audioElement) return;
    const clamped = Math.max(0, Math.min(1, volume));
    this.audioElement.volume = clamped;
  }

  async setMuted(muted: boolean): Promise<void> {
    if (!this.audioElement) return;
    this.audioElement.muted = muted;
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
