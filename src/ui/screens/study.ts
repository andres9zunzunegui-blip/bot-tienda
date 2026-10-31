/** ESTUDIAR: materias, unidades con comprobación de comprensión. */
import { TRIBUTARIO_MAP } from "../../content/tributarioMap.ts";
import { store } from "../../core/state.ts";
import { upsertCard } from "../../systems/memory.ts";
import { recordActivity, topicMastery } from "../../systems/gamification.ts";
import { contentCardsFor } from "../../systems/seed.ts";
import { SUBJECTS, TOPICS } from "../../systems/topics.ts";
import { add, bar, clear, h, openPanel, pct } from "../dom.ts";
import { go, registerScreen } from "../nav.ts";
import { refCard } from "./simulator.ts";

export function openStudy() {
  openPanel({ title: "Estudiar", subtitle: "Materias, unidades, material propio y memoria", wide: true }, (body) => {
    const s = store.state;
    const due = s.cards.filter((c) => c.due <= Date.now()).length;
    add(body, 
      h(
        "div",
        { class: "grid c3", style: "margin-bottom:14px" },
        h("div", { class: "card click", onclick: () => go("memory") }, h("h3", null, "🧠 Entrenador de memoria"), h("p", null, `${due} tarjeta(s) para repasar hoy · ${s.cards.length} en total`)),
        h("div", { class: "card click", onclick: () => go("upload") }, h("h3", null, "📤 Cargar material"), h("p", { class: "muted" }, "PDF, DOCX, PPTX, TXT o texto pegado.")),
        h("div", { class: "card click", onclick: () => go("materials") }, h("h3", null, "📚 Mis materiales"), h("p", null, `${s.materials.length} cargado(s)`)),
      ),
      h("h3", null, "Materias"),
      h(
        "div",
        { class: "grid c2" },
        SUBJECTS.map((sub) => {
          const topics = Object.entries(TOPICS).filter(([, t]) => t.subject === sub.id);
          const mats = s.materials.filter((m) => m.subject === sub.id);
          const m = topics.length ? topics.reduce((a, [id]) => a + topicMastery(s, id), 0) / topics.length : 0;
          return h(
            "div",
            { class: "card click", onclick: () => openSubject(sub.id) },
            h("div", { class: "row between" }, h("h3", null, sub.name), sub.status === "con-contenido" ? h("span", { class: "tag ok" }, "contenido incluido") : h("span", { class: "tag" }, "cargá tu material")),
            topics.length ? [bar(m), h("p", { class: "muted" }, `Dominio promedio: ${pct(m)} · ${topics.length} unidades`)] : null,
            h("p", { class: "muted" }, `${mats.length} material(es) propio(s)`),
          );
        }),
      ),
    );
  });
}

function openSubject(subjectId: string) {
  const sub = SUBJECTS.find((x) => x.id === subjectId)!;
  openPanel({ title: sub.name, back: openStudy, wide: true }, (body) => {
    const s = store.state;
    const topics = Object.entries(TOPICS).filter(([, t]) => t.subject === subjectId);
    if (!topics.length)
      add(body, 
        h("p", { class: "notice" }, `LEGAL LIFE todavía no incluye contenido de referencia verificado para ${sub.name}. Cargá tus apuntes o el programa de la materia: se convertirán en unidades, red conceptual y preguntas.`),
        h("button", { class: "btn gold", onclick: () => go("upload", subjectId) }, "Cargar material de esta materia"),
      );
    for (const [id, t] of topics) {
      const m = topicMastery(s, id);
      const last = s.topicScores[id]?.at(-1)?.at;
      add(body, 
        h(
          "div",
          { class: "card click", style: "margin-bottom:8px", onclick: () => openUnit(id) },
          h("div", { class: "row between" }, h("h3", null, t.name), m >= 0.8 ? h("span", { class: "tag ok" }, "dominado") : last ? h("span", { class: "tag warn" }, "en progreso") : h("span", { class: "tag" }, "pendiente")),
          bar(m, m >= 0.8 ? "ok" : ""),
          h("p", { class: "muted" }, last ? `Último registro: hace ${Math.max(0, Math.round((Date.now() - last) / 86_400_000))} día(s)` : "Sin actividad"),
        ),
      );
    }
    const mats = s.materials.filter((x) => x.subject === subjectId);
    if (mats.length) add(body, h("h3", null, "Tus materiales"), mats.map((x) => h("div", { class: "card click", style: "margin-bottom:8px", onclick: () => go("materials", x.id) }, h("b", null, x.name), h("p", { class: "muted" }, `${x.units.length} unidades`))));
  });
}

interface Q {
  q: string;
  options: string[];
  correct: number;
}

function quizFor(topic: string): Q[] {
  const nodes = TRIBUTARIO_MAP.nodes.filter((n) => n.topic === topic && n.id !== TRIBUTARIO_MAP.root);
  const others = TRIBUTARIO_MAP.nodes.filter((n) => n.topic !== topic && n.id !== TRIBUTARIO_MAP.root);
  return nodes.map((n) => {
    const opts = [n.info.explicacion, ...others.sort(() => Math.random() - 0.5).slice(0, 2).map((o) => o.info.explicacion)].sort(() => Math.random() - 0.5);
    return { q: `¿Cuál es la explicación correcta de "${n.label}"?`, options: opts, correct: opts.indexOf(n.info.explicacion) };
  });
}

function openUnit(topic: string) {
  const t = TOPICS[topic];
  openPanel({ title: t.name, back: () => openSubject(t.subject), wide: true }, (body) => {
    const nodes = TRIBUTARIO_MAP.nodes.filter((n) => n.topic === topic);
    const refs = [...new Set(nodes.flatMap((n) => n.info.refs ?? []))];
    add(body, 
      h("p", { class: "notice info" }, "Leé la unidad y después comprobá tu comprensión. La experiencia se gana al demostrar que entendiste, no por abrir la unidad."),
      nodes.map((n) =>
        h("div", { class: "card", style: "margin-bottom:8px" }, h("h3", null, n.label), h("p", null, n.info.explicacion), n.info.ejemplo ? h("p", null, h("b", null, "Ejemplo: "), n.info.ejemplo) : null, h("p", { class: "muted" }, n.info.normas.join(" · "))),
      ),
      refs.length ? h("div", { class: "card" }, h("h4", { style: "margin-top:0" }, "Normas relacionadas"), refs.map((r) => refCard(r))) : null,
    );
    const quiz = quizFor(topic);
    const quizBox = h("div", { class: "card", style: "margin-top:12px" });
    add(body, quizBox);
    if (!quiz.length) {
      add(quizBox, h("p", { class: "muted" }, "Esta unidad se evalúa en el simulador, en las redes o en el examen oral."), h("button", { class: "btn", onclick: () => addCards(topic) }, "Agregar sus tarjetas al entrenador de memoria"));
      return;
    }
    const ans: number[] = new Array(quiz.length).fill(-1);
    const render = (done: boolean) => {
      clear(quizBox);
      add(quizBox, h("h3", null, "Comprobación de comprensión"));
      quiz.forEach((q, i) =>
        add(quizBox, 
          h("h4", null, q.q),
          q.options.map((o, j) => h("button", { class: `choice ${ans[i] === j ? "sel" : ""} ${done && j === q.correct ? "good" : ""} ${done && ans[i] === j && j !== q.correct ? "bad" : ""}`, disabled: done, onclick: () => ((ans[i] = j), render(false)) }, o)),
        ),
      );
      if (!done)
        add(quizBox, 
          h("button", {
            class: "btn gold",
            disabled: ans.includes(-1),
            onclick: () => {
              const ok = quiz.filter((q, i) => ans[i] === q.correct).length;
              const quality = ok / quiz.length;
              addCards(topic);
              const r = recordActivity({
                kind: "estudio",
                id: `unidad:${topic}`,
                topic,
                quality,
                label: `Unidad: ${t.name}`,
                errors: quiz.filter((q, i) => ans[i] !== q.correct).map((q) => ({ topic, description: `Comprensión: ${q.q}`, prompt: q.q, answer: q.options[q.correct] })),
              });
              render(true);
              add(quizBox, h("p", { class: `notice ${quality >= 0.6 ? "ok" : "bad"}` }, `${ok}/${quiz.length} correctas · +${r.xp} XP. Las tarjetas de esta unidad se agregaron al entrenador de memoria.`));
            },
          }, "Comprobar"),
        );
    };
    render(false);
  });
}

function addCards(topic: string) {
  store.update("cards", (s) => {
    for (const c of contentCardsFor(topic)) s.cards = upsertCard(s.cards, c);
  });
}

registerScreen("study", openStudy);
