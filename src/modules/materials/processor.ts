/**
 * PROCESAMIENTO DE MATERIAL.
 * - Con IA (servidor): unidades, red conceptual, preguntas y normas citadas.
 * - Sin IA: procesamiento local básico y determinístico (títulos, definiciones
 *   del tipo "X es …", citas normativas por expresión regular). Se informa como tal.
 * En ambos casos el contenido queda marcado con su origen (material del usuario / externo).
 */
import type { MaterialAI } from "../../core/api.ts";
import type { ConceptMap, ConceptNode } from "../conceptmap/model.ts";

export interface ProcessedMaterial {
  mode: "ia" | "local";
  units: { title: string; summary: string; concepts: string[] }[];
  concepts: { id: string; name: string; definition: string; origin: "material" | "externo" }[];
  relations: { from: string; to: string; label: string }[];
  questions: { q: string; a: string; origin: "material" | "externo" }[];
  norms: { cita: string; requiereVerificacion: boolean }[];
  warnings: string[];
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

const HEADING = /^(?:[Uu]nidad|UNIDAD|[Cc]ap[ií]tulo|CAP[IÍ]TULO|[Tt]ema|TEMA|[Tt][ií]tulo|T[IÍ]TULO|[Bb]olilla|BOLILLA)\s+[\dIVXLCivxlc]+|^\d{1,2}[.)]\s+[A-ZÁÉÍÓÚÑ]|^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,.:;-]{6,80}$/;
const DEFINITION = /(?:^|[.\n]\s*)(?:(?:el|la|los|las)\s+)?([A-ZÁÉÍÓÚÑa-záéíóúñ][\wáéíóúñ ]{2,50}?)\s+(?:es|son|consiste en|se define como|se entiende por)\s+([^.]{20,300})\./g;
const NORM = /\b(?:art(?:[íi]culo|s?\.)\s*\d+(?:\s*(?:bis|ter))?(?:\s*inc(?:iso|\.)?\s*[a-z]\))?(?:\s*(?:de la|del|,)?\s*(?:ley|decreto|c[oó]digo)\s*(?:n[°º.]?\s*)?(?:\d[\d.\/]*\d|[a-záéíóú ]{0,25}))?|ley\s*(?:n[°º.]?\s*)?\d{1,2}\.?\d{3}|decreto\s*\d+\/\d{2,4})/gi;

const STOP = new Set(["esto", "esta", "este", "ello", "que", "lo cual", "la ley", "el mismo", "la misma"]);

export function processLocal(subject: string, text: string): ProcessedMaterial {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const units: ProcessedMaterial["units"] = [];
  let current: { title: string; body: string[] } | null = null;
  for (const l of lines) {
    if (!l) continue;
    if (HEADING.test(l) && l.length < 90) {
      if (current) units.push(toUnit(current));
      current = { title: l.replace(/\s+/g, " "), body: [] };
    } else {
      (current ??= { title: "Contenido general", body: [] }).body.push(l);
    }
  }
  if (current) units.push(toUnit(current));

  const concepts: ProcessedMaterial["concepts"] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(DEFINITION)) {
    const name = m[1].trim().replace(/\s+/g, " ").replace(/^(el|la|los|las)\s+/i, "");
    const id = slug(name);
    if (!id || seen.has(id) || STOP.has(name.toLowerCase()) || name.split(" ").length > 6) continue;
    seen.add(id);
    concepts.push({ id, name: name[0].toUpperCase() + name.slice(1), definition: `${m[2].trim()}.`, origin: "material" });
    if (concepts.length >= 30) break;
  }
  // Asigna cada concepto a la unidad donde aparece su definición.
  const relations: ProcessedMaterial["relations"] = [];
  const unitBodies = units.map((u) => u.summary);
  for (const c of concepts) {
    const ui = units.findIndex((u, i) => (unitBodies[i] + u.title).toLowerCase().includes(c.name.toLowerCase()));
    const unit = units[ui >= 0 ? ui : 0];
    if (unit) {
      unit.concepts.push(c.name);
      relations.push({ from: `u-${slug(unit.title)}`, to: c.id, label: "comprende" });
    }
  }
  const questions = concepts.map((c) => ({ q: `¿Qué es "${c.name}" según tu material?`, a: c.definition, origin: "material" as const }));
  const norms = [...new Set([...text.matchAll(NORM)].map((m) => m[0].replace(/\s+/g, " ").trim()))]
    .slice(0, 40)
    .map((cita) => ({ cita, requiereVerificacion: true }));
  const warnings = [
    "Procesamiento LOCAL básico (sin IA): detecta títulos y definiciones con la forma \"X es …\". Revisá y completá los resultados.",
  ];
  if (!concepts.length) warnings.push("No se detectaron definiciones explícitas. Con la IA configurada en el servidor el análisis es más completo.");
  if (norms.length) warnings.push("Las normas citadas en tu material NO fueron verificadas: confirmá su vigencia en InfoLEG o el Boletín Oficial.");
  return { mode: "local", units, concepts, relations, questions, norms, warnings: [...warnings, `Materia: ${subject}`] };
}

function toUnit(u: { title: string; body: string[] }) {
  const joined = u.body.join(" ");
  return { title: u.title, summary: joined.length > 600 ? `${joined.slice(0, 600)}…` : joined, concepts: [] as string[] };
}

export function fromAI(ai: MaterialAI): ProcessedMaterial {
  const ids = new Set(ai.conceptos.map((c) => c.id));
  return {
    mode: "ia",
    units: ai.unidades.map((u) => ({ title: u.titulo, summary: u.resumen, concepts: u.conceptos })),
    concepts: ai.conceptos.map((c) => ({ id: slug(c.id) || slug(c.nombre), name: c.nombre, definition: c.definicion, origin: c.origen })),
    relations: ai.relaciones.filter((r) => ids.has(r.desde) && ids.has(r.hasta)).map((r) => ({ from: slug(r.desde), to: slug(r.hasta), label: r.tipo })),
    questions: ai.preguntas.map((p) => ({ q: p.pregunta, a: p.respuesta, origin: p.origen })),
    norms: ai.normasMencionadas,
    warnings: ["Procesado con IA. El contenido marcado como \"externo\" no surge de tu material.", ...ai.advertencias],
  };
}

/** Convierte un material procesado en una red conceptual jugable. */
export function toConceptMap(id: string, title: string, subject: string, p: ProcessedMaterial): ConceptMap {
  const topic = `mat:${id}`;
  const rootId = "root";
  const nodes: ConceptNode[] = [
    { id: rootId, label: title.toUpperCase().slice(0, 40), kind: "concepto", topic, info: { explicacion: `Red generada a partir de tu material (${p.mode === "ia" ? "con IA" : "procesamiento local"}).`, normas: [], preguntas: [], origen: "material" } },
  ];
  const edges: ConceptMap["edges"] = [];
  const known = new Set<string>([rootId]);
  if (p.mode === "local") {
    for (const u of p.units) {
      const uid = `u-${slug(u.title)}`;
      if (known.has(uid)) continue;
      known.add(uid);
      nodes.push({ id: uid, label: u.title.slice(0, 40), kind: "concepto", topic, info: { explicacion: u.summary || "(sin texto)", normas: [], preguntas: [], origen: "material" } });
      edges.push({ from: rootId, to: uid, label: "comprende" });
    }
  }
  for (const c of p.concepts) {
    if (known.has(c.id)) continue;
    known.add(c.id);
    nodes.push({ id: c.id, label: c.name.slice(0, 40), kind: "concepto", topic, info: { explicacion: c.definition, normas: [], preguntas: [`¿Qué es ${c.name}?`], origen: c.origin } });
  }
  for (const r of p.relations) if (known.has(r.from) && known.has(r.to) && r.from !== r.to) edges.push({ from: r.from, to: r.to, label: r.label });
  // Conceptos sueltos: se cuelgan de la raíz para que la red sea navegable.
  for (const n of nodes) if (n.id !== rootId && !edges.some((e) => e.to === n.id)) edges.push({ from: rootId, to: n.id, label: "comprende" });
  return { id: `mat-${id}`, title, subject, origin: "material", root: rootId, nodes, edges };
}
