import { beforeEach, describe, expect, it } from "vitest";
import { CHAPTERS } from "../src/content/chapters.ts";
import { store } from "../src/core/state.ts";
import { getRef } from "../src/legal/sources.ts";
import { processLocal } from "../src/modules/materials/processor.ts";
import { materialChapter } from "../src/modules/reels/materialReels.ts";
import { missingChapters, nextStep, topicUnlocked } from "../src/modules/reels/progress.ts";
import { TOPICS } from "../src/systems/topics.ts";

describe("Capítulos en reels", () => {
  it("cada capítulo tiene preguntas válidas, referencias existentes y temas conocidos", () => {
    for (const c of CHAPTERS) {
      expect(c.reels.filter((r) => r.kind === "check").length).toBeGreaterThanOrEqual(2);
      for (const t of c.topics) expect(TOPICS[t]).toBeDefined();
      for (const r of c.reels) {
        for (const id of r.refs ?? []) expect(() => getRef(id)).not.toThrow();
        if (r.kind === "check") {
          expect(r.correct).toBeGreaterThanOrEqual(0);
          expect(r.correct).toBeLessThan(r.options.length);
        }
      }
    }
  });

  it("el reel del calendario es coherente con la pregunta de cómputo (3 días hábiles)", () => {
    const cal = CHAPTERS.find((c) => c.id === "cap3")!.reels.find((r) => r.kind === "calendario");
    if (cal?.kind !== "calendario") throw new Error("falta calendario");
    const hasta = cal.days.findIndex((d) => d.mark === "audiencia");
    expect(cal.days.slice(0, hasta + 1).filter((d) => d.mark === "habil" || d.mark === "audiencia").length).toBe(3);
  });
});

describe("Primero aprender, después aplicar", () => {
  beforeEach(() => store.reset());
  it("el caso de clausura exige los capítulos 2 a 4 y la guía sigue el orden", () => {
    const s = store.state;
    expect(missingChapters(s, "sim:clausura")).toEqual(["cap2", "cap3", "cap4"]);
    expect(nextStep(s).action).toEqual({ type: "chapter", id: "cap1" });
    store.update("t", (st) => {
      for (const id of ["cap1", "cap2", "cap3", "cap4"]) st.chapters[id] = { seen: 1, done: true, best: 1 };
    });
    expect(missingChapters(store.state, "sim:clausura")).toEqual([]);
    expect(nextStep(store.state).action.type).toBe("sim");
    expect(topicUnlocked(store.state, "trib.recursos-clausura")).toBe(true);
  });
});

describe("Reels a partir del material", () => {
  it("genera preguntas cuya respuesta correcta es la definición del concepto", () => {
    const text = `UNIDAD 1 OBLIGACIÓN
El hecho imponible es el presupuesto fijado por la ley para tipificar el tributo.
El sujeto pasivo es la persona obligada al cumplimiento de la prestación tributaria.
La base imponible es la magnitud sobre la que se aplica la alícuota del tributo.`;
    const ch = materialChapter("m", "Apunte", processLocal("tributario", text));
    const check = ch.reels.find((r) => r.kind === "check");
    if (check?.kind !== "check") throw new Error("sin pregunta");
    expect(check.correct).toBeGreaterThanOrEqual(0);
    expect(check.options[check.correct]).toContain("magnitud");
  });
});
