import { beforeEach, describe, expect, it } from "vitest";
import { CLAUSURA, clausuraDias } from "../src/content/clausura.ts";
import { ORAL_BANK, notaFromQuality } from "../src/content/oralBank.ts";
import { TRIBUTARIO_MAP } from "../src/content/tributarioMap.ts";
import { store } from "../src/core/state.ts";
import { LEGAL_REFS, getRef, refWarnings } from "../src/legal/sources.ts";
import { checkRelation, layout, pickBlanks } from "../src/modules/conceptmap/model.ts";
import { processLocal, toConceptMap } from "../src/modules/materials/processor.ts";
import { evaluateLocal } from "../src/modules/oral/localEvaluator.ts";
import { SimulationRun } from "../src/modules/simulator/engine.ts";
import { computeReward, levelFromXp, recordActivity, topicMastery, xpForLevel } from "../src/systems/gamification.ts";
import { newCard, retention, review } from "../src/systems/memory.ts";

const DAY = 86_400_000;

describe("Entrenador de memoria (SM-2)", () => {
  it("aumenta el intervalo con respuestas correctas y lo reinicia ante un olvido", () => {
    let c = newCard("x", "t", "p", "a", "contenido", 0);
    c = review(c, 5, 0);
    expect(c.interval).toBe(1);
    c = review(c, 5, DAY);
    expect(c.interval).toBe(6);
    c = review(c, 4, 7 * DAY);
    expect(c.interval).toBeGreaterThan(6);
    const lapsed = review(c, 1, 30 * DAY);
    expect(lapsed.interval).toBe(1);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.ef).toBeGreaterThanOrEqual(1.3);
  });
  it("estima retención decreciente con el tiempo", () => {
    const c = review(newCard("x", "t", "p", "a", "contenido", 0), 5, 0);
    expect(retention(c, 0)).toBeCloseTo(1);
    expect(retention(c, 3 * DAY)).toBeLessThan(retention(c, DAY));
  });
});

describe("Gamificación basada en calidad", () => {
  beforeEach(() => store.reset());
  it("no da XP por debajo del 40 % ni monedas por debajo del 60 %", () => {
    expect(computeReward("simulacion", 0.3)).toEqual({ xp: 0, coins: 0 });
    expect(computeReward("simulacion", 0.5).coins).toBe(0);
    expect(computeReward("simulacion", 1).xp).toBeGreaterThan(computeReward("simulacion", 0.7).xp);
  });
  it("niveles crecientes", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(xpForLevel(4))).toBe(4);
    expect(levelFromXp(xpForLevel(4) - 1)).toBe(3);
  });
  it("registra errores como tarjetas de repaso y desbloquea edificios por dominio", () => {
    recordActivity({
      kind: "simulacion",
      id: "clausura",
      topic: "trib.clausura",
      quality: 0.8,
      label: "test",
      errors: [{ topic: "trib.recursos-clausura", description: "d", prompt: "¿Qué recurso?", answer: "Art. 77" }],
    });
    const s = store.state;
    expect(s.cards.some((c) => c.source === "error")).toBe(true);
    expect(s.unlocked).toContain("estudio");
    expect(s.unlocked).not.toContain("audiencias");
  });
  it("el dominio requiere más de una evidencia y decae con el tiempo", () => {
    recordActivity({ kind: "oral", id: "o", topic: "trib.ilicitos", quality: 1, label: "t" });
    const one = topicMastery(store.state, "trib.ilicitos");
    expect(one).toBeLessThan(0.8);
    recordActivity({ kind: "oral", id: "o", topic: "trib.ilicitos", quality: 1, label: "t" });
    expect(topicMastery(store.state, "trib.ilicitos")).toBeGreaterThan(0.95);
    expect(topicMastery(store.state, "trib.ilicitos", Date.now() + 90 * DAY)).toBeLessThan(0.2);
  });
});

function play(choices: Record<string, string[]>, args: Record<string, string> = {}) {
  const run = new SimulationRun(CLAUSURA);
  let guard = 0;
  while (!run.finished && guard++ < 30) {
    const st = run.stage!;
    if (st.kind === "argument") {
      run.argue(args[st.id] ?? "");
      continue;
    }
    const rec = run.decide(choices[st.id] ?? [st.choices![0].id]);
    if (st.argument) run.argue(args[st.id] ?? "", undefined, rec);
  }
  return run;
}

describe("Simulador de clausura", () => {
  const best = {
    inspeccion: ["b"],
    hechos: ["b"],
    imputacion: ["a"],
    analisis: ["plazo", "posterior", "antecedentes"],
    normas: ["40", "41", "4", "77", "78", "18"],
    defensa: ["a"],
    audiencia: ["a"],
    resolucionAdm: ["a"],
    recursoJudicial: ["a"],
    ejecucion: ["a"],
  };
  const bestArgs = {
    defensa:
      "La audiencia se fijó sin respetar el plazo mínimo de 5 días del art. 41, computado en días hábiles, lo que causó un perjuicio concreto a la defensa porque no se pudo obtener el registro técnico. Además la factura se emitió y fue autorizada a las 11:09. Ofrezco prueba testimonial y el informe técnico. En subsidio, pido la graduación al mínimo por falta de antecedentes, conforme al art. 18 de la Constitución.",
    audienciaOral:
      "El plazo existe para preparar la defensa y reunir la prueba. Aquí el registro del proveedor no llegó a tiempo, lo que es un perjuicio concreto a la defensa en juicio del art. 18 y del art. 41. Por eso solicito un plazo para producir esa prueba.",
  };

  it("el camino óptimo termina en una resolución favorable con puntaje alto", () => {
    const run = play(best, bestArgs);
    expect(run.finished).toBe(true);
    expect(run.score()).toBeGreaterThan(0.85);
    expect(run.ending().tone).toBe("ok");
    expect(clausuraDias(run.ctx)).toBe(2);
  });

  it("elegir el Tribunal Fiscal deja la sanción firme y registra el error con su explicación", () => {
    const run = play({ ...best, resolucionAdm: ["b"] }, bestArgs);
    expect(run.ending().tone).toBe("mal");
    expect(run.finalQuality()).toBeLessThanOrEqual(0.45);
    const d = run.decisions.find((x) => x.stageId === "resolucionAdm")!;
    expect(d.mistakes[0].choice.feedback.alternativa).toMatch(/77/);
  });

  it("quebrantar la clausura es el peor desenlace", () => {
    expect(play({ ...best, ejecucion: ["c"] }, bestArgs).ending().title).toMatch(/Quebrantamiento/);
  });

  it("la no comparecencia saltea la audiencia oral", () => {
    const run = play({ ...best, audiencia: ["b"] }, bestArgs);
    expect(run.decisions.some((d) => d.stageId === "audienciaOral")).toBe(false);
  });

  it("todas las referencias del caso existen en el motor jurídico", () => {
    for (const st of Object.values(CLAUSURA.stages)) {
      for (const r of st.refs) expect(() => getRef(r)).not.toThrow();
      for (const c of st.choices ?? []) for (const r of c.refs ?? []) expect(() => getRef(r)).not.toThrow();
    }
  });
});

describe("Motor jurídico", () => {
  it("advierte sobre verificación pendiente y fechas de referencia", () => {
    const r = getRef("lpt-40");
    const w = refWarnings(r, { jurisdiccion: "Nacional", fechaReferencia: "2015-01-01" });
    expect(w.join(" ")).toMatch(/anterior a 2017-12-29/);
    expect(w.join(" ")).toMatch(/Discrepancia/);
  });
  it("ninguna referencia se presenta como texto literal ni como verificada sin serlo", () => {
    for (const r of LEGAL_REFS) {
      expect(r.tipoContenido).toBe("parafrasis");
      expect(r.verificacion.estado).not.toBe("verificada");
      expect(r.fuenteOficial.url).toMatch(/^https:\/\//);
    }
  });
});

describe("Redes conceptuales", () => {
  it("valida relaciones y explica errores", () => {
    expect(checkRelation(TRIBUTARIO_MAP, "ilicitos", "delitos", "se divide en").ok).toBe(true);
    const lbl = checkRelation(TRIBUTARIO_MAP, "ilicitos", "delitos", "comprende");
    expect(lbl.ok).toBe(false);
    const dir = checkRelation(TRIBUTARIO_MAP, "delitos", "ilicitos", "se divide en");
    expect(!dir.ok && dir.kind).toBe("direccion");
    const conf = checkRelation(TRIBUTARIO_MAP, "formales", "evasion-simple", "comprende");
    expect(conf.message).toMatch(/DELITO/);
  });
  it("calcula posiciones para todos los nodos y elige huecos sin la raíz", () => {
    const pos = layout(TRIBUTARIO_MAP);
    for (const n of TRIBUTARIO_MAP.nodes) expect(pos[n.id]).toBeDefined();
    const blanks = pickBlanks(TRIBUTARIO_MAP, 6, 42);
    expect(blanks).toHaveLength(6);
    expect(blanks).not.toContain("dt");
  });
});

describe("Evaluador local de respuestas", () => {
  const q = ORAL_BANK.find((x) => x.id === "elementos-ilicito")!;
  it("reconoce conceptos expresados con otras palabras", () => {
    const e = evaluateLocal(
      "Se requiere una acción u omisión típica, es decir descripta por la ley, antijurídica y culpable, porque rige el principio de culpabilidad; y la ley le asigna una sanción. Hay que distinguir la infracción del delito tributario.",
      q.keyPoints,
    );
    expect(e.score).toBeGreaterThan(0.9);
  });
  it("no acepta conceptos negados y pide desarrollo", () => {
    const e = evaluateLocal("No es culpable.", q.keyPoints);
    expect(e.score).toBeLessThan(0.3);
    expect(e.repregunta).not.toBe("");
  });
  it("nota universitaria: aprobado con 4 al 60 %", () => {
    expect(notaFromQuality(0.6)).toBe(4);
    expect(notaFromQuality(1)).toBe(10);
    expect(notaFromQuality(0.3)).toBeLessThan(4);
  });
});

describe("Procesamiento local de material", () => {
  it("detecta unidades, definiciones y normas citadas", () => {
    const text = `UNIDAD 1 LA OBLIGACIÓN TRIBUTARIA
El hecho imponible es el presupuesto fijado por la ley para tipificar el tributo.
El sujeto pasivo es la persona obligada al cumplimiento de la prestación tributaria.
UNIDAD 2 PROCEDIMIENTO
La clausura es una sanción prevista en el art. 40 de la Ley 11.683 para ciertas infracciones formales.`;
    const p = processLocal("Tributario", text);
    expect(p.units.length).toBe(2);
    expect(p.concepts.map((c) => c.id)).toContain("hecho-imponible");
    expect(p.norms.some((n) => /11\.683/.test(n.cita))).toBe(true);
    const map = toConceptMap("m1", "Apunte", "tributario", p);
    expect(map.nodes.length).toBeGreaterThan(3);
    expect(map.edges.every((e) => map.nodes.some((n) => n.id === e.to))).toBe(true);
  });
});
