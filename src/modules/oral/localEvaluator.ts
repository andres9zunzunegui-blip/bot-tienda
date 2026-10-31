/**
 * EVALUADOR LOCAL (sin IA generativa).
 *
 * Se usa cuando el servidor no tiene configurada la IA. Busca CONCEPTOS, no
 * palabras exactas: cada punto clave define grupos de expresiones equivalentes
 * (sinónimos, raíces, perífrasis). Es una aproximación y la interfaz lo indica
 * siempre como "evaluación local aproximada".
 */

export interface KeyPoint {
  id: string;
  label: string;
  /** Todos los grupos deben estar presentes; dentro de cada grupo basta una alternativa (regex sin flags). */
  groups: string[][];
  weight?: number;
  followUp?: string;
  criterio?: "precision" | "fundamentacion" | "argumentacion" | "terminologia" | "relacion";
}

export interface LocalEvaluation {
  score: number; // 0..1
  covered: KeyPoint[];
  missed: KeyPoint[];
  criterios: Record<"precision" | "fundamentacion" | "argumentacion" | "terminologia" | "relacion", number>;
  observaciones: string[];
  repregunta: string;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

const NEGATIONS = /\b(no|nunca|jamas|tampoco|ni)\b(?:\s+\S+){0,3}\s*$/;

function groupMatches(text: string, alternatives: string[]): boolean {
  for (const alt of alternatives) {
    const re = new RegExp(alt, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      // Descarta coincidencias precedidas inmediatamente por una negación ("no es una infracción formal").
      const before = text.slice(Math.max(0, m.index - 30), m.index);
      if (!NEGATIONS.test(before)) return true;
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return false;
}

const TECH_TERMS =
  /(tipicidad|antijuridicidad|culpabilidad|imputabilidad|juez administrativo|acta de comprobacion|descargo|apelacion|recurso|plazo|habiles|infraccion|sancion|clausura|reincidencia|graduacion|nulidad|perjuicio|debido proceso|defensa en juicio|competencia|penal economico|organismo recaudador|responsable|contribuyente)/g;

export function evaluateLocal(answer: string, keyPoints: KeyPoint[]): LocalEvaluation {
  const text = normalize(answer);
  const covered: KeyPoint[] = [];
  const missed: KeyPoint[] = [];
  for (const kp of keyPoints) (kp.groups.every((g) => groupMatches(text, g)) ? covered : missed).push(kp);

  const total = keyPoints.reduce((a, k) => a + (k.weight ?? 1), 0) || 1;
  const got = covered.reduce((a, k) => a + (k.weight ?? 1), 0);
  let score = got / total;

  const words = text.split(" ").filter(Boolean).length;
  const observaciones: string[] = [];
  if (words < 12) {
    score *= 0.7;
    observaciones.push("La respuesta es demasiado breve para un examen universitario: desarrollá y fundamentá.");
  }
  const cites = /\b(art(iculo)?\.?\s*\d+|ley\s*\d|inc(iso)?\.?\s*[a-z]\))/.test(text);
  const terms = new Set(text.match(TECH_TERMS) ?? []).size;
  const byCrit = (c: KeyPoint["criterio"]) => {
    const all = keyPoints.filter((k) => (k.criterio ?? "precision") === c);
    if (!all.length) return Math.round(score * 10);
    return Math.round((all.filter((k) => covered.includes(k)).length / all.length) * 10);
  };
  const criterios = {
    precision: byCrit("precision"),
    fundamentacion: Math.round(Math.min(10, byCrit("fundamentacion") * 0.7 + (cites ? 3 : 0))),
    argumentacion: Math.min(10, Math.round(score * 7 + (/(porque|por lo tanto|en consecuencia|ya que|dado que|toda vez que|por ende)/.test(text) ? 3 : 0))),
    terminologia: Math.min(10, terms * 2),
    relacion: byCrit("relacion"),
  };
  if (!cites) observaciones.push("No citaste normas concretas (artículo y ley).");
  const next = missed.find((k) => k.followUp);
  return {
    score: Math.max(0, Math.min(1, score)),
    covered,
    missed,
    criterios,
    observaciones,
    repregunta: next?.followUp ?? "",
  };
}
