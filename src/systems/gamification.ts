/**
 * GAMIFICACIÓN — la progresión depende de la CALIDAD del aprendizaje.
 *  - XP = base × factor de calidad. Por debajo del 40 % de calidad no hay XP.
 *  - Las monedas sólo se otorgan al aprobar (calidad ≥ 60 %).
 *  - No existe recompensa por tiempo conectado ni por velocidad.
 *  - Bonus de retención: recordar correctamente tras un intervalo largo da XP extra.
 */
import { events, store, today, type ActivityKind, type GameState, type Mission } from "../core/state.ts";
import { newCard, upsertCard } from "./memory.ts";
import { TOPICS } from "./topics.ts";

export const BASE_XP: Record<ActivityKind, number> = {
  simulacion: 250,
  oral: 160,
  red: 120,
  repaso: 12,
  material: 40,
  estudio: 30,
  escrito: 140,
};
const BASE_COINS: Record<ActivityKind, number> = {
  simulacion: 60,
  oral: 40,
  red: 25,
  repaso: 2,
  material: 10,
  estudio: 5,
  escrito: 35,
};

export function qualityFactor(q: number): number {
  if (q < 0.4) return 0;
  return Math.min(1, (q - 0.4) / 0.6) ** 1.2;
}

export function computeReward(kind: ActivityKind, quality: number, bonus = 0): { xp: number; coins: number } {
  const xp = Math.round(BASE_XP[kind] * qualityFactor(quality) + bonus);
  const coins = quality >= 0.6 ? Math.round(BASE_COINS[kind] * (0.5 + quality / 2)) : 0;
  return { xp, coins };
}

/** XP acumulada necesaria para alcanzar el nivel n (nivel 1 = 0 XP). */
export function xpForLevel(n: number): number {
  return Math.round(100 * (n - 1) ** 1.6);
}
export function levelFromXp(xp: number): number {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}

export const RANKS: { level: number; name: string }[] = [
  { level: 1, name: "Ingresante" },
  { level: 3, name: "Estudiante de Derecho" },
  { level: 6, name: "Ayudante alumno" },
  { level: 9, name: "Procurador/a" },
  { level: 12, name: "Abogado/a recibido/a" },
  { level: 16, name: "Asociado/a de estudio" },
  { level: 20, name: "Especialista" },
  { level: 25, name: "Jurista" },
];
export function rankFor(level: number): string {
  return [...RANKS].reverse().find((r) => level >= r.level)!.name;
}

export const BADGES: Record<string, { name: string; description: string }> = {
  "primera-defensa": { name: "Primera defensa", description: "Completaste el simulador de clausura." },
  "defensa-impecable": { name: "Defensa impecable", description: "Simulador de clausura con 90 % o más." },
  "oral-aprobado": { name: "Oral aprobado", description: "Aprobaste un examen oral." },
  "oral-exigente": { name: "Frente al tribunal examinador", description: "Aprobaste un oral en modo exigente." },
  "cartografo": { name: "Cartógrafo jurídico", description: "Reconstruiste una red conceptual de memoria con 80 % o más." },
  "memoria-10": { name: "Memoria de acero", description: "10 repasos espaciados exitosos." },
  "lector": { name: "Lector voraz", description: "Cargaste tu primer material de estudio." },
  "retencion": { name: "Lo que se aprende no se olvida", description: "Recordaste correctamente una tarjeta tras 6 días o más." },
};

export interface BuildingDef {
  id: string;
  name: string;
  requirement: string;
  check: (s: GameState) => boolean;
}

/** Desbloqueo de edificios: sólo por dominio demostrado, nunca comprable. */
export const BUILDING_UNLOCKS: BuildingDef[] = [
  { id: "facultad", name: "Facultad de Derecho", requirement: "Disponible desde el inicio", check: () => true },
  { id: "tribunal", name: "Tribunales", requirement: "Disponible desde el inicio", check: () => true },
  {
    id: "biblioteca",
    name: "Biblioteca jurídica",
    requirement: "Cargá tu primer material de estudio",
    check: (s) => s.materials.length > 0,
  },
  {
    id: "estudio",
    name: "Estudio jurídico",
    requirement: "Completá el simulador de clausura con 60 % o más",
    check: (s) => s.log.some((l) => l.kind === "simulacion" && l.quality >= 0.6),
  },
  {
    id: "arca",
    name: "Organismo recaudador (ARCA)",
    requirement: "Dominá el tema 'Procedimiento de clausura' (80 %)",
    check: (s) => topicMastery(s, "trib.procedimiento-clausura") >= 0.8,
  },
  {
    id: "audiencias",
    name: "Sala de audiencias",
    requirement: "Aprobá un examen oral",
    check: (s) => s.log.some((l) => l.kind === "oral" && l.quality >= 0.6),
  },
  {
    id: "investigacion",
    name: "Centro de investigación",
    requirement: "Reconstruí una red conceptual de memoria con 80 %",
    check: (s) => s.log.some((l) => l.kind === "red" && l.id.endsWith(":evaluacion") && l.quality >= 0.8),
  },
  {
    id: "archivo",
    name: "Archivo judicial",
    requirement: "Realizá 15 repasos espaciados exitosos",
    check: (s) => s.log.filter((l) => l.kind === "repaso" && l.quality >= 0.6).length >= 15,
  },
  {
    id: "entrenamiento",
    name: "Centro de entrenamiento académico",
    requirement: "Alcanzá el nivel 5",
    check: (s) => levelFromXp(s.xp) >= 5,
  },
];

/** Dominio de un tema: promedio ponderado de las últimas evidencias, con decaimiento por olvido. */
export function topicMastery(s: GameState, topic: string, now = Date.now()): number {
  const ev = s.topicScores[topic] ?? [];
  if (ev.length === 0) return 0;
  const recent = ev.slice(-6);
  let wsum = 0;
  let sum = 0;
  recent.forEach((e, i) => {
    const w = i + 1;
    wsum += w;
    sum += w * e.q;
  });
  const avg = sum / wsum;
  const last = recent[recent.length - 1].at;
  const days = (now - last) / 86_400_000;
  const decay = Math.exp(-Math.max(0, days - 3) / 30); // tolerancia de 3 días, luego olvido lento
  const evidence = Math.min(1, ev.length / 2); // una sola evidencia no alcanza para "dominar"
  return avg * decay * (0.5 + 0.5 * evidence);
}

export interface ActivityResult {
  kind: ActivityKind;
  id: string;
  topic: string;
  quality: number;
  label: string;
  /** Errores detectados: se registran y generan tarjetas de repaso. */
  errors?: { topic: string; description: string; prompt: string; answer: string; ref?: string }[];
  /** Puntajes por tema adicionales (p. ej. un simulador cubre varios temas). */
  topicQualities?: Record<string, number>;
  bonusXp?: number;
  badges?: string[];
  /** No registra evidencia de dominio (p. ej. cargar material no demuestra aprendizaje). */
  skipTopicScore?: boolean;
}

/** Punto central de integración: toda actividad académica pasa por aquí. */
export function recordActivity(r: ActivityResult): { xp: number; coins: number } {
  const reward = computeReward(r.kind, r.quality, r.bonusXp ?? 0);
  const before = store.state;
  const levelBefore = levelFromXp(before.xp);
  const unlockedBefore = new Set(before.unlocked);
  const now = Date.now();

  store.update(`activity:${r.kind}`, (s) => {
    s.xp += reward.xp;
    s.coins += reward.coins;
    s.log.push({ at: now, kind: r.kind, id: r.id, topic: r.topic, quality: r.quality, xp: reward.xp, coins: reward.coins, detail: r.label });
    const tq = r.skipTopicScore ? {} : { [r.topic]: r.quality, ...(r.topicQualities ?? {}) };
    for (const [t, q] of Object.entries(tq)) {
      (s.topicScores[t] ??= []).push({ at: now, q });
      if (s.topicScores[t].length > 30) s.topicScores[t].shift();
    }
    for (const e of r.errors ?? []) {
      s.errors.push({ at: now, topic: e.topic, activity: r.label, description: e.description, ref: e.ref });
      const id = `err:${hash(e.prompt)}`;
      s.cards = upsertCard(s.cards, newCard(id, e.topic, e.prompt, e.answer, "error", now), true, now);
    }
    if (s.errors.length > 300) s.errors.splice(0, s.errors.length - 300);
    for (const b of r.badges ?? []) if (!s.badges.includes(b)) s.badges.push(b);
    progressMissions(s, r);
    for (const b of BUILDING_UNLOCKS) if (!s.unlocked.includes(b.id) && b.check(s)) s.unlocked.push(b.id);
  });

  const s = store.state;
  if (reward.xp || reward.coins) events.emit({ type: "reward", xp: reward.xp, coins: reward.coins, label: r.label });
  for (const b of r.badges ?? [])
    if (!before.badges.includes(b) && BADGES[b]) events.emit({ type: "badge", id: b, name: BADGES[b].name });
  const lv = levelFromXp(s.xp);
  if (lv > levelBefore) events.emit({ type: "levelup", level: lv, rank: rankFor(lv) });
  for (const id of s.unlocked)
    if (!unlockedBefore.has(id)) events.emit({ type: "unlock", building: id, name: BUILDING_UNLOCKS.find((b) => b.id === id)!.name });
  return reward;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/* ---------------------------- Misiones ---------------------------- */

function progressMissions(s: GameState, r: ActivityResult) {
  for (const m of [...s.missions.list, ...s.specialMissions]) {
    if (m.done || m.kind !== r.kind) continue;
    if (m.topic && m.topic !== r.topic && !(r.topicQualities && m.topic in r.topicQualities)) continue;
    // Sólo cuenta una actividad aprobada: la misión exige dominio, no participación.
    if (r.quality < 0.6) continue;
    m.progress += 1;
    if (m.progress >= m.target) m.done = true;
  }
}

/** Genera misiones diarias personalizadas a partir de las debilidades del jugador. */
export function generateDailyMissions(s: GameState, now = Date.now()): Mission[] {
  const list: Mission[] = [];
  const due = s.cards.filter((c) => c.due <= now).length;
  list.push({
    id: `d-repaso-${today()}`,
    title: "Recuperación activa",
    description: due > 0 ? `Tenés ${due} tarjetas vencidas. Repasá al menos 5 recordándolas por escrito.` : "Repasá 5 tarjetas del entrenador de memoria.",
    kind: "repaso",
    target: 5,
    progress: 0,
    reward: { xp: 60, coins: 15 },
    done: false,
    claimed: false,
    personalized: due > 0,
  });
  const weak = weakestTopics(s, 2);
  if (weak[0]) {
    const t = weak[0];
    const isSim = t.startsWith("trib.") && ["trib.procedimiento-clausura", "trib.recursos-clausura", "trib.clausura"].includes(t);
    list.push({
      id: `d-weak-${t}-${today()}`,
      title: `Reforzar: ${TOPICS[t]?.name ?? t}`,
      description: isSim
        ? "Es tu tema más débil. Volvé a jugar el simulador de clausura y aprobalo."
        : "Es tu tema más débil. Aprobá un examen oral sobre este tema.",
      kind: isSim ? "simulacion" : "oral",
      topic: t,
      target: 1,
      progress: 0,
      reward: { xp: 120, coins: 30 },
      done: false,
      claimed: false,
      personalized: true,
    });
  } else {
    list.push({
      id: `d-sim-${today()}`,
      title: "Primer expediente",
      description: "Entrá a Tribunales y completá el simulador de clausura.",
      kind: "simulacion",
      target: 1,
      progress: 0,
      reward: { xp: 120, coins: 30 },
      done: false,
      claimed: false,
      personalized: false,
    });
  }
  list.push({
    id: `d-red-${today()}`,
    title: "Mapa mental",
    description: "Aprobá una red conceptual en modo construcción o evaluación.",
    kind: "red",
    target: 1,
    progress: 0,
    reward: { xp: 80, coins: 20 },
    done: false,
    claimed: false,
    personalized: false,
  });
  return list;
}

/** Temas con evidencia y menor dominio (los que nunca se practicaron no cuentan como "débiles"). */
export function weakestTopics(s: GameState, n: number): string[] {
  const errCount: Record<string, number> = {};
  for (const e of s.errors) errCount[e.topic] = (errCount[e.topic] ?? 0) + 1;
  return Object.keys(s.topicScores)
    .map((t) => ({ t, m: topicMastery(s, t) - Math.min(0.2, (errCount[t] ?? 0) * 0.02) }))
    .filter((x) => x.m < 0.8)
    .sort((a, b) => a.m - b.m)
    .slice(0, n)
    .map((x) => x.t);
}

export function ensureDailyMissions() {
  if (store.state.missions.date === today()) return;
  store.update("missions", (s) => {
    s.missions = { date: today(), list: generateDailyMissions(s) };
  });
}

export function claimMission(id: string) {
  const m = [...store.state.missions.list, ...store.state.specialMissions].find((x) => x.id === id);
  if (!m || !m.done || m.claimed) return;
  const levelBefore = levelFromXp(store.state.xp);
  store.update("mission-claim", (s) => {
    const mm = [...s.missions.list, ...s.specialMissions].find((x) => x.id === id)!;
    mm.claimed = true;
    s.xp += mm.reward.xp;
    s.coins += mm.reward.coins;
    for (const b of BUILDING_UNLOCKS) if (!s.unlocked.includes(b.id) && b.check(s)) s.unlocked.push(b.id);
  });
  events.emit({ type: "reward", xp: m.reward.xp, coins: m.reward.coins, label: `Misión: ${m.title}` });
  const lv = levelFromXp(store.state.xp);
  if (lv > levelBefore) events.emit({ type: "levelup", level: lv, rank: rankFor(lv) });
}
