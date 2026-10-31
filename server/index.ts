/**
 * Servidor de LEGAL LIFE.
 *  - /api/health          estado de servicios (IA disponible o no)
 *  - /api/extract         procesamiento documental (multipart, campo "file")
 *  - /api/ai/oral         evaluación de examen oral / audiencia
 *  - /api/ai/material     conversión de apuntes en unidades, red y preguntas
 *  - /api/ai/decision     explicación de una decisión del simulador
 * En producción también sirve el cliente compilado (dist/).
 */
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import {
  AIRefusalError,
  AIUnavailableError,
  aiAvailable,
  evaluateOral,
  explainDecision,
  processMaterial,
} from "./ai.ts";
import { UnsupportedFileError, extractText } from "./extract.ts";

const app = express();
app.use(express.json({ limit: "4mb" }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const MAX_MATERIAL_CHARS = 120_000;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai: aiAvailable(), ocr: false });
});

app.post("/api/extract", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return void res.status(400).json({ error: "Falta el archivo (campo 'file')." });
    const name = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const out = await extractText(name, req.file.mimetype, req.file.buffer);
    res.json({ name, ...out });
  } catch (e) {
    next(e);
  }
});

app.post("/api/ai/oral", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (typeof b.question !== "string" || typeof b.answer !== "string")
      return void res.status(400).json({ error: "question y answer son obligatorios" });
    res.json(
      await evaluateOral({
        role: b.role === "juez" ? "juez" : "profesor",
        rigor: b.rigor === "exigente" ? "exigente" : "normal",
        question: b.question,
        answer: b.answer.slice(0, 8000),
        keyPoints: Array.isArray(b.keyPoints) ? b.keyPoints.map(String) : [],
        legalBasis: Array.isArray(b.legalBasis) ? b.legalBasis.map(String) : [],
        history: Array.isArray(b.history) ? b.history.slice(-12) : [],
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.post("/api/ai/material", async (req, res, next) => {
  try {
    const { subject, text } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) return void res.status(400).json({ error: "text es obligatorio" });
    if (text.length > MAX_MATERIAL_CHARS)
      return void res.status(413).json({
        error: `El material tiene ${text.length} caracteres; el máximo por envío es ${MAX_MATERIAL_CHARS}. Dividilo en unidades.`,
      });
    res.json(await processMaterial(String(subject ?? "General"), text));
  } catch (e) {
    next(e);
  }
});

app.post("/api/ai/decision", async (req, res, next) => {
  try {
    res.json(await explainDecision(req.body));
  } catch (e) {
    next(e);
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AIUnavailableError) return void res.status(503).json({ error: err.message, code: "AI_UNAVAILABLE" });
  if (err instanceof AIRefusalError) return void res.status(422).json({ error: err.message, code: "AI_REFUSAL" });
  if (err instanceof UnsupportedFileError) return void res.status(415).json({ error: err.message });
  if (err instanceof Anthropic.RateLimitError) return void res.status(429).json({ error: "Límite de uso de la IA alcanzado. Reintentá en unos segundos." });
  if (err instanceof Anthropic.APIError) {
    console.error("[ai]", err.status, err.message);
    return void res.status(502).json({ error: "Error del servicio de IA", code: "AI_ERROR" });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno" });
});

if (process.env.NODE_ENV === "production") {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`LEGAL LIFE API en http://localhost:${port} — IA ${aiAvailable() ? "activa" : "NO configurada (modo evaluador local)"}`);
});
