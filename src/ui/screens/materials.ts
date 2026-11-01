/** CARGA Y PROCESAMIENTO DE MATERIAL DE ESTUDIO. */
import { ApiError, extractFile, getHealth } from "../../core/api.ts";
import { aiMode, processMaterialAI } from "../../core/ai.ts";
import { events, store, type MaterialMeta } from "../../core/state.ts";
import { fromAI, processLocal, type ProcessedMaterial } from "../../modules/materials/processor.ts";
import { deleteMaterial, loadMaterial, saveMaterial } from "../../modules/materials/storage.ts";
import { newCard, upsertCard } from "../../systems/memory.ts";
import { BUILDING_UNLOCKS, BADGES } from "../../systems/gamification.ts";
import { SUBJECTS } from "../../systems/topics.ts";
import { add, clear, confirmTwice, h, openPanel } from "../dom.ts";
import { go, registerScreen } from "../nav.ts";

export function openUpload(subject?: unknown) {
  openPanel({ title: "Cargar material", subtitle: "Apuntes, programas, legislación, jurisprudencia", back: () => go("study") }, async (body) => {
    const hh = { ...(await getHealth()), ai: (await aiMode()) !== null };
    const subj = h("select", null, SUBJECTS.map((s) => h("option", { value: s.id, selected: s.id === (subject ?? "tributario") }, s.name)));
    const name = h("input", { type: "text", placeholder: "Nombre (p. ej. 'Unidad 4 — Ilícitos')" });
    const file = h("input", { type: "file", accept: ".pdf,.docx,.pptx,.txt,.md,image/*" });
    const ta = h("textarea", { placeholder: "…o pegá el texto acá" });
    const kindSel = h("select", null, ["Apuntes", "Programa de la materia", "Legislación", "Jurisprudencia", "Otro"].map((k) => h("option", null, k)));
    const status = h("div");
    const go_ = h("button", { class: "btn gold", onclick: () => run() }, "Procesar material");
    add(body, 
      h(
        "div",
        { class: "stack" },
        h("p", { class: hh.ai ? "notice ok" : "notice" }, hh.ai ? "La IA convertirá el material en unidades, red conceptual y preguntas, distinguiendo lo que surge de tu material de lo externo." : hh.ok ? "IA no configurada: se aplicará un procesamiento LOCAL básico (títulos, definiciones y citas normativas)." : "Servidor no disponible: sólo se puede pegar texto (sin PDF/DOCX/PPTX) y se procesará localmente."),
        h("p", { class: "notice info" }, "Fotografías de textos: el OCR todavía NO está implementado en esta versión. Usá PDF con texto seleccionable o pegá el texto."),
        h("label", { class: "field" }, "Materia", subj),
        h("label", { class: "field" }, "Tipo", kindSel),
        h("label", { class: "field" }, "Nombre", name),
        h("label", { class: "field" }, "Archivo (PDF, DOCX, PPTX, TXT, MD)", file),
        ta,
        go_,
        status,
      ),
    );

    const run = async () => {
      clear(status);
      go_.disabled = true;
      const say = (t: string, cls = "info") => add(status, h("p", { class: `notice ${cls}` }, t));
      try {
        let text = ta.value.trim();
        let kind = "texto";
        let warnings: string[] = [];
        let fname = name.value.trim();
        const f = file.files?.[0];
        if (f) {
          say(`Extrayendo texto de ${f.name}…`);
          const ex = await extractFile(f);
          text = ex.text.trim();
          kind = ex.kind;
          warnings = ex.warnings;
          fname ||= ex.name.replace(/\.[^.]+$/, "");
        }
        if (text.length < 40) throw new Error("No hay texto suficiente para procesar (mínimo unas líneas).");
        fname ||= `Material ${store.state.materials.length + 1}`;
        let processed: ProcessedMaterial;
        if (hh.ai) {
          say("Procesando con IA…");
          try {
            processed = fromAI(await processMaterialAI(SUBJECTS.find((s) => s.id === subj.value)!.name, text));
          } catch (e) {
            say(`La IA no pudo procesarlo (${(e as Error).message}). Se usa el procesamiento local.`, "");
            processed = processLocal(subj.value, text);
          }
        } else processed = processLocal(subj.value, text);
        processed.warnings.unshift(...warnings, `Tipo declarado: ${kindSel.value}`);
        const id = `${Date.now().toString(36)}`;
        await saveMaterial(id, { text, processed });
        const meta: MaterialMeta = {
          id,
          name: fname,
          subject: subj.value,
          kind,
          chars: text.length,
          addedAt: Date.now(),
          processed: processed.mode,
          units: processed.units,
          warnings: processed.warnings,
        };
        const hadBadge = store.state.badges.includes("lector");
        const unlockedBefore = new Set(store.state.unlocked);
        store.update("material", (s) => {
          s.materials.push(meta);
          for (const q of processed.questions) s.cards = upsertCard(s.cards, newCard(`mat:${id}:${q.q}`, `mat:${id}`, q.q, `${q.a}${q.origin === "externo" ? " (contenido externo, no surge de tu material)" : ""}`, "material"));
          if (!s.badges.includes("lector")) s.badges.push("lector");
          for (const b of BUILDING_UNLOCKS) if (!s.unlocked.includes(b.id) && b.check(s)) s.unlocked.push(b.id);
        });
        if (!hadBadge) events.emit({ type: "badge", id: "lector", name: BADGES.lector.name });
        for (const u of store.state.unlocked) if (!unlockedBefore.has(u)) events.emit({ type: "unlock", building: u, name: BUILDING_UNLOCKS.find((b) => b.id === u)!.name });
        openMaterial(id);
      } catch (e) {
        say(e instanceof ApiError || e instanceof Error ? e.message : String(e), "bad");
        go_.disabled = false;
      }
    };
  });
}

export function openMaterials(id?: unknown): void {
  if (typeof id === "string") return openMaterial(id);
  openPanel({ title: "Mis materiales", back: () => go("study") }, (body) => {
    const mats = store.state.materials;
    if (!mats.length) add(body, h("p", { class: "muted" }, "Todavía no cargaste material."), h("button", { class: "btn gold", onclick: () => go("upload") }, "Cargar material"));
    for (const m of mats)
      add(body, 
        h(
          "div",
          { class: "card click", style: "margin-bottom:8px", onclick: () => openMaterial(m.id) },
          h("div", { class: "row between" }, h("h3", null, m.name), h("span", { class: "tag" }, m.processed === "ia" ? "procesado con IA" : "procesado local")),
          h("p", { class: "muted" }, `${SUBJECTS.find((s) => s.id === m.subject)?.name} · ${m.kind.toUpperCase()} · ${m.chars.toLocaleString("es-AR")} caracteres · ${m.units.length} unidades`),
        ),
      );
  });
}

function openMaterial(id: string): void {
  const meta = store.state.materials.find((m) => m.id === id);
  if (!meta) return openMaterials();
  openPanel({ title: meta.name, subtitle: "Material del usuario", back: () => openMaterials(), wide: true }, async (body) => {
    const st = await loadMaterial(id).catch(() => null);
    const p = st?.processed;
    add(body, meta.warnings.map((w) => h("p", { class: "notice" }, w)));
    if (!p) {
      add(body, h("p", { class: "notice bad" }, "No se encontró el contenido en este navegador (IndexedDB)."));
      return;
    }
    add(body, 
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => go("maps") }, "Ver como red conceptual"), h("button", { class: "btn", onclick: () => go("memory") }, `Repasar sus ${p.questions.length} preguntas`), h("button", {
        class: "btn",
        onclick: (e: Event) => confirmTwice(e.currentTarget as HTMLButtonElement, "Tocá otra vez para eliminar", async () => {
          await deleteMaterial(id);
          store.update("material-del", (s) => {
            s.materials = s.materials.filter((m) => m.id !== id);
            s.cards = s.cards.filter((c) => c.topic !== `mat:${id}`);
          });
          openMaterials();
        }),
      }, "Eliminar")),
      h("h3", null, "Unidades de estudio"),
      p.units.map((u) => h("div", { class: "card", style: "margin-bottom:8px" }, h("h4", { style: "margin-top:0" }, u.title), h("p", null, u.summary), u.concepts.length ? h("p", { class: "muted" }, `Conceptos: ${u.concepts.join(", ")}`) : null)),
      h("h3", null, "Conceptos"),
      p.concepts.length
        ? h("table", { class: "t" }, p.concepts.map((c) => h("tr", null, h("td", null, h("b", null, c.name)), h("td", null, c.definition), h("td", null, h("span", { class: `tag ${c.origin === "material" ? "info" : "warn"}` }, c.origin)))))
        : h("p", { class: "muted" }, "No se detectaron conceptos."),
      h("h3", null, "Normas citadas en tu material"),
      p.norms.length
        ? h("ul", null, p.norms.map((n) => h("li", null, n.cita, " ", n.requiereVerificacion ? h("span", { class: "tag warn" }, "verificar vigencia") : null)))
        : h("p", { class: "muted" }, "Ninguna detectada."),
      h("p", { class: "notice info" }, "LEGAL LIFE no agrega artículos, fallos ni plazos que no estén en tu material o en su base de referencias; las citas de tu material deben verificarse en InfoLEG o el Boletín Oficial."),
    );
  });
}

registerScreen("upload", openUpload);
registerScreen("materials", openMaterials);
