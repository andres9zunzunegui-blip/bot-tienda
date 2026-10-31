/**
 * Progresión por capítulos: qué hay que haber estudiado antes de cada desafío,
 * y cuál es el siguiente paso recomendado.
 */
import { CHAPTERS, chapter } from "../../content/chapters.ts";
import type { GameState } from "../../core/state.ts";

/** Desafíos que exigen haber visto capítulos previos. */
export const REQUIREMENTS: Record<string, { label: string; chapters: string[] }> = {
  "sim:clausura": { label: "el caso de clausura", chapters: ["cap2", "cap3", "cap4"] },
  "red:practica": { label: "construir y reconstruir la red", chapters: ["cap1"] },
  escrito: { label: "el simulacro escrito", chapters: ["cap1", "cap2", "cap3", "cap4"] },
  "oral:juez": { label: "la audiencia con la jueza", chapters: ["cap4"] },
  "oral:profesor": { label: "el examen oral", chapters: ["cap1"] },
};

/** Capítulo que habilita cada tema de examen oral. */
export const TOPIC_CHAPTER: Record<string, string> = {};
for (const c of CHAPTERS) for (const t of c.topics) TOPIC_CHAPTER[t] = c.id;

export function chapterDone(s: GameState, id: string): boolean {
  return Boolean(s.chapters?.[id]?.done);
}

export function missingChapters(s: GameState, key: keyof typeof REQUIREMENTS | string): string[] {
  const req = REQUIREMENTS[key];
  if (!req) return [];
  return req.chapters.filter((c) => !chapterDone(s, c));
}

export function topicUnlocked(s: GameState, topic: string): boolean {
  const c = TOPIC_CHAPTER[topic];
  return !c || chapterDone(s, c);
}

export interface NextStep {
  text: string;
  action: { type: "chapter"; id: string } | { type: "sim" } | { type: "oral" } | { type: "memory" } | { type: "map" };
}

/** Guía del jugador: primero aprender, después aplicar, después consolidar. */
export function nextStep(s: GameState): NextStep {
  const pending = CHAPTERS.find((c) => !chapterDone(s, c.id));
  if (pending) return { text: `Facultad · Aula de reels: Capítulo ${pending.number} — ${pending.title}`, action: { type: "chapter", id: pending.id } };
  if (!s.log.some((l) => l.kind === "simulacion" && l.quality >= 0.6)) return { text: "Tribunales: defendé a Marta en el caso de clausura", action: { type: "sim" } };
  if (!s.log.some((l) => l.kind === "oral" && l.quality >= 0.6)) return { text: "Facultad: rendí el examen oral con el Prof. Ibarra", action: { type: "oral" } };
  if (s.cards.some((c) => c.due <= Date.now())) return { text: "Repasá tus tarjetas vencidas", action: { type: "memory" } };
  return { text: "Centro de investigación: reconstruí la red de memoria", action: { type: "map" } };
}

export function chapterLabel(id: string): string {
  const c = chapter(id);
  return `Capítulo ${c.number}: ${c.title}`;
}
