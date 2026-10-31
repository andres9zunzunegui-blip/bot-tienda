/**
 * Módulo de Inteligencia Artificial (lado servidor).
 *
 * La clave de la API nunca llega al navegador: el cliente llama a /api/ai/* y
 * este módulo habla con Claude. Si no hay ANTHROPIC_API_KEY, los endpoints
 * responden 503 y el cliente usa su evaluador local (y lo informa en pantalla).
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export class AIUnavailableError extends Error {}
export class AIRefusalError extends Error {}

const LEGAL_GUARDRAILS = `Reglas obligatorias:
- Trabajás para LEGAL LIFE, un videojuego educativo para estudiantes universitarios de Derecho argentino.
- Nunca inventes artículos, fallos, plazos, montos ni disposiciones. Si no estás seguro de la vigencia o el texto exacto de una norma, decilo expresamente ("verificar en InfoLEG / Boletín Oficial").
- No presentes una interpretación discutida como regla indiscutida: señalá cuando hay debate doctrinario o jurisprudencial.
- Distinguí siempre lo que surge del material aportado por el estudiante de la información externa que agregás.
- Respondé en español rioplatense, con terminología jurídica precisa.`;

async function structured<T extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: T;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<T>> {
  if (!aiAvailable()) throw new AIUnavailableError("ANTHROPIC_API_KEY no configurada");
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    system: `${LEGAL_GUARDRAILS}\n\n${opts.system}`,
    messages: [{ role: "user", content: opts.user }],
  });
  if (response.stop_reason === "refusal") throw new AIRefusalError("El modelo declinó la solicitud");
  if (!response.parsed_output) throw new Error("Respuesta de la IA sin formato válido");
  return response.parsed_output as z.infer<T>;
}

/* ------------------------------------------------------------------ */
/* Examen oral / audiencia                                              */
/* ------------------------------------------------------------------ */

export const OralEvaluationSchema = z.object({
  criterios: z.object({
    precision: z.number().describe("0 a 10: precisión conceptual"),
    fundamentacion: z.number().describe("0 a 10: fundamentación normativa"),
    argumentacion: z.number().describe("0 a 10: argumentación jurídica"),
    terminologia: z.number().describe("0 a 10: terminología técnica"),
    relacion: z.number().describe("0 a 10: capacidad de relacionar instituciones"),
  }),
  aciertos: z.array(z.string()),
  errores: z.array(
    z.object({
      error: z.string(),
      correccion: z.string(),
    }),
  ),
  conceptosOmitidos: z.array(z.string()),
  devolucion: z.string().describe("Devolución del docente/juez, en primera persona, 2 a 5 oraciones"),
  repregunta: z.string().describe("Repregunta basada en lo que respondió el alumno; cadena vacía si no corresponde"),
  advertenciasNormativas: z.array(z.string()).describe("Advertencias sobre vigencia o debate interpretativo"),
});
export type OralEvaluation = z.infer<typeof OralEvaluationSchema>;

export interface OralRequest {
  role: "profesor" | "juez";
  rigor: "normal" | "exigente";
  question: string;
  keyPoints: string[];
  legalBasis: string[];
  history: { speaker: "examinador" | "alumno"; text: string }[];
  answer: string;
}

export async function evaluateOral(req: OralRequest): Promise<OralEvaluation> {
  const persona =
    req.role === "juez"
      ? "Sos un juez que conduce una audiencia. Evaluás la exposición del abogado (el jugador)."
      : "Sos un profesor titular de una facultad de Derecho argentina tomando un examen oral.";
  const rigor =
    req.rigor === "exigente"
      ? "Modo EXIGENTE: no aceptás respuestas vagas; exigís cita normativa concreta y repreguntás sobre los puntos débiles."
      : "Modo normal: exigente pero didáctico.";
  const transcript = req.history.map((h) => `${h.speaker.toUpperCase()}: ${h.text}`).join("\n");
  return structured({
    system: `${persona}\n${rigor}\nEvaluá el SENTIDO jurídico de la respuesta, no la coincidencia de palabras. Una respuesta con otras palabras pero conceptualmente correcta debe puntuar alto; una respuesta que repite términos sin comprenderlos debe puntuar bajo.`,
    user: `PREGUNTA: ${req.question}

PUNTOS CLAVE ESPERADOS (guía del docente, no exhaustiva):
${req.keyPoints.map((k) => `- ${k}`).join("\n")}

BASE NORMATIVA DE REFERENCIA CARGADA EN EL JUEGO:
${req.legalBasis.map((k) => `- ${k}`).join("\n") || "- (sin referencias cargadas)"}

TRANSCRIPCIÓN PREVIA:
${transcript || "(inicio del examen)"}

RESPUESTA DEL ALUMNO:
${req.answer}`,
    schema: OralEvaluationSchema,
    effort: req.rigor === "exigente" ? "high" : "medium",
  });
}

/* ------------------------------------------------------------------ */
/* Procesamiento de material de estudio                                 */
/* ------------------------------------------------------------------ */

export const MaterialSchema = z.object({
  titulo: z.string(),
  resumen: z.string(),
  unidades: z.array(
    z.object({
      titulo: z.string(),
      resumen: z.string(),
      conceptos: z.array(z.string()),
    }),
  ),
  conceptos: z.array(
    z.object({
      id: z.string().describe("slug único en minúsculas"),
      nombre: z.string(),
      definicion: z.string().describe("Definición tomada del material"),
      origen: z.enum(["material", "externo"]),
    }),
  ),
  relaciones: z.array(
    z.object({
      desde: z.string().describe("id de concepto"),
      hasta: z.string().describe("id de concepto"),
      tipo: z.string().describe("p. ej.: 'es especie de', 'se tramita ante', 'se diferencia de'"),
    }),
  ),
  preguntas: z.array(
    z.object({
      pregunta: z.string(),
      respuesta: z.string(),
      origen: z.enum(["material", "externo"]),
    }),
  ),
  normasMencionadas: z.array(
    z.object({
      cita: z.string().describe("Tal como aparece en el material, p. ej. 'art. 40 Ley 11.683'"),
      requiereVerificacion: z.boolean(),
    }),
  ),
  advertencias: z.array(z.string()),
});
export type MaterialAnalysis = z.infer<typeof MaterialSchema>;

export async function processMaterial(subject: string, text: string): Promise<MaterialAnalysis> {
  return structured({
    system: `Convertís apuntes universitarios en unidades de estudio, una red conceptual y preguntas de recuperación activa.
Marcá origen="material" sólo si el contenido surge del texto aportado; si agregás algo propio, origen="externo".
Toda norma citada en el material debe listarse en normasMencionadas; requiereVerificacion=true salvo que el propio material transcriba el texto.`,
    user: `MATERIA: ${subject}\n\nMATERIAL DEL ESTUDIANTE:\n"""\n${text}\n"""`,
    schema: MaterialSchema,
    effort: "medium",
    maxTokens: 32000,
  });
}

/* ------------------------------------------------------------------ */
/* Explicación de decisiones del simulador                              */
/* ------------------------------------------------------------------ */

export const DecisionFeedbackSchema = z.object({
  explicacion: z.string(),
  advertencias: z.array(z.string()),
});

export async function explainDecision(input: {
  stage: string;
  facts: string;
  chosen: string;
  correct: string;
  legalBasis: string[];
  argument?: string;
}) {
  return structured({
    system:
      "Sos el tutor del simulador de procedimientos. Explicás al jugador, con cita de las normas cargadas, por qué su decisión fue o no adecuada. Si el jugador escribió un argumento, evaluá su calidad jurídica.",
    user: `ETAPA: ${input.stage}\nHECHOS: ${input.facts}\nDECISIÓN DEL JUGADOR: ${input.chosen}\nDECISIÓN ADECUADA SEGÚN EL CASO: ${input.correct}\nNORMAS DEL CASO:\n${input.legalBasis.join("\n")}\nARGUMENTO ESCRITO DEL JUGADOR: ${input.argument ?? "(no escribió)"}`,
    schema: DecisionFeedbackSchema,
    effort: "low",
  });
}
