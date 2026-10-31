/** Convierte un material procesado en un capítulo de reels con preguntas de opción múltiple. */
import type { Chapter, Reel } from "../../content/chapters.ts";
import type { ProcessedMaterial } from "../materials/processor.ts";

function shuffle<T>(a: T[], seed: number): T[] {
  const c = [...a];
  let s = seed || 1;
  for (let i = c.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

export function materialChapter(id: string, name: string, p: ProcessedMaterial): Chapter {
  const reels: Reel[] = [
    {
      kind: "intro",
      title: name,
      words: p.units.slice(0, 4).map((u) => u.title.slice(0, 40)),
      caption: `Reels generados a partir de tu material (${p.mode === "ia" ? "con IA" : "procesamiento local"}). Lo marcado como externo no surge de tus apuntes.`,
    },
  ];
  const concepts = p.concepts.slice(0, 12);
  concepts.forEach((c, k) => {
    reels.push({ kind: "dato", title: c.origin === "externo" ? "Concepto (externo)" : "Concepto", big: c.name.slice(0, 28), unit: "", caption: c.definition });
    // Cada tres conceptos, una pregunta con distractores tomados de otros conceptos.
    if ((k + 1) % 3 === 0 && concepts.length >= 3) {
      const others = concepts.filter((o) => o.id !== c.id);
      const options = shuffle([c.definition, ...shuffle(others, k + 7).slice(0, 2).map((o) => o.definition)], k + 3).map((o) => (o.length > 140 ? `${o.slice(0, 140)}…` : o));
      const correct = options.findIndex((o) => c.definition.startsWith(o.replace(/…$/, "")));
      reels.push({ kind: "check", question: `¿Cuál es la definición de "${c.name}" según tu material?`, options, correct, explain: c.definition });
    }
  });
  if (p.norms.length)
    reels.push({ kind: "alerta", title: "Normas citadas en tu material", text: p.norms.slice(0, 6).map((n) => n.cita).join(" · "), caption: "No fueron verificadas: confirmá su vigencia en InfoLEG o el Boletín Oficial." });
  return { id: `mat-${id}`, number: 0, title: name, subtitle: "Tu material", topic: `mat:${id}`, topics: [`mat:${id}`], color: "#2f5878", reels };
}
