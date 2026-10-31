/**
 * ENTRENADOR DE MEMORIA — repetición espaciada (algoritmo SM-2) y recuperación activa.
 * La calificación (0-5) proviene de la autoevaluación del jugador tras intentar
 * recordar la respuesta por escrito, o de la corrección automática de una actividad.
 */
import type { MemoryCard } from "../core/state.ts";

const DAY = 86_400_000;

export function newCard(
  id: string,
  topic: string,
  prompt: string,
  answer: string,
  source: MemoryCard["source"],
  now = Date.now(),
): MemoryCard {
  return { id, topic, prompt, answer, source, ef: 2.5, interval: 0, reps: 0, lapses: 0, due: now, history: [] };
}

/** Aplica SM-2. grade: 0 (no recordó) … 5 (recordó perfecto). */
export function review(card: MemoryCard, grade: number, now = Date.now()): MemoryCard {
  const g = Math.max(0, Math.min(5, Math.round(grade)));
  const c: MemoryCard = { ...card, history: [...card.history, { at: now, grade: g }], lastReview: now };
  if (g < 3) {
    c.reps = 0;
    c.interval = 1;
    c.lapses += 1;
  } else {
    c.reps += 1;
    if (c.reps === 1) c.interval = 1;
    else if (c.reps === 2) c.interval = 6;
    else c.interval = Math.round(card.interval * card.ef);
  }
  c.ef = Math.max(1.3, card.ef + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02)));
  c.due = now + c.interval * DAY;
  return c;
}

export function dueCards(cards: MemoryCard[], now = Date.now()): MemoryCard[] {
  return cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due);
}

/**
 * Retención estimada (curva de olvido exponencial): R = exp(-t / S),
 * con estabilidad S ≈ intervalo actual (mínimo 1 día).
 */
export function retention(card: MemoryCard, now = Date.now()): number {
  if (card.lastReview === undefined) return 0;
  const t = (now - card.lastReview) / DAY;
  const s = Math.max(1, card.interval);
  return Math.exp(-t / s);
}

/** Agrega o refuerza una tarjeta: si ya existe, la vuelve a poner como vencida. */
export function upsertCard(cards: MemoryCard[], card: MemoryCard, forceDue = false, now = Date.now()): MemoryCard[] {
  const i = cards.findIndex((c) => c.id === card.id);
  if (i === -1) return [...cards, card];
  if (!forceDue) return cards;
  const copy = [...cards];
  copy[i] = { ...copy[i], due: now };
  return copy;
}
