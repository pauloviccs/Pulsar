import type { Track } from '../../types';
import type { AudioOutputTarget, AudioTargetState, AudioTargetType } from '../types';
import { safeInvoke } from '../../api/tauri';

export class CastOutputTarget implements AudioOutputTarget {
  readonly id: string;
  readonly name: string;
  readonly type: AudioTargetType = 'cast';
  readonly volumeSupported = true;
  readonly approximateLatencyMs = 300;

  private ip: string;
  private port: number;
  private state: AudioTargetState = 'idle';

  private currentTrack: Track | null = null;
  private nominalDuration: number = 0;
  private localCurrentTime: number = 0;
  private isPaused: boolean = false;
  private timerInterval: any = null;

  private stateChangeListeners = new Set<(state: AudioTargetState) => void>();
  private timeUpdateListeners = new Set<(currentTime: number, duration: number) => void>();
  private endedListeners = new Set<() => void>();
  private errorListeners = new Set<(error: string) => void>();

  constructor(ip: string, friendlyName: string, port: number = 8009) {
    this.id = `cast-${ip}`;
    this.ip = ip;
    this.name = friendlyName || `Google Home (${ip})`;
    this.port = port;
  }

  private setState(newState: AudioTargetState) {
    if (this.state !== newState) {
      this.state = newState;
      this.stateChangeListeners.forEach(cb => cb(newState));
    }
  }

  async connect(): Promise<void> {
    this.setState('connecting');
    this.setState('idle');
  }

  async disconnect(): Promise<void> {
    this.stopClock();
    try {
      await safeInvoke('cast_stop', { ip: this.ip });
    } catch {
      // Ignora erro ao desconectar
    }
    this.setState('disconnected');
  }

  async load(track: Track, streamUrl: string, startPositionSeconds: number = 0): Promise<void> {
    this.currentTrack = track;
    this.nominalDuration = track.duration_seconds || 0;
    this.localCurrentTime = startPositionSeconds;
    this.isPaused = false;

    try {
      this.setState('buffering');

      // Se a URL do stream for localhost/127.0.0.1, converte para o IP real da LAN
      let targetStreamUrl = streamUrl;
      if (streamUrl.includes('127.0.0.1') || streamUrl.includes('localhost')) {
        const lanBase = await safeInvoke<string>('get_local_stream_base_url').catch(() => '');
        if (lanBase) {
          targetStreamUrl = streamUrl.replace(/http:\/\/(127\.0\.0\.1|localhost):\d+/, lanBase);
        }
      }

      console.log(`[CastOutputTarget] Enviando stream para Google Home ${this.name} (${this.ip}): ${targetStreamUrl}`);

      const title = track.title || 'Música do Pulsar';
      const artist = track.artist || track.artist_guess || track.channel_name || 'Pulsar Music';

      await safeInvoke('cast_load_and_play', {
        ip: this.ip,
        port: this.port,
        streamUrl: targetStreamUrl,
        title,
        artist,
      });

      this.setState('playing');
      this.startClock();
    } catch (err: any) {
      this.setState('error');
      const msg = `Falha ao reproduzir no Google Home (${this.name}): ${err?.message || err}`;
      this.errorListeners.forEach(cb => cb(msg));
      throw new Error(msg);
    }
  }

  async play(): Promise<void> {
    this.isPaused = false;
    this.setState('playing');
    this.startClock();

    try {
      await safeInvoke('cast_play', { ip: this.ip });
    } catch (err: any) {
      console.warn(`[CastOutputTarget] Erro ao chamar play em ${this.name}:`, err);
    }
  }

  async pause(): Promise<void> {
    this.isPaused = true;
    this.setState('paused');
    this.stopClock();

    try {
      await safeInvoke('cast_pause', { ip: this.ip });
    } catch (err: any) {
      console.warn(`[CastOutputTarget] Erro ao chamar pause em ${this.name}:`, err);
    }
  }

  async seek(positionSeconds: number): Promise<void> {
    if (isNaN(positionSeconds)) return;
    this.localCurrentTime = Math.max(0, Math.min(this.nominalDuration || positionSeconds, positionSeconds));
    this.timeUpdateListeners.forEach(cb => cb(this.localCurrentTime, this.nominalDuration));
  }

  async setVolume(volume: number): Promise<void> {
    try {
      await safeInvoke('cast_set_volume', { ip: this.ip, volume: Math.max(0, Math.min(1, volume)) });
    } catch (err) {
      console.warn(`[CastOutputTarget] Erro ao ajustar volume em ${this.name}:`, err);
    }
  }

  async setMuted(muted: boolean): Promise<void> {
    try {
      const vol = muted ? 0.0 : 0.5;
      await safeInvoke('cast_set_volume', { ip: this.ip, volume: vol });
    } catch (err) {
      console.warn(`[CastOutputTarget] Erro ao alterar mudo em ${this.name}:`, err);
    }
  }

  private startClock() {
    this.stopClock();
    this.timerInterval = setInterval(() => {
      if (this.isPaused || this.state !== 'playing') return;

      this.localCurrentTime += 1;
      this.timeUpdateListeners.forEach(cb => cb(this.localCurrentTime, this.nominalDuration));

      if (this.nominalDuration > 3 && this.localCurrentTime >= this.nominalDuration - 1.5) {
        console.log(`[CastOutputTarget] Faixa finalizada em ${this.name}. Avançando fila...`);
        this.stopClock();
        this.setState('idle');
        this.endedListeners.forEach(cb => cb());
      }
    }, 1000);
  }

  private stopClock() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
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
