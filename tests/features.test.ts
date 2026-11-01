import { beforeEach, describe, expect, it } from "vitest";
import { DETERMINACION } from "../src/content/determinacion.ts";
import { ORAL_BANK } from "../src/content/oralBank.ts";
import { defaultState, store } from "../src/core/state.ts";
import { getRef } from "../src/legal/sources.ts";
import { evaluateLocal } from "../src/modules/oral/localEvaluator.ts";
import { nextStep } from "../src/modules/reels/progress.ts";
import { SimulationRun } from "../src/modules/simulator/engine.ts";
import { bumpStreak, currentStreak } from "../src/systems/gamification.ts";
import { buildPlan, isoDay, pendingTasks } from "../src/systems/plan.ts";

const DAY = 86_400_000;
const T0 = new Date(2026, 10, 2, 12).getTime();

describe("Racha diaria", () => {
  it("suma días consecutivos, no duplica el mismo día y se corta si faltás", () => {
    const s = defaultState();
    expect(bumpStreak(s, T0)).toBe(1);
    expect(bumpStreak(s, T0 + 3600_000)).toBe(0);
    expect(bumpStreak(s, T0 + DAY)).toBe(2);
    expect(currentStreak(s, T0 + DAY)).toBe(2);
    expect(currentStreak(s, T0 + 3 * DAY)).toBe(0);
    expect(bumpStreak(s, T0 + 3 * DAY)).toBe(1);
    expect(s.streak.best).toBe(2);
  });
});

describe("Plan de estudio", () => {
  it("reparte lo pendiente y reserva el día previo para el simulacro", () => {
    const s = defaultState();
    s.exam = { date: isoDay(T0 + 6 * DAY), label: "Parcial" };
    const plan = buildPlan(s, T0);
    expect(plan).toHaveLength(7);
    expect(plan.at(-1)!.isExam).toBe(true);
    expect(plan.at(-2)!.tasks.some((t) => t.kind === "escrito")).toBe(true);
    const planned = plan.flatMap((d) => d.tasks).filter((t) => t.kind !== "memory" && t.kind !== "escrito").length;
    expect(planned).toBe(pendingTasks(s).length);
  });
  it("si el examen es mañana, todo lo pendiente va a hoy", () => {
    const s = defaultState();
    s.exam = { date: isoDay(T0 + DAY), label: "Final" };
    const plan = buildPlan(s, T0);
    expect(plan[0].tasks.length).toBeGreaterThanOrEqual(pendingTasks(s).length);
  });
});

describe("Caso de determinación de oficio", () => {
  const best = { vista: ["b"], base: ["a"], prueba: ["pericia", "remitos", "inspeccion"], demora: ["a"], recurso: ["a"] };
  const play = (ch: Record<string, string[]>) => {
    const run = new SimulationRun(DETERMINACION);
    while (!run.finished) run.decide(ch[run.stage!.id]);
    return run;
  };
  it("el camino óptimo termina bien y las vías del art. 76 son excluyentes", () => {
    const ok = play(best);
    expect(ok.ending().tone).toBe("ok");
    const both = play({ ...best, recurso: ["b"] });
    expect(both.decisions.at(-1)!.quality).toBe(0);
  });
  it("no contestar la vista da el peor desenlace", () => {
    expect(play({ ...best, vista: ["a"] }).ending().tone).toBe("mal");
  });
  it("todas sus referencias existen", () => {
    for (const st of Object.values(DETERMINACION.stages)) for (const r of [...st.refs, ...(st.choices ?? []).flatMap((c) => c.refs ?? [])]) expect(() => getRef(r)).not.toThrow();
  });
});

describe("Banco oral ampliado", () => {
  it("el evaluador local reconoce una buena respuesta de determinación de oficio", () => {
    const q = ORAL_BANK.find((x) => x.id === "determinacion-procedimiento")!;
    expect(evaluateLocal(q.modelAnswer, q.keyPoints).score).toBeGreaterThan(0.8);
    const e = ORAL_BANK.find((x) => x.id === "ejecucion-excepciones")!;
    expect(evaluateLocal(e.modelAnswer, e.keyPoints).score).toBeGreaterThan(0.8);
  });
});

describe("Siguiente paso", () => {
  beforeEach(() => store.reset());
  it("después de los capítulos 1-4 lleva al caso de clausura, y luego a los capítulos nuevos", () => {
    store.update("t", (s) => {
      for (const id of ["cap1", "cap2", "cap3", "cap4"]) s.chapters[id] = { seen: 1, done: true, best: 1 };
    });
    expect(nextStep(store.state).action).toEqual({ type: "sim", id: "clausura" });
    store.update("t", (s) => {
      s.log.push({ at: 0, kind: "simulacion", id: "clausura-11683", topic: "trib.clausura", quality: 0.9, xp: 0, coins: 0 });
      s.log.push({ at: 0, kind: "oral", id: "oral", topic: "trib.ilicitos", quality: 0.9, xp: 0, coins: 0 });
    });
    expect(nextStep(store.state).action).toEqual({ type: "chapter", id: "cap5" });
  });
});
