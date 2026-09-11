import type { Track } from '../types';

export type AudioTargetType = 'local' | 'bluetooth' | 'upnp' | 'cast';

export type AudioTargetState =
  | 'disconnected'
  | 'connecting'
  | 'idle'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'error';

export interface AudioDevice {
  id: string;
  name: string;
  type: AudioTargetType;
  isDefault?: boolean;
  isConnected?: boolean;
  details?: string;
  volumeSupported: boolean;
  approximateLatencyMs: number;
}

export interface AudioOutputTarget {
  readonly id: string;
  readonly name: string;
  readonly type: AudioTargetType;
  readonly isConnected?: boolean;
  readonly volumeSupported: boolean;
  readonly approximateLatencyMs: number;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Playback transport
  load(track: Track, streamUrl: string, startPositionSeconds?: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionSeconds: number): Promise<void>;
  setVolume(volume: number): Promise<void>; // 0.0 - 1.0
  setMuted(muted: boolean): Promise<void>;

  // State & Events
  getState(): AudioTargetState;
  onStateChange(callback: (state: AudioTargetState) => void): () => void;
  onTimeUpdate(callback: (currentTime: number, duration: number) => void): () => void;
  onEnded(callback: () => void): () => void;
  onError(callback: (error: string) => void): () => void;
}
