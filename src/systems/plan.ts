/**
 * PLAN DE ESTUDIO hacia la fecha del examen.
 * Ordena lo pendiente (teoría → casos → orales → simulacro) y lo reparte en los
 * días que quedan, reservando el día previo para el simulacro y el repaso general.
 */
import { CHAPTERS } from "../content/chapters.ts";
import type { GameState } from "../core/state.ts";

export type PlanTask =
  | { kind: "chapter"; id: string; label: string }
  | { kind: "sim"; id: "clausura" | "determinacion"; label: string }
  | { kind: "oral"; label: string }
  | { kind: "escrito"; label: string }
  | { kind: "memory"; label: string };

export interface PlanDay {
  date: string; // YYYY-MM-DD
  tasks: PlanTask[];
  isExam: boolean;
}

const DAY = 86_400_000;

export function isoDay(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDay(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function daysUntil(date: string, now = Date.now()): number {
  return Math.round((parseDay(date) - parseDay(isoDay(now))) / DAY);
}

/** Tareas que todavía faltan, en orden pedagógico. */
export function pendingTasks(s: GameState): PlanTask[] {
  const out: PlanTask[] = [];
  const done = (id: string) => Boolean(s.chapters?.[id]?.done);
  const sim = (id: string) => s.log.some((l) => l.kind === "simulacion" && l.id === id && l.quality >= 0.6);
  for (const c of CHAPTERS.slice(0, 4)) if (!done(c.id)) out.push({ kind: "chapter", id: c.id, label: `Capítulo ${c.number}: ${c.title}` });
  if (!sim("clausura-11683")) out.push({ kind: "sim", id: "clausura", label: "Caso de clausura" });
  for (const c of CHAPTERS.slice(4)) if (!done(c.id)) out.push({ kind: "chapter", id: c.id, label: `Capítulo ${c.number}: ${c.title}` });
  if (!sim("determinacion-11683")) out.push({ kind: "sim", id: "determinacion", label: "Caso de determinación de oficio" });
  if (!s.log.some((l) => l.kind === "oral" && l.quality >= 0.6)) out.push({ kind: "oral", label: "Examen oral de práctica" });
  return out;
}

export function buildPlan(s: GameState, now = Date.now()): PlanDay[] {
  if (!s.exam) return [];
  const left = daysUntil(s.exam.date, now);
  if (left < 0) return [];
  const tasks = pendingTasks(s);
  const days: PlanDay[] = [];
  const studyDays = Math.max(1, left - 1); // el día previo queda para el simulacro y repaso
  const perDay = Math.max(1, Math.ceil(tasks.length / studyDays));
  for (let d = 0; d <= left; d++) {
    const date = isoDay(now + d * DAY);
    if (d === left) {
      days.push({ date, tasks: [], isExam: true });
      continue;
    }
    const dayTasks: PlanTask[] = [];
    if (d === left - 1 && left > 1) {
      dayTasks.push({ kind: "escrito", label: "Simulacro escrito completo" }, { kind: "memory", label: "Repaso general de tarjetas" });
    } else {
      dayTasks.push(...tasks.splice(0, perDay));
      dayTasks.push({ kind: "memory", label: "Repaso espaciado (10 min)" });
    }
    days.push({ date, tasks: dayTasks, isExam: false });
  }
  // Si el examen es hoy o mañana, todo lo pendiente va a hoy.
  if (tasks.length && days.length) days[0].tasks.unshift(...tasks.splice(0));
  return days;
}
