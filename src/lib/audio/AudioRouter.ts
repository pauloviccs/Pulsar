import { writable, get } from 'svelte/store';
import type { Track } from '../types';
import type { AudioDevice, AudioOutputTarget, AudioTargetState } from './types';
import { LocalOutputTarget } from './targets/LocalOutputTarget';

class AudioRouter {
  private localTarget = new LocalOutputTarget();
  private targets = new Map<string, AudioOutputTarget>();
  private activeTargetInstance: AudioOutputTarget = this.localTarget;

  // Svelte Stores para consumo reativo na UI
  public readonly availableDevices = writable<AudioDevice[]>([
    {
      id: this.localTarget.id,
      name: this.localTarget.name,
      type: this.localTarget.type,
      isDefault: true,
      volumeSupported: this.localTarget.volumeSupported,
      approximateLatencyMs: this.localTarget.approximateLatencyMs,
    }
  ]);

  public readonly activeDevice = writable<AudioDevice>({
    id: this.localTarget.id,
    name: this.localTarget.name,
    type: this.localTarget.type,
    isDefault: true,
    volumeSupported: this.localTarget.volumeSupported,
    approximateLatencyMs: this.localTarget.approximateLatencyMs,
  });

  public readonly connectStatus = writable<'idle' | 'discovering' | 'connecting' | 'connected' | 'error'>('idle');

  // Listeners registrados externamente (ex: GlobalAudioEngine ou Stores)
  private timeUpdateCallbacks = new Set<(currentTime: number, duration: number) => void>();
  private endedCallbacks = new Set<() => void>();
  private stateChangeCallbacks = new Set<(state: AudioTargetState) => void>();
  private errorCallbacks = new Set<(error: string) => void>();

  private activeTargetCleanups: (() => void)[] = [];

  // Rastreamento de estado de reprodução para migração suave entre sinks
  private currentTrack: Track | null = null;
  private currentStreamUrl: string = '';
  private currentPosition: number = 0;
  private isPlayingState: boolean = false;

  constructor() {
    this.registerTarget(this.localTarget);
    this.bindTargetListeners(this.localTarget);
  }

  public initLocalElement(el: HTMLAudioElement) {
    this.localTarget.attachAudioElement(el);
  }

  public registerTarget(target: AudioOutputTarget) {
    this.targets.set(target.id, target);
    this.updateAvailableDevicesStore();
  }

  public unregisterTarget(targetId: string) {
    if (targetId === this.localTarget.id) return; // Nunca remove o local padrão
    if (this.activeTargetInstance.id === targetId) {
      this.fallbackToLocal('Dispositivo desconectado');
    }
    this.targets.delete(targetId);
    this.updateAvailableDevicesStore();
  }

  private updateAvailableDevicesStore() {
    const list: AudioDevice[] = Array.from(this.targets.values()).map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      isDefault: t.id === this.localTarget.id,
      volumeSupported: t.volumeSupported,
      approximateLatencyMs: t.approximateLatencyMs,
    }));
    this.availableDevices.set(list);
  }

  private bindTargetListeners(target: AudioOutputTarget) {
    // Limpar inscrições anteriores
    this.activeTargetCleanups.forEach(fn => fn());
    this.activeTargetCleanups = [];

    const cleanupTime = target.onTimeUpdate((cur, dur) => {
      this.currentPosition = cur;
      this.timeUpdateCallbacks.forEach(cb => cb(cur, dur));
    });

    const cleanupState = target.onStateChange(st => {
      this.isPlayingState = (st === 'playing');
      this.stateChangeCallbacks.forEach(cb => cb(st));
    });

    const cleanupEnded = target.onEnded(() => {
      this.endedCallbacks.forEach(cb => cb());
    });

    const cleanupError = target.onError(err => {
      console.error(`[AudioRouter] Erro no sink ativo (${target.name}):`, err);
      this.errorCallbacks.forEach(cb => cb(err));
      // Aciona o fallback se o erro ocorreu em um dispositivo remoto
      if (target.id !== this.localTarget.id) {
        this.fallbackToLocal(`Erro de streaming em ${target.name}: ${err}`);
      }
    });

    this.activeTargetCleanups.push(cleanupTime, cleanupState, cleanupEnded, cleanupError);
  }

  public async selectDevice(deviceId: string): Promise<boolean> {
    const target = this.targets.get(deviceId);
    if (!target) {
      console.warn(`[AudioRouter] Dispositivo ${deviceId} não encontrado.`);
      return false;
    }

    if (this.activeTargetInstance.id === deviceId) {
      return true; // Já é o dispositivo ativo
    }

    console.log(`[AudioRouter] Alternando saída: ${this.activeTargetInstance.name} -> ${target.name}`);
    this.connectStatus.set('connecting');

    const wasPlaying = this.isPlayingState;
    const switchPos = this.currentPosition;
    const track = this.currentTrack;
    const url = this.currentStreamUrl;

    try {
      // Pausa e desconecta o sink anterior
      await this.activeTargetInstance.pause();
      if (this.activeTargetInstance.id !== this.localTarget.id) {
        await this.activeTargetInstance.disconnect();
      }

      // Conecta o novo destino
      await target.connect();
      this.activeTargetInstance = target;
      this.bindTargetListeners(target);

      this.activeDevice.set({
        id: target.id,
        name: target.name,
        type: target.type,
        isDefault: target.id === this.localTarget.id,
        volumeSupported: target.volumeSupported,
        approximateLatencyMs: target.approximateLatencyMs,
      });

      // Carrega o áudio e retoma playback na mesma posição
      if (track && url) {
        await target.load(track, url, switchPos);
        if (wasPlaying) {
          await target.play();
        }
      }

      this.connectStatus.set('connected');
      return true;
    } catch (e: any) {
      console.error(`[AudioRouter] Falha ao conectar em ${target.name}:`, e);
      this.connectStatus.set('error');
      await this.fallbackToLocal(`Falha ao conectar no dispositivo ${target.name}`);
      return false;
    }
  }

  private async fallbackToLocal(reason: string) {
    console.warn(`[AudioRouter] Disparando Fallback para Áudio Local. Motivo: ${reason}`);
    this.activeTargetInstance = this.localTarget;
    this.bindTargetListeners(this.localTarget);

    this.activeDevice.set({
      id: this.localTarget.id,
      name: this.localTarget.name,
      type: this.localTarget.type,
      isDefault: true,
      volumeSupported: this.localTarget.volumeSupported,
      approximateLatencyMs: this.localTarget.approximateLatencyMs,
    });

    if (this.currentTrack && this.currentStreamUrl) {
      try {
        await this.localTarget.load(this.currentTrack, this.currentStreamUrl, this.currentPosition);
        if (this.isPlayingState) {
          await this.localTarget.play();
        }
      } catch (e) {
        console.error('[AudioRouter] Erro no fallback local:', e);
      }
    }
  }

  // Comandos de Transporte Delegados ao Target Ativo
  public async load(track: Track, streamUrl: string, startPositionSeconds: number = 0): Promise<void> {
    this.currentTrack = track;
    this.currentStreamUrl = streamUrl;
    this.currentPosition = startPositionSeconds;
    await this.activeTargetInstance.load(track, streamUrl, startPositionSeconds);
  }

  public async play(): Promise<void> {
    this.isPlayingState = true;
    await this.activeTargetInstance.play();
  }

  public async pause(): Promise<void> {
    this.isPlayingState = false;
    await this.activeTargetInstance.pause();
  }

  public async seek(positionSeconds: number): Promise<void> {
    this.currentPosition = positionSeconds;
    await this.activeTargetInstance.seek(positionSeconds);
  }

  public async setVolume(volume: number): Promise<void> {
    await this.activeTargetInstance.setVolume(volume);
  }

  public async setMuted(muted: boolean): Promise<void> {
    await this.activeTargetInstance.setMuted(muted);
  }

  public getActiveTarget(): AudioOutputTarget {
    return this.activeTargetInstance;
  }

  public onTimeUpdate(callback: (currentTime: number, duration: number) => void): () => void {
    this.timeUpdateCallbacks.add(callback);
    return () => this.timeUpdateCallbacks.delete(callback);
  }

  public onEnded(callback: () => void): () => void {
    this.endedCallbacks.add(callback);
    return () => this.endedCallbacks.delete(callback);
  }

  public onStateChange(callback: (state: AudioTargetState) => void): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => this.stateChangeCallbacks.delete(callback);
  }

  public onError(callback: (error: string) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }
}

export const audioRouter = new AudioRouter();
