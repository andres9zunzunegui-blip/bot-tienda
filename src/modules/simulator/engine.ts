/**
 * MOTOR DE SIMULACIONES — independiente de la interfaz y del contenido.
 * Un escenario es un grafo de etapas. Cada decisión tiene calidad, consecuencias
 * (banderas que alteran etapas y documentos posteriores) y una explicación
 * estructurada en cinco puntos para el caso de error.
 */
import { evaluateLocal, type KeyPoint } from "../oral/localEvaluator.ts";

export interface Ctx {
  flags: Set<string>;
}

export interface Feedback {
  porQue: string;
  consecuencia: string;
  alternativa: string;
}

export interface Choice {
  id: string;
  text: string;
  /** 1 = jurídicamente correcta; valores intermedios = admisible pero deficiente; 0 = incorrecta. */
  quality: number;
  /** Sólo en etapas "multi": si la opción debe marcarse. */
  correct?: boolean;
  feedback: Feedback;
  refs?: string[];
  flags?: string[];
}

export interface Doc {
  id: string;
  title: string;
  body: (ctx: Ctx) => string;
}

export interface Stage {
  id: string;
  phase: number;
  title: string;
  authority: string;
  narrative: (ctx: Ctx) => string;
  prompt: string;
  kind: "single" | "multi" | "argument";
  choices?: Choice[];
  argument?: { prompt: string; keyPoints: KeyPoint[]; persona: string; weight: number };
  topic: string;
  refs: string[];
  addsDocs?: string[];
  deadline?: string;
  weight?: number;
  next: (ctx: Ctx) => string | null;
}

export interface Ending {
  title: string;
  tone: "ok" | "parcial" | "mal";
  resolucion: string;
  fundamentos: string[];
  nota: string;
}

export interface Scenario {
  id: string;
  title: string;
  subject: string;
  role: string;
  summary: string;
  jurisdiccion: string;
  start: string;
  stages: Record<string, Stage>;
  docs: Record<string, Doc>;
  initialDocs: string[];
  ending: (ctx: Ctx, score: number) => Ending;
}

export interface DecisionRecord {
  stageId: string;
  chosen: string[];
  quality: number;
  argument?: string;
  argumentScore?: number;
  argumentSource?: "ia" | "local";
  argumentFeedback?: string;
  mistakes: { choice: Choice; kind: "elegida-incorrecta" | "omitida" }[];
}

export class SimulationRun {
  readonly scenario: Scenario;
  ctx: Ctx = { flags: new Set() };
  stageId: string | null;
  docs: string[];
  decisions: DecisionRecord[] = [];

  constructor(scenario: Scenario) {
    this.scenario = scenario;
    this.stageId = scenario.start;
    this.docs = [...scenario.initialDocs];
  }

  get stage(): Stage | null {
    return this.stageId ? this.scenario.stages[this.stageId] : null;
  }

  get finished(): boolean {
    return this.stageId === null;
  }

  /** Resuelve una etapa de opción única o múltiple. */
  decide(choiceIds: string[]): DecisionRecord {
    const st = this.stage;
    if (!st || !st.choices) throw new Error("Etapa sin opciones");
    const chosen = st.choices.filter((c) => choiceIds.includes(c.id));
    if (!chosen.length) throw new Error("Elegí al menos una opción");
    let quality: number;
    const mistakes: DecisionRecord["mistakes"] = [];
    if (st.kind === "single") {
      quality = chosen[0].quality;
      if (quality < 1) mistakes.push({ choice: chosen[0], kind: "elegida-incorrecta" });
    } else {
      const shouldMark = st.choices.filter((c) => c.correct);
      const hits = chosen.filter((c) => c.correct).length;
      const wrong = chosen.filter((c) => !c.correct);
      quality = Math.max(0, (hits - wrong.length) / shouldMark.length);
      for (const w of wrong) mistakes.push({ choice: w, kind: "elegida-incorrecta" });
      for (const m of shouldMark) if (!chosen.includes(m)) mistakes.push({ choice: m, kind: "omitida" });
    }
    for (const c of chosen) for (const f of c.flags ?? []) this.ctx.flags.add(f);
    const rec: DecisionRecord = { stageId: st.id, chosen: chosen.map((c) => c.id), quality, mistakes };
    if (st.argument) return rec; // la etapa sigue abierta: falta el argumento escrito
    this.commit(rec);
    return rec;
  }

  /** Completa la parte argumentativa (evaluación externa —IA— o local). */
  argue(text: string, external?: { score: number; feedback: string }, partial?: DecisionRecord): DecisionRecord {
    const st = this.stage;
    if (!st?.argument) throw new Error("Etapa sin argumentación");
    const local = evaluateLocal(text, st.argument.keyPoints);
    const score = external ? external.score : local.score;
    const w = st.argument.weight;
    const base = partial ?? { stageId: st.id, chosen: [], quality: 1, mistakes: [] };
    const quality = st.kind === "argument" ? score : base.quality * (1 - w) + score * w;
    const rec: DecisionRecord = {
      ...base,
      quality,
      argument: text,
      argumentScore: score,
      argumentSource: external ? "ia" : "local",
      argumentFeedback:
        external?.feedback ??
        [
          local.covered.length ? `Puntos logrados: ${local.covered.map((k) => k.label).join("; ")}.` : "",
          local.missed.length ? `Faltó desarrollar: ${local.missed.map((k) => k.label).join("; ")}.` : "",
          ...local.observaciones,
        ]
          .filter(Boolean)
          .join(" "),
    };
    this.commit(rec);
    return rec;
  }

  private commit(rec: DecisionRecord) {
    const st = this.stage!;
    this.decisions.push(rec);
    for (const d of st.addsDocs ?? []) if (!this.docs.includes(d)) this.docs.push(d);
    this.stageId = st.next(this.ctx);
    const nx = this.stage;
    if (nx) for (const d of nx.addsDocs ?? []) if (!this.docs.includes(d)) this.docs.push(d);
  }

  score(): number {
    if (!this.decisions.length) return 0;
    let w = 0;
    let s = 0;
    for (const d of this.decisions) {
      const sw = this.scenario.stages[d.stageId].weight ?? 1;
      w += sw;
      s += sw * d.quality;
    }
    return s / w;
  }

  topicQualities(): Record<string, number> {
    const acc: Record<string, { s: number; n: number }> = {};
    for (const d of this.decisions) {
      const t = this.scenario.stages[d.stageId].topic;
      acc[t] ??= { s: 0, n: 0 };
      acc[t].s += d.quality;
      acc[t].n += 1;
    }
    return Object.fromEntries(Object.entries(acc).map(([t, v]) => [t, v.s / v.n]));
  }

  ending(): Ending {
    return this.scenario.ending(this.ctx, this.score());
  }

  /**
   * Nota final: un desenlace desfavorable limita la calificación aunque las
   * decisiones previas hayan sido buenas (perder un plazo o la vía recursiva
   * hace perder el caso).
   */
  finalQuality(): number {
    const s = this.score();
    const tone = this.ending().tone;
    if (tone === "mal") return Math.min(s, 0.45);
    if (tone === "parcial") return Math.min(s, 0.75);
    return s;
  }
}
