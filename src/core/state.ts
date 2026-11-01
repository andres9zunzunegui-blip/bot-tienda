/**
 * Estado persistente del jugador y bus de eventos.
 * Persistencia: localStorage (estado) + IndexedDB (textos de material, ver materials/storage.ts).
 */
import type { Jurisdiccion } from "../legal/sources.ts";

export interface Avatar {
  name: string;
  skin: string;
  hair: string;
  suit: string;
  accessory: "ninguno" | "maletin" | "codigo" | "toga";
  glasses: boolean;
}

export interface MemoryCard {
  id: string;
  topic: string;
  prompt: string;
  answer: string;
  source: "contenido" | "material" | "error";
  ef: number;
  interval: number; // días
  reps: number;
  lapses: number;
  due: number; // epoch ms
  lastReview?: number;
  history: { at: number; grade: number }[];
}

export interface ErrorEntry {
  at: number;
  topic: string;
  activity: string;
  description: string;
  ref?: string;
}

export interface ActivityLog {
  at: number;
  kind: ActivityKind;
  id: string;
  topic: string;
  quality: number; // 0..1
  xp: number;
  coins: number;
  detail?: string;
}

export type ActivityKind = "simulacion" | "oral" | "red" | "repaso" | "material" | "estudio" | "escrito";

export interface Mission {
  id: string;
  title: string;
  description: string;
  kind: ActivityKind;
  topic?: string;
  target: number;
  progress: number;
  reward: { xp: number; coins: number };
  done: boolean;
  claimed: boolean;
  personalized: boolean;
}

export interface MaterialMeta {
  id: string;
  name: string;
  subject: string;
  kind: string;
  chars: number;
  addedAt: number;
  processed: "no" | "ia" | "local";
  units: { title: string; summary: string; concepts: string[] }[];
  warnings: string[];
}

/** Preferencias de accesibilidad y música. */
export interface Prefs {
  scale: number; // 1, 1.15, 1.3
  legible: boolean; // tipografía de alta legibilidad
  contrast: boolean; // alto contraste
  reduceMotion: boolean;
  simple: boolean; // modo simple: sin ciudad 3D, navegación por listas
  autoAdvance: boolean; // reels avanzan solos
  reelPace: number; // multiplicador de duración de reels (1 normal, 1.5 lento, 2 muy lento)
  narrate: boolean; // narración automática en reels
  dayCycle: boolean; // ciclo de día y noche según la hora real
  weather: "auto" | "despejado" | "lluvia"; // auto = llueve si suena música con lluvia
  music: { on: boolean; station: string; volume: number; rain: boolean };
}

export function defaultPrefs(): Prefs {
  const rm = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { scale: 1, legible: false, contrast: false, reduceMotion: rm, simple: false, autoAdvance: true, reelPace: 1, narrate: false, dayCycle: true, weather: "auto", music: { on: false, station: "biblioteca", volume: 0.5, rain: false } };
}

export interface GameState {
  version: number;
  createdAt: number;
  avatar: Avatar;
  xp: number;
  coins: number;
  badges: string[];
  owned: string[];
  equipped: string[];
  decorations: string[];
  unlocked: string[];
  cards: MemoryCard[];
  errors: ErrorEntry[];
  log: ActivityLog[];
  topicScores: Record<string, { at: number; q: number }[]>;
  missions: { date: string; list: Mission[] };
  specialMissions: Mission[];
  /** Progreso en los capítulos de teoría (reels). */
  chapters: Record<string, { seen: number; done: boolean; best: number; at?: number }>;
  welcomed: boolean;
  prefs: Prefs;
  streak: { count: number; best: number; last: string };
  exam: { date: string; label: string } | null;
  materials: MaterialMeta[];
  settings: { jurisdiccion: Jurisdiccion; fechaReferencia: string; oralRigor: "normal" | "exigente" };
  playerPos: { x: number; z: number };
}

export const STATE_VERSION = 1;
const KEY = "legal-life:state";

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultState(): GameState {
  return {
    version: STATE_VERSION,
    createdAt: Date.now(),
    avatar: { name: "Estudiante", skin: "#e0b48a", hair: "#3b2a1f", suit: "#24324f", accessory: "maletin", glasses: false },
    xp: 0,
    coins: 50,
    badges: [],
    owned: ["traje-azul", "maletin"],
    equipped: ["traje-azul", "maletin"],
    decorations: [],
    unlocked: ["facultad", "tribunal"],
    cards: [],
    errors: [],
    log: [],
    topicScores: {},
    missions: { date: "", list: [] },
    specialMissions: [],
    chapters: {},
    welcomed: false,
    prefs: defaultPrefs(),
    streak: { count: 0, best: 0, last: "" },
    exam: null,
    materials: [],
    settings: { jurisdiccion: "Nacional", fechaReferencia: today(), oralRigor: "normal" },
    playerPos: { x: 0, z: 6 },
  };
}

type Listener = (s: GameState, reason: string) => void;

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

class Store {
  state: GameState;
  private listeners = new Set<Listener>();
  private storage: StorageLike | null;

  constructor(storage: StorageLike | null) {
    this.storage = storage;
    this.state = this.load();
  }

  private load(): GameState {
    try {
      const raw = this.storage?.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.version === STATE_VERSION) {
          const d = defaultState();
          return { ...d, ...parsed, prefs: { ...d.prefs, ...(parsed.prefs ?? {}), music: { ...d.prefs.music, ...(parsed.prefs?.music ?? {}) } } };
        }
      }
    } catch {
      /* estado corrupto: se reinicia */
    }
    return defaultState();
  }

  save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("No se pudo guardar el progreso", e);
    }
  }

  update(reason: string, fn: (s: GameState) => void) {
    fn(this.state);
    this.save();
    for (const l of this.listeners) l(this.state, reason);
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  reset() {
    this.state = defaultState();
    this.save();
    for (const l of this.listeners) l(this.state, "reset");
  }

  export(): string {
    return JSON.stringify(this.state, null, 2);
  }

  import(json: string) {
    const parsed = JSON.parse(json);
    if (parsed.version !== STATE_VERSION) throw new Error("Versión de partida incompatible");
    this.state = { ...defaultState(), ...parsed };
    this.save();
    for (const l of this.listeners) l(this.state, "import");
  }
}

function detectStorage(): StorageLike | null {
  try {
    // En ventanas privadas u orígenes aislados el acceso mismo puede lanzar una excepción.
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}
const browserStorage = detectStorage();
export const store = new Store(browserStorage);
export { Store };

/* Bus de eventos de juego (notificaciones visuales: XP flotante, logros, etc.) */
export type GameEvent =
  | { type: "reward"; xp: number; coins: number; label: string }
  | { type: "levelup"; level: number; rank: string }
  | { type: "badge"; id: string; name: string }
  | { type: "unlock"; building: string; name: string }
  | { type: "toast"; text: string; tone?: "info" | "ok" | "warn" | "error" };

type EvListener = (e: GameEvent) => void;
const evListeners = new Set<EvListener>();
export const events = {
  emit(e: GameEvent) {
    for (const l of evListeners) l(e);
  },
  on(l: EvListener) {
    evListeners.add(l);
    return () => evListeners.delete(l);
  },
};
