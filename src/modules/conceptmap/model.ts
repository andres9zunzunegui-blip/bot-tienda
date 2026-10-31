/**
 * REDES CONCEPTUALES — modelo, diseño (layout) y validación.
 * Independiente de la interfaz: se usa tanto con la red de referencia como con
 * redes generadas a partir del material del usuario.
 */

export interface ConceptNode {
  id: string;
  label: string;
  kind: "concepto" | "institucion" | "procedimiento" | "norma" | "jurisprudencia";
  topic: string;
  info: { explicacion: string; ejemplo?: string; normas: string[]; preguntas: string[]; refs?: string[]; origen?: "material" | "externo" };
}

export interface ConceptEdge {
  from: string;
  to: string;
  label: string;
}

export interface ConceptMap {
  id: string;
  title: string;
  subject: string;
  origin: "contenido" | "material";
  root: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  confusions?: { a: string; b: string; explanation: string }[];
}

export interface Point {
  x: number;
  y: number;
}

/** Diseño radial por niveles (BFS desde la raíz por aristas jerárquicas). */
export function layout(map: ConceptMap, width = 1400, height = 1000): Record<string, Point> {
  const hierarchical = map.edges.filter((e) => e.label !== "se diferencia de" && e.label !== "jurisprudencia relevante");
  const children: Record<string, string[]> = {};
  for (const e of hierarchical) (children[e.from] ??= []).push(e.to);
  const depth: Record<string, number> = { [map.root]: 0 };
  const parent: Record<string, string> = {};
  const order: string[] = [map.root];
  for (let i = 0; i < order.length; i++) {
    const n = order[i];
    for (const c of children[n] ?? []) {
      if (depth[c] === undefined) {
        depth[c] = depth[n] + 1;
        parent[c] = n;
        order.push(c);
      }
    }
  }
  for (const n of map.nodes) if (depth[n.id] === undefined) {
    depth[n.id] = 2;
    parent[n.id] = map.root;
    order.push(n.id);
  }
  // Cantidad de hojas por subárbol para repartir el ángulo.
  const leaves: Record<string, number> = {};
  const kids = (n: string) => order.filter((x) => parent[x] === n);
  const countLeaves = (n: string): number => (leaves[n] = kids(n).reduce((a, c) => a + countLeaves(c), 0) || 1);
  countLeaves(map.root);
  const pos: Record<string, Point> = {};
  const cx = width / 2;
  const cy = height / 2;
  const maxDepth = Math.max(...Object.values(depth));
  // Anillos suficientemente separados para que las etiquetas no se superpongan.
  const ring = Math.max(Math.min(width, height) / 2 / (maxDepth + 0.6), 150 + map.nodes.length * 4);
  const place = (n: string, a0: number, a1: number) => {
    const d = depth[n];
    const a = (a0 + a1) / 2;
    pos[n] = d === 0 ? { x: cx, y: cy } : { x: cx + Math.cos(a) * ring * d * 1.45, y: cy + Math.sin(a) * ring * d * 0.9 };
    let start = a0;
    for (const c of kids(n)) {
      const span = ((a1 - a0) * leaves[c]) / leaves[n];
      place(c, start, start + span);
      start += span;
    }
  };
  place(map.root, -Math.PI / 2, (3 * Math.PI) / 2);
  return pos;
}

export type RelationVerdict =
  | { ok: true; message: string }
  | { ok: false; kind: "etiqueta" | "direccion" | "inexistente" | "repetida"; message: string };

function name(map: ConceptMap, id: string) {
  return map.nodes.find((n) => n.id === id)?.label ?? id;
}

function describeNode(map: ConceptMap, id: string): string {
  const inc = map.edges.find((e) => e.to === id && e.label !== "se diferencia de");
  if (!inc) return `"${name(map, id)}" es el nodo central de la red`;
  return `"${name(map, id)}" se ubica así: ${name(map, inc.from)} ${inc.label} ${name(map, id)}`;
}

/** Valida una relación propuesta por el jugador y explica cómo corregirla. */
export function checkRelation(map: ConceptMap, from: string, to: string, label: string, already: ConceptEdge[] = []): RelationVerdict {
  if (already.some((e) => e.from === from && e.to === to && e.label === label))
    return { ok: false, kind: "repetida", message: "Esa relación ya está en tu red." };
  const exact = map.edges.find((e) => e.from === from && e.to === to);
  if (exact && exact.label === label) return { ok: true, message: `Correcto: ${name(map, from)} ${label} ${name(map, to)}.` };
  if (exact)
    return {
      ok: false,
      kind: "etiqueta",
      message: `Los conceptos sí están relacionados, pero no como "${label}". La relación correcta es: ${name(map, from)} ${exact.label} ${name(map, to)}.`,
    };
  const reversed = map.edges.find((e) => e.from === to && e.to === from);
  if (reversed)
    return {
      ok: false,
      kind: "direccion",
      message: `La dirección está invertida: ${name(map, to)} ${reversed.label} ${name(map, from)}, y no al revés.`,
    };
  const conf = map.confusions?.find((c) => (c.a === from && c.b === to) || (c.a === to && c.b === from));
  if (conf) return { ok: false, kind: "inexistente", message: conf.explanation };
  return {
    ok: false,
    kind: "inexistente",
    message: `No hay una relación directa entre "${name(map, from)}" y "${name(map, to)}". ${describeNode(map, from)}; ${describeNode(map, to)}.`,
  };
}

/** Elige nodos a ocultar para el modo evaluación (nunca la raíz), de forma determinística por semilla. */
export function pickBlanks(map: ConceptMap, count: number, seed = Date.now()): string[] {
  const ids = map.nodes.map((n) => n.id).filter((id) => id !== map.root);
  let s = seed % 2147483647 || 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, Math.min(count, ids.length));
}

export function scoreConstruction(map: ConceptMap, correct: number, wrongAttempts: number): number {
  const total = map.edges.length || 1;
  return Math.max(0, Math.min(1, correct / total - wrongAttempts * 0.03));
}
