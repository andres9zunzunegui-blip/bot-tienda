/**
 * CAPA DE INTELIGENCIA ARTIFICIAL del cliente.
 * Elige automáticamente el mejor camino disponible:
 *  1. "cuenta": dentro del visor de Claude, la capacidad `sample` usa la cuenta
 *     de Claude de quien juega (pide permiso la primera vez; sin clave ni servidor).
 *  2. "servidor": el servidor de LEGAL LIFE con ANTHROPIC_API_KEY.
 *  3. null: no hay IA → el juego usa su evaluador local.
 */
import { aiMaterial, aiOral, getHealth, type MaterialAI, type OralEval } from "./api.ts";

type SampleFn = ((input: string, opts?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json: <T>(input: string, opts?: Record<string, unknown>) => Promise<T>;
};
interface ClaudeHost {
  use(name: string): Promise<unknown>;
}

export type AIMode = "cuenta" | "servidor" | null;
let modePromise: Promise<AIMode> | null = null;
let sampleFn: SampleFn | null = null;
let denied = false;

export class AIUnavailable extends Error {}

export function aiMode(): Promise<AIMode> {
  modePromise ??= (async () => {
    const host = (globalThis as unknown as { claude?: ClaudeHost }).claude;
    if (host?.use) {
      try {
        sampleFn = (await host.use("sample")) as SampleFn | null;
      } catch {
        sampleFn = null;
      }
      if (sampleFn) return "cuenta";
    }
    const hh = await getHealth();
    return hh.ai ? "servidor" : null;
  })();
  return modePromise.then((m) => (m === "cuenta" && denied ? null : m));
}

export function aiLabel(m: AIMode): string {
  return m === "cuenta" ? "IA activa (tu cuenta de Claude)" : m === "servidor" ? "IA activa (servidor)" : "Corrección local (sin IA)";
}

const RULES = `Sos el motor pedagógico de LEGAL LIFE, un videojuego para estudiantes de Derecho argentino.
Reglas: no inventes artículos, fallos, plazos ni montos; si no estás seguro de la vigencia o del texto exacto de una norma, decilo ("verificar en InfoLEG"). No presentes como indiscutido lo que es debatido. Respondé en español rioplatense, claro y sin rebuscamientos.`;

function handleSampleError(e: unknown): never {
  const code = (e as { code?: string })?.code;
  if (code && ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(code)) {
    denied = true;
    throw new AIUnavailable("La IA no está habilitada en esta vista.");
  }
  if (code === "rate_limited") throw new Error("Alcanzaste el límite de uso de Claude por ahora. Probá más tarde.");
  throw new Error("La IA no respondió. Probá de nuevo.");
}

export interface OralRequest {
  role: "profesor" | "juez";
  rigor: "normal" | "exigente";
  question: string;
  keyPoints: string[];
  legalBasis: string[];
  history: { speaker: "examinador" | "alumno"; text: string }[];
  answer: string;
}

export async function evaluateOral(req: OralRequest): Promise<OralEval> {
  const mode = await aiMode();
  if (mode === "servidor") return aiOral(req);
  if (mode !== "cuenta" || !sampleFn) throw new AIUnavailable("Sin IA");
  const persona = req.role === "juez" ? "Sos una jueza que conduce una audiencia y evalúa al abogado." : "Sos un profesor titular de Derecho tomando un examen oral.";
  const prompt = `${RULES}
${persona} ${req.rigor === "exigente" ? "Modo EXIGENTE: no aceptás vaguedades y exigís cita normativa." : "Exigente pero didáctico."}
Evaluá el SENTIDO jurídico de la respuesta, no la coincidencia de palabras.

PREGUNTA: ${req.question}
PUNTOS CLAVE (guía, no exhaustiva):
${req.keyPoints.map((k) => `- ${k}`).join("\n")}
BASE NORMATIVA CARGADA:
${req.legalBasis.map((k) => `- ${k}`).join("\n") || "- (ninguna)"}
TRANSCRIPCIÓN PREVIA:
${req.history.map((h) => `${h.speaker.toUpperCase()}: ${h.text}`).join("\n").slice(-4000) || "(inicio)"}
RESPUESTA DEL ALUMNO:
${req.answer.slice(0, 6000)}

Respondé SOLO con un objeto JSON con esta forma exacta:
{"criterios":{"precision":0-10,"fundamentacion":0-10,"argumentacion":0-10,"terminologia":0-10,"relacion":0-10},"aciertos":["..."],"errores":[{"error":"...","correccion":"..."}],"conceptosOmitidos":["..."],"devolucion":"2 a 4 oraciones en primera persona","repregunta":"una repregunta basada en lo que respondió, o cadena vacía","advertenciasNormativas":["..."]}`;
  try {
    const r = await sampleFn.json<OralEval>(prompt, { modelTier: "default", cache: false });
    const c = r?.criterios ?? ({} as OralEval["criterios"]);
    const n = (v: unknown) => Math.max(0, Math.min(10, Number(v) || 0));
    return {
      criterios: { precision: n(c.precision), fundamentacion: n(c.fundamentacion), argumentacion: n(c.argumentacion), terminologia: n(c.terminologia), relacion: n(c.relacion) },
      aciertos: Array.isArray(r.aciertos) ? r.aciertos.map(String) : [],
      errores: Array.isArray(r.errores) ? r.errores.map((e) => ({ error: String(e?.error ?? ""), correccion: String(e?.correccion ?? "") })) : [],
      conceptosOmitidos: Array.isArray(r.conceptosOmitidos) ? r.conceptosOmitidos.map(String) : [],
      devolucion: String(r.devolucion ?? ""),
      repregunta: String(r.repregunta ?? ""),
      advertenciasNormativas: Array.isArray(r.advertenciasNormativas) ? r.advertenciasNormativas.map(String) : [],
    };
  } catch (e) {
    if (e instanceof AIUnavailable) throw e;
    return handleSampleError(e);
  }
}

export async function processMaterialAI(subject: string, text: string): Promise<MaterialAI> {
  const mode = await aiMode();
  if (mode === "servidor") return aiMaterial(subject, text);
  if (mode !== "cuenta" || !sampleFn) throw new AIUnavailable("Sin IA");
  const prompt = `${RULES}
Convertí estos apuntes de ${subject} en unidades de estudio, conceptos, relaciones y preguntas de repaso.
Marcá origen "material" sólo si surge del texto; si agregás algo propio, "externo". Listá toda norma citada.

APUNTES:
"""
${text.slice(0, 60000)}
"""

Respondé SOLO con JSON:
{"titulo":"","resumen":"","unidades":[{"titulo":"","resumen":"","conceptos":[""]}],"conceptos":[{"id":"slug","nombre":"","definicion":"","origen":"material"}],"relaciones":[{"desde":"id","hasta":"id","tipo":"comprende"}],"preguntas":[{"pregunta":"","respuesta":"","origen":"material"}],"normasMencionadas":[{"cita":"","requiereVerificacion":true}],"advertencias":[""]}`;
  try {
    const r = await sampleFn.json<MaterialAI>(prompt, { modelTier: "default" });
    return {
      titulo: String(r.titulo ?? ""),
      resumen: String(r.resumen ?? ""),
      unidades: Array.isArray(r.unidades) ? r.unidades : [],
      conceptos: Array.isArray(r.conceptos) ? r.conceptos : [],
      relaciones: Array.isArray(r.relaciones) ? r.relaciones : [],
      preguntas: Array.isArray(r.preguntas) ? r.preguntas : [],
      normasMencionadas: Array.isArray(r.normasMencionadas) ? r.normasMencionadas : [],
      advertencias: Array.isArray(r.advertencias) ? r.advertencias.map(String) : [],
    };
  } catch (e) {
    if (e instanceof AIUnavailable) throw e;
    return handleSampleError(e);
  }
}

/** Explica un contenido "de otra forma", en lenguaje simple y con un ejemplo cotidiano. */
export async function explainSimply(topic: string, content: string, onText?: (t: string) => void): Promise<string> {
  const mode = await aiMode();
  if (mode !== "cuenta" || !sampleFn) throw new AIUnavailable("Sin IA");
  const prompt = `${RULES}
Un estudiante no entendió este contenido. Explicáselo de otra forma, en lenguaje muy simple, en 4 a 6 oraciones cortas, con un ejemplo cotidiano argentino. No agregues normas que no estén en el contenido. Sin títulos ni listas.

TEMA: ${topic}
CONTENIDO:
${content}`;
  try {
    const r = await sampleFn(prompt, { modelTier: "quick", cache: { gcTime: 86_400_000 }, onText: onText ? ({ text }: { text: string }) => onText(text) : undefined });
    return r.text;
  } catch (e) {
    return handleSampleError(e);
  }
}
