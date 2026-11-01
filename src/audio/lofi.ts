/**
 * MÚSICA LOFI GENERATIVA (Web Audio API).
 * No usa archivos ni servicios externos: compone en tiempo real acordes de
 * piano eléctrico, bajo, batería con swing, melodías esporádicas, crujido de
 * vinilo y lluvia opcional. Las progresiones cambian cada 8 compases con
 * variaciones aleatorias, así que la música no se repite y dura indefinidamente.
 * También puede reproducir un archivo de audio propio del usuario.
 */

export interface Station {
  id: string;
  name: string;
  mood: string;
  bpm: number;
  progressions: number[][][]; // progresiones → acordes → notas MIDI
  drums: number; // 0..1 intensidad
  melody: number; // probabilidad de nota melódica por corchea
  rain: boolean;
}

const m = (...n: number[]) => n;
// Voicings jazzeros (MIDI). 60 = do central.
const PROG_A = [m(50, 53, 57, 60, 64), m(43, 53, 57, 59, 64), m(48, 52, 55, 59, 62), m(45, 52, 55, 60, 64)]; // Dm9 G13 Cmaj9 Am9
const PROG_B = [m(41, 52, 55, 57, 60), m(40, 50, 55, 59, 62), m(38, 53, 57, 60, 64), m(43, 50, 53, 57, 59)]; // Fmaj9 Em7 Dm9 G9
const PROG_C = [m(45, 55, 59, 60, 64), m(41, 52, 57, 60, 64), m(48, 55, 59, 62, 64), m(43, 53, 57, 59, 62)]; // Am(add9) Fmaj7 Cmaj9 G7
const PROG_D = [m(44, 55, 58, 60, 63), m(49, 56, 60, 63, 65), m(46, 56, 60, 61, 65), m(51, 55, 58, 61, 63)]; // Abmaj7 Dbmaj9 Bbm9 Eb7

export const STATIONS: Station[] = [
  { id: "biblioteca", name: "Biblioteca nocturna", mood: "Concentración profunda", bpm: 72, progressions: [PROG_A, PROG_C], drums: 0.7, melody: 0.12, rain: false },
  { id: "cafe", name: "Café de la Facultad", mood: "Repaso tranquilo", bpm: 82, progressions: [PROG_B, PROG_A], drums: 0.9, melody: 0.2, rain: false },
  { id: "lluvia", name: "Lluvia en Tribunales", mood: "Lectura larga", bpm: 66, progressions: [PROG_D, PROG_C], drums: 0.45, melody: 0.08, rain: true },
];

const mtof = (n: number) => 440 * 2 ** ((n - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];

export class LofiPlayer {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private tone!: BiquadFilterNode;
  private crackle: AudioBufferSourceNode | null = null;
  private rainSrc: AudioBufferSourceNode | null = null;
  private rainGain!: GainNode;
  private timer = 0;
  private nextTime = 0;
  private step = 0; // corcheas (8 por compás)
  private bar = 0;
  private prog: number[][] = PROG_A;
  station: Station = STATIONS[0];
  playing = false;
  volume = 0.5;
  rain = false;
  private fileAudio: HTMLAudioElement | null = null;
  fileName = "";
  private listeners = new Set<() => void>();

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const l of this.listeners) l();
  }

  get supported() {
    return typeof window !== "undefined" && ("AudioContext" in window || "webkitAudioContext" in window);
  }

  private ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume * 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    // Bus musical con filtro "de cinta": cálido y apagado
    this.tone = ctx.createBiquadFilter();
    this.tone.type = "lowpass";
    this.tone.frequency.value = 2200;
    this.tone.Q.value = 0.4;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.9;
    this.musicBus.connect(this.tone).connect(this.master);
    // Wow & flutter: modula suavemente el corte del filtro
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(this.tone.frequency);
    lfo.start();
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    this.rainGain.connect(this.master);
    return ctx;
  }

  private noiseBuffer(seconds: number, kind: "white" | "brown" | "crackle") {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w;
      else if (kind === "brown") {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = (Math.random() < 0.0007 ? (Math.random() * 2 - 1) * 0.9 : 0) + w * 0.012;
    }
    return buf;
  }

  async play() {
    if (this.fileAudio) return this.playFile();
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
    if (this.playing) return;
    this.playing = true;
    this.prog = this.station.progressions[0];
    this.nextTime = ctx.currentTime + 0.1;
    this.step = 0;
    this.bar = 0;
    // Vinilo
    this.crackle = ctx.createBufferSource();
    this.crackle.buffer = this.noiseBuffer(4, "crackle");
    this.crackle.loop = true;
    const cg = ctx.createGain();
    cg.gain.value = 0.5;
    this.crackle.connect(cg).connect(this.master);
    this.crackle.start();
    // Lluvia
    this.rainSrc = ctx.createBufferSource();
    this.rainSrc.buffer = this.noiseBuffer(6, "brown");
    this.rainSrc.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = "highpass";
    rf.frequency.value = 400;
    this.rainSrc.connect(rf).connect(this.rainGain);
    this.rainSrc.start();
    this.applyRain();
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.emit();
  }

  pause() {
    if (this.fileAudio) {
      this.fileAudio.pause();
      this.playing = false;
      this.emit();
      return;
    }
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    try {
      this.crackle?.stop();
      this.rainSrc?.stop();
    } catch {
      /* ya detenidos */
    }
    this.emit();
  }

  toggle() {
    return this.playing ? this.pause() : this.play();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v * 0.6, this.ctx.currentTime, 0.1);
    if (this.fileAudio) this.fileAudio.volume = v;
    this.emit();
  }

  setStation(id: string) {
    const st = STATIONS.find((s) => s.id === id) ?? STATIONS[0];
    this.station = st;
    this.prog = st.progressions[0];
    this.rain = st.rain;
    if (this.fileAudio) this.clearFile();
    this.applyRain();
    this.emit();
  }

  setRain(on: boolean) {
    this.rain = on;
    this.applyRain();
    this.emit();
  }

  private applyRain() {
    if (!this.ctx) return;
    this.rainGain.gain.setTargetAtTime(this.rain && this.playing ? 0.22 : 0, this.ctx.currentTime, 0.8);
  }

  /** Reproduce un archivo propio (p. ej. un mix de 2 horas descargado por el usuario). */
  async useFile(file: File) {
    this.pause();
    this.clearFile();
    this.fileAudio = new Audio(URL.createObjectURL(file));
    this.fileAudio.loop = true;
    this.fileAudio.volume = this.volume;
    this.fileName = file.name;
    await this.playFile();
  }

  clearFile() {
    if (!this.fileAudio) return;
    this.fileAudio.pause();
    URL.revokeObjectURL(this.fileAudio.src);
    this.fileAudio = null;
    this.fileName = "";
    this.playing = false;
    this.emit();
  }

  private async playFile() {
    if (!this.fileAudio) return;
    await this.fileAudio.play();
    this.playing = true;
    this.emit();
  }

  /* ------------------------------ Secuenciador ------------------------------ */

  private schedule() {
    const ctx = this.ctx!;
    const eighth = 60 / this.station.bpm / 2;
    while (this.nextTime < ctx.currentTime + 0.2) {
      const swing = this.step % 2 === 1 ? eighth * 0.18 : 0;
      this.playStep(this.nextTime + swing, eighth);
      this.nextTime += eighth;
      this.step++;
      if (this.step % 8 === 0) {
        this.bar++;
        if (this.bar % 8 === 0) {
          const ps = this.station.progressions;
          this.prog = ps[Math.floor(Math.random() * ps.length)];
        }
      }
    }
  }

  private playStep(t: number, eighth: number) {
    const s8 = this.step % 8;
    const chordIdx = Math.floor(this.bar / 2) % this.prog.length; // cada acorde dura 2 compases
    const chord = this.prog[chordIdx];
    const d = this.station.drums;
    const fill = this.bar % 4 === 3;
    // Acorde: al inicio de cada compás, con un "rasguido" humano
    if (s8 === 0) chord.slice(1).forEach((n, k) => this.keys(mtof(n), t + k * 0.018 + Math.random() * 0.01, eighth * 7, 0.07));
    if (s8 === 5 && Math.random() < 0.35) chord.slice(2).forEach((n, k) => this.keys(mtof(n), t + k * 0.015, eighth * 2.5, 0.045));
    // Bajo
    if (s8 === 0) this.bass(mtof(chord[0] - 12), t, eighth * 3.5);
    if (s8 === 3 && Math.random() < 0.6) this.bass(mtof(chord[0] - 12 + (Math.random() < 0.5 ? 7 : 12)), t, eighth * 1.5);
    if (s8 === 6 && Math.random() < 0.4) this.bass(mtof(chord[0] - 12), t, eighth);
    // Batería
    if (d > 0) {
      if (s8 === 0 || (s8 === 5 && Math.random() < 0.5) || (fill && s8 === 7)) this.kick(t, 0.55 * d);
      if (s8 === 2 || s8 === 6) this.snare(t, 0.28 * d);
      if (Math.random() < 0.85) this.hat(t, (s8 % 2 ? 0.035 : 0.055) * d);
    }
    // Melodía esporádica (pentatónica sobre la fundamental del acorde)
    if (Math.random() < this.station.melody) {
      const root = chord[0] + 24;
      const n = root + PENTA[Math.floor(Math.random() * PENTA.length)] + (Math.random() < 0.3 ? 12 : 0);
      this.bell(mtof(n), t, eighth * 3, 0.05);
    }
  }

  private keys(f: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = f * 2;
    o2.detune.value = 4;
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    o1.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.musicBus);
    o1.start(t);
    o2.start(t);
    o1.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  private bell(f: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private bass(f: number, t: number, dur: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.32);
  }

  private snare(t: number, vol: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.snareBuf ??= this.noiseBuffer(0.3, "white");
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(bp).connect(g).connect(this.musicBus);
    src.start(t);
    src.stop(t + 0.2);
  }
  private snareBuf: AudioBuffer | null = null;

  private hat(t: number, vol: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.snareBuf ??= this.noiseBuffer(0.3, "white");
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp).connect(g).connect(this.musicBus);
    src.start(t);
    src.stop(t + 0.06);
  }
}

export const lofi = new LofiPlayer();
