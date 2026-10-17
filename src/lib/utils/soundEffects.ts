/**
 * Utilitário de Efeitos Sonoros Nativos do Pulsar (Web Audio API)
 * Gera chimes táteis com estética acústica Liquid Glass / Apple Audio.
 */

let audioCtx: AudioContext | null = null;
let lastChimeTime = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Toca um alerta suave, elegante e cristalino no estilo "Apple Glass Bell"
 * para qualquer notificação recebida na Central de Notificações.
 */
export function playNotificationSound() {
  const now = Date.now();
  // Throttle de 400ms para evitar estouro em rajada de notificações simultâneas
  if (now - lastChimeTime < 400) return;
  lastChimeTime = now;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // Oscilador 1: Tom base cristalino (C6 - 1046.5 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, t);
    osc1.frequency.exponentialRampToValueAtTime(1318.5, t + 0.12); // Transição sutil para E6

    gain1.gain.setValueAtTime(0.0001, t);
    gain1.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    // Oscilador 2: Harmônico superior suave (G6 - 1568 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1568.0, t + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(2093.0, t + 0.18); // C7

    gain2.gain.setValueAtTime(0.0001, t);
    gain2.gain.setValueAtTime(0.0001, t + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.05, t + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

    // Filtro passa-baixo suave para eliminar arestas agudas e dar corpo tátil
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);

    // Conexões de áudio
    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(filter);
    gain2.connect(filter);
    filter.connect(ctx.destination);

    osc1.start(t);
    osc1.stop(t + 0.46);
    osc2.start(t + 0.04);
    osc2.stop(t + 0.40);
  } catch (e) {
    console.debug('[Pulsar Sound] Chime de notificação:', e);
  }
}
