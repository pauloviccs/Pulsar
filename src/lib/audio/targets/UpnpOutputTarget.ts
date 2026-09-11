import type { Track } from '../../types';
import type { AudioOutputTarget, AudioTargetState, AudioTargetType } from '../types';
import { safeInvoke } from '../../api/tauri';

export interface UpnpPositionInfo {
  track_duration_seconds: number;
  current_position_seconds: number;
  transport_state: string;
}

export class UpnpOutputTarget implements AudioOutputTarget {
  readonly id: string;
  readonly name: string;
  readonly type: AudioTargetType = 'upnp';
  readonly volumeSupported: boolean;
  readonly approximateLatencyMs = 600;

  private avTransportUrl: string;
  private renderingControlUrl?: string;
  private state: AudioTargetState = 'idle';

  private currentTrack: Track | null = null;
  private currentStreamUrl: string = '';
  private currentVolume: number = 1.0;
  private isMuted: boolean = false;

  private pollInterval: any = null;
  private isPollingActive = false;

  private stateChangeListeners = new Set<(state: AudioTargetState) => void>();
  private timeUpdateListeners = new Set<(currentTime: number, duration: number) => void>();
  private endedListeners = new Set<() => void>();
  private errorListeners = new Set<(error: string) => void>();

  constructor(
    id: string,
    friendlyName: string,
    avTransportUrl: string,
    renderingControlUrl?: string
  ) {
    this.id = `upnp-${id}`;
    this.name = friendlyName;
    this.avTransportUrl = avTransportUrl;
    this.renderingControlUrl = renderingControlUrl;
    this.volumeSupported = !!renderingControlUrl;
  }

  private setState(newState: AudioTargetState) {
    if (this.state !== newState) {
      this.state = newState;
      this.stateChangeListeners.forEach(cb => cb(newState));
    }
  }

  async connect(): Promise<void> {
    this.setState('connecting');
    try {
      this.setState('idle');
    } catch (err: any) {
      this.setState('error');
      throw new Error(`Falha ao conectar ao receptor UPnP (${this.name}): ${err?.message || err}`);
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    try {
      await safeInvoke('upnp_stop', { avTransportUrl: this.avTransportUrl });
    } catch {
      // Ignora erro ao desconectar
    }
    this.setState('disconnected');
  }

  async load(track: Track, streamUrl: string, startPositionSeconds: number = 0): Promise<void> {
    this.currentTrack = track;
    this.currentStreamUrl = streamUrl;
    this.nominalDuration = track.duration_seconds || 0;
    this.localCurrentTime = startPositionSeconds;
    this.isPausedInternally = false;

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

      console.log(`[UpnpOutputTarget] Enviando stream para ${this.name}: ${targetStreamUrl}`);

      const title = track.title || 'Música Desconhecida';
      const artist = track.artist || track.artist_guess || track.channel_name || 'Pulsar Music';
      const durationSeconds = track.duration_seconds || 0;

      await safeInvoke('upnp_set_uri_and_play', {
        avTransportUrl: this.avTransportUrl,
        streamUrl: targetStreamUrl,
        title,
        artist,
        durationSeconds,
      });

      if (startPositionSeconds > 0) {
        await this.seek(startPositionSeconds);
      }

      this.setState('playing');
      this.startPolling();
    } catch (err: any) {
      this.setState('error');
      const msg = `Falha ao reproduzir no UPnP (${this.name}): ${err?.message || err}`;
      this.errorListeners.forEach(cb => cb(msg));
      throw new Error(msg);
    }
  }

  async play(): Promise<void> {
    this.isPausedInternally = false;
    this.setState('playing');
    this.startPolling();

    try {
      await safeInvoke('upnp_play', { avTransportUrl: this.avTransportUrl });
    } catch (err: any) {
      console.warn(`[UpnpOutputTarget] Erro ao chamar play em ${this.name}, tentando retomar via seek:`, err);
      // Se a TV estava em STOP após Pause fallback, aplica seek para posição salva e executa play
      try {
        if (this.localCurrentTime > 0) {
          await safeInvoke('upnp_seek', {
            avTransportUrl: this.avTransportUrl,
            positionSeconds: this.localCurrentTime,
          });
        }
        await safeInvoke('upnp_play', { avTransportUrl: this.avTransportUrl });
      } catch (retryErr) {
        console.warn(`[UpnpOutputTarget] Falha na retentativa de play:`, retryErr);
      }
    }
  }

  async pause(): Promise<void> {
    this.isPausedInternally = true;
    this.setState('paused');
    this.stopPolling();

    try {
      await safeInvoke('upnp_pause', { avTransportUrl: this.avTransportUrl });
    } catch (err: any) {
      console.warn(`[UpnpOutputTarget] Erro ao chamar pause em ${this.name}:`, err);
    }
  }

  async seek(positionSeconds: number): Promise<void> {
    if (isNaN(positionSeconds)) return;
    const clampedPos = Math.max(0, Math.min(this.nominalDuration || positionSeconds, positionSeconds));
    this.localCurrentTime = clampedPos;
    this.timeUpdateListeners.forEach(cb => cb(clampedPos, this.nominalDuration));

    try {
      await safeInvoke('upnp_seek', {
        avTransportUrl: this.avTransportUrl,
        positionSeconds: clampedPos,
      });
    } catch (err) {
      console.warn(`[UpnpOutputTarget] Erro no seek em ${this.name}:`, err);
    }
  }

  async setVolume(volume: number): Promise<void> {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    if (!this.renderingControlUrl || this.isMuted) return;

    try {
      const vol100 = Math.round(this.currentVolume * 100);
      await safeInvoke('upnp_set_volume', {
        renderingControlUrl: this.renderingControlUrl,
        volume: vol100,
      });
    } catch (err) {
      console.warn(`[UpnpOutputTarget] Falha ao ajustar volume em ${this.name}:`, err);
    }
  }

  async setMuted(muted: boolean): Promise<void> {
    this.isMuted = muted;
    if (!this.renderingControlUrl) return;

    try {
      const vol = muted ? 0 : Math.round(this.currentVolume * 100);
      await safeInvoke('upnp_set_volume', {
        renderingControlUrl: this.renderingControlUrl,
        volume: vol,
      });
    } catch (err) {
      console.warn(`[UpnpOutputTarget] Falha ao ajustar mudo em ${this.name}:`, err);
    }
  }

  private nominalDuration: number = 0;
  private localCurrentTime: number = 0;
  private isPausedInternally: boolean = false;

  private startPolling() {
    this.stopPolling();
    this.isPollingActive = true;

    this.pollInterval = setInterval(async () => {
      if (!this.isPollingActive || this.isPausedInternally) return;

      // 1. Incrementa defensivamente o relógio mestre a cada 1 segundo
      this.localCurrentTime += 1;

      // 2. Tenta sincronizar com a telemetria real da TV se disponível
      try {
        const info = await safeInvoke<UpnpPositionInfo>('upnp_get_position_info', {
          avTransportUrl: this.avTransportUrl,
        });

        if (info && info.current_position_seconds > 0) {
          this.localCurrentTime = info.current_position_seconds;
          if (info.track_duration_seconds > 0) {
            this.nominalDuration = info.track_duration_seconds;
          }
        }
      } catch {
        // Falhas transitórias de polling da TV não quebram mais a timeline do Pulsar
      }

      // 3. Emite atualização de tempo para a UI (scrubber, timer)
      const dur = this.nominalDuration > 0 ? this.nominalDuration : (this.currentTrack?.duration_seconds || 0);
      this.timeUpdateListeners.forEach(cb => cb(this.localCurrentTime, dur));

      // 4. Detecção de fim da faixa garantida: se atingir a duração nominal, avança a fila
      if (dur > 3 && this.localCurrentTime >= dur - 1.5) {
        console.log(`[UpnpOutputTarget] Faixa finalizada em ${this.name}. Avançando para a próxima música...`);
        this.stopPolling();
        this.setState('idle');
        this.endedListeners.forEach(cb => cb());
      }
    }, 1000);
  }

  private stopPolling() {
    this.isPollingActive = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
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
