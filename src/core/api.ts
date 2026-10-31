/** Cliente HTTP del servidor de LEGAL LIFE. */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export interface Health {
  ok: boolean;
  ai: boolean;
  ocr: boolean;
}

let health: Health | null = null;

export async function getHealth(force = false): Promise<Health> {
  if (health && !force) return health;
  try {
    const r = await fetch("/api/health");
    health = r.ok ? await r.json() : { ok: false, ai: false, ocr: false };
  } catch {
    health = { ok: false, ai: false, ocr: false };
  }
  return health!;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(data.error ?? `Error ${r.status}`, r.status, data.code);
  return data as T;
}

export async function extractFile(file: File): Promise<{ name: string; text: string; kind: string; warnings: string[] }> {
  const fd = new FormData();
  fd.append("file", file);
  let r: Response;
  try {
    r = await fetch("/api/extract", { method: "POST", body: fd });
  } catch {
    throw new ApiError("No hay conexión con el servidor de LEGAL LIFE: no se pueden procesar PDF/DOCX/PPTX. Podés pegar el texto manualmente.", 0);
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(data.error ?? `Error ${r.status}`, r.status);
  return data;
}

export interface OralEval {
  criterios: { precision: number; fundamentacion: number; argumentacion: number; terminologia: number; relacion: number };
  aciertos: string[];
  errores: { error: string; correccion: string }[];
  conceptosOmitidos: string[];
  devolucion: string;
  repregunta: string;
  advertenciasNormativas: string[];
}

export const aiOral = (body: unknown) => post<OralEval>("/api/ai/oral", body);
export const aiDecision = (body: unknown) => post<{ explicacion: string; advertencias: string[] }>("/api/ai/decision", body);

export interface MaterialAI {
  titulo: string;
  resumen: string;
  unidades: { titulo: string; resumen: string; conceptos: string[] }[];
  conceptos: { id: string; nombre: string; definicion: string; origen: "material" | "externo" }[];
  relaciones: { desde: string; hasta: string; tipo: string }[];
  preguntas: { pregunta: string; respuesta: string; origen: "material" | "externo" }[];
  normasMencionadas: { cita: string; requiereVerificacion: boolean }[];
  advertencias: string[];
}
export const aiMaterial = (subject: string, text: string) => post<MaterialAI>("/api/ai/material", { subject, text });
