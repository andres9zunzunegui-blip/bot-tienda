/**
 * Procesamiento documental: extrae texto plano de PDF, DOCX, PPTX y TXT/MD.
 * Las imágenes (fotografías de textos) requieren OCR, que todavía NO está
 * implementado: se informa explícitamente en lugar de simular.
 */
import JSZip from "jszip";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export interface Extraction {
  text: string;
  kind: "pdf" | "docx" | "pptx" | "texto" | "imagen";
  warnings: string[];
}

export class UnsupportedFileError extends Error {}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export async function extractPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const out: string[] = [];
  for (const [i, name] of slides.entries()) {
    const xml = await zip.files[name].async("string");
    const paragraphs = xml.split(/<\/a:p>/).map((p) =>
      [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1])).join(""),
    );
    const text = paragraphs.filter((p) => p.trim()).join("\n");
    if (text) out.push(`--- Diapositiva ${i + 1} ---\n${text}`);
  }
  return out.join("\n\n");
}

export async function extractText(filename: string, mime: string, buffer: Buffer): Promise<Extraction> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const warnings: string[] = [];
  if (ext === "pdf" || mime === "application/pdf") {
    const res = await pdfParse(buffer);
    if (res.text.trim().length < 50)
      warnings.push("El PDF casi no tiene texto seleccionable: puede ser un escaneo. El OCR todavía no está implementado.");
    return { text: res.text, kind: "pdf", warnings };
  }
  if (ext === "docx") {
    const res = await mammoth.extractRawText({ buffer });
    return { text: res.value, kind: "docx", warnings };
  }
  if (ext === "pptx") {
    return { text: await extractPptx(buffer), kind: "pptx", warnings };
  }
  if (["txt", "md"].includes(ext) || mime.startsWith("text/")) {
    return { text: buffer.toString("utf8"), kind: "texto", warnings };
  }
  if (mime.startsWith("image/")) {
    throw new UnsupportedFileError(
      "Las fotografías de textos requieren OCR, función todavía NO implementada en esta versión. Copiá el texto o subí un PDF con texto seleccionable.",
    );
  }
  throw new UnsupportedFileError(`Formato no soportado: .${ext}. Formatos aceptados: PDF, DOCX, PPTX, TXT, MD.`);
}
