/**
 * EFECTOS DE SONIDO de la interfaz, sintetizados con Web Audio (sin archivos):
 * tecla de máquina de escribir, papel, sello de goma, acierto, error y fanfarria.
 */

let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.6;

export function setSfx(on: boolean, vol = volume) {
  enabled = on;
  volume = vol;
}

function ac(): AudioContext | null {
  if (!enabled || typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(c: AudioContext, dur: number) {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = b;
  return s;
}

function env(c: AudioContext, t: number, peak: number, dur: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak * volume, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(c.destination);
  return g;
}

function tone(c: AudioContext, f: number, t: number, dur: number, peak: number, type: OscillatorType = "sine") {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.connect(env(c, t, peak, dur));
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  /** Tecla de máquina de escribir: botones comunes. */
  click() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    const n = noise(c, 0.03);
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2500 + Math.random() * 800;
    n.connect(hp).connect(env(c, t, 0.25, 0.03));
    n.start(t);
    tone(c, 180, t, 0.04, 0.08, "square");
  },
  /** Papel que se desliza: abrir paneles, pasar reels. */
  paper() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    const n = noise(c, 0.22);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1200, t);
    bp.frequency.exponentialRampToValueAtTime(3800, t + 0.2);
    bp.Q.value = 0.7;
    n.connect(bp).connect(env(c, t, 0.12, 0.22));
    n.start(t);
  },
  /** Sello de goma: aprobaciones, insignias, desbloqueos. */
  stamp() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    o.connect(env(c, t, 0.7, 0.25));
    o.start(t);
    o.stop(t + 0.27);
    const n = noise(c, 0.08);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1500;
    n.connect(lp).connect(env(c, t, 0.35, 0.08));
    n.start(t);
  },
  /** Acierto: dos notas ascendentes. */
  good() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    tone(c, 784, t, 0.18, 0.18, "triangle");
    tone(c, 1175, t + 0.09, 0.3, 0.16, "triangle");
  },
  /** Error: un "tum" grave y breve (sin estridencias). */
  bad() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    tone(c, 196, t, 0.18, 0.18, "sine");
    tone(c, 147, t + 0.08, 0.25, 0.14, "sine");
  },
  /** Fanfarria corta: subir de nivel. */
  fanfare() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => tone(c, f, t + i * 0.09, 0.35, 0.16, "triangle"));
  },
};
