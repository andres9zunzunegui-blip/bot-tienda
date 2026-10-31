/** EXÁMENES: oral con profesor o audiencia con jueza (IA o evaluador local) y simulacro escrito. */
import { CLAUSURA } from "../../content/clausura.ts";
import { ORAL_BANK, notaFromQuality, type OralQuestion } from "../../content/oralBank.ts";
import { TRIBUTARIO_MAP } from "../../content/tributarioMap.ts";
import { aiOral, getHealth } from "../../core/api.ts";
import { store } from "../../core/state.ts";
import { evaluateLocal } from "../../modules/oral/localEvaluator.ts";
import { recordActivity } from "../../systems/gamification.ts";
import { TOPICS } from "../../systems/topics.ts";
import { add, bar, clear, h, openPanel, pct, toast } from "../dom.ts";
import { registerScreen } from "../nav.ts";
import { guard } from "../gate.ts";
import { TOPIC_CHAPTER, chapterLabel, topicUnlocked } from "../../modules/reels/progress.ts";

const CRIT_LABELS: Record<string, string> = {
  precision: "Precisión conceptual",
  fundamentacion: "Fundamentación normativa",
  argumentacion: "Argumentación",
  terminologia: "Terminología",
  relacion: "Relación de instituciones",
};

export function openExams(arg?: unknown) {
  openPanel({ title: "Exámenes", subtitle: "Orales con repreguntas y simulacros escritos", wide: true }, (body) => {
    const oral = store.state.log.filter((l) => l.kind === "oral");
    const written = store.state.log.filter((l) => l.kind === "escrito");
    add(body, 
      h(
        "div",
        { class: "grid c3" },
        h("div", { class: "card click", onclick: () => guard("oral:profesor", () => oralSetup("profesor")) }, h("h3", null, "🎓 Examen oral"), h("p", { class: "muted" }, "El Prof. Ibarra pregunta, evalúa y repregunta según tu respuesta."), h("p", null, `${oral.filter((o) => o.id.startsWith("oral:profesor")).length} rendidos`)),
        h("div", { class: "card click", onclick: () => guard("oral:juez", () => oralSetup("juez")) }, h("h3", null, "👩‍⚖️ Audiencia con la jueza"), h("p", { class: "muted" }, "La jueza Salvatierra te pide fundamentar como abogado/a del caso de clausura."), h("p", null, `${oral.filter((o) => o.id.startsWith("oral:juez")).length} audiencias`)),
        h("div", { class: "card click", onclick: () => guard("escrito", writtenExam) }, h("h3", null, "📝 Simulacro escrito"), h("p", { class: "muted" }, "10 preguntas de opción múltiple corregidas automáticamente. Aprobar da monedas."), h("p", null, `${written.length} rendidos`)),
      ),
    );
    if (arg === "juez") guard("oral:juez", () => oralSetup("juez"));
    else if (arg === "profesor") guard("oral:profesor", () => oralSetup("profesor"));
  });
}

function oralSetup(role: "profesor" | "juez") {
  openPanel({ title: role === "juez" ? "Audiencia con la jueza" : "Examen oral", back: () => openExams() }, async (body) => {
    const hh = await getHealth();
    const topics = [...new Set(ORAL_BANK.filter((q) => role === "profesor" || q.role === "juez" || q.topic.includes("clausura")).map((q) => q.topic))];
    const topicSel = h("select", null, h("option", { value: "" }, "Todos los temas que ya estudiaste"), topics.map((t) => h("option", { value: t, disabled: !topicUnlocked(store.state, t) }, `${TOPICS[t]?.name ?? t}${topicUnlocked(store.state, t) ? "" : ` (🔒 ${chapterLabel(TOPIC_CHAPTER[t])})`}`)));
    const rigor = h("select", null, h("option", { value: "normal", selected: store.state.settings.oralRigor === "normal" }, "Normal"), h("option", { value: "exigente", selected: store.state.settings.oralRigor === "exigente" }, "Exigente (más repreguntas, exige citas)"));
    const voice = h("input", { type: "checkbox", checked: "speechSynthesis" in window });
    add(body, 
      h(
        "div",
        { class: "stack" },
        h("p", { class: hh.ai ? "notice ok" : "notice" }, hh.ai ? "IA activa: el examinador comprende el sentido jurídico de tus respuestas y repregunta en consecuencia." : "IA no configurada en el servidor: se usa el evaluador LOCAL, que busca conceptos equivalentes (no palabras exactas) pero es aproximado."),
        h("label", { class: "field" }, "Tema", topicSel),
        h("label", { class: "field" }, "Modalidad", rigor),
        h("label", { class: "row" }, voice, "Leer las preguntas en voz alta"),
        h("button", {
          class: "btn gold",
          onclick: () => {
            store.update("settings", (s) => (s.settings.oralRigor = rigor.value as "normal" | "exigente"));
            const pool = ORAL_BANK.filter((q) => (topicSel.value ? q.topic === topicSel.value : topics.includes(q.topic) && topicUnlocked(store.state, q.topic)) && (role === "juez" ? q.role === "juez" || q.topic.includes("clausura") : true));
            const qs = shuffle(pool).slice(0, 3);
            if (!qs.length) return toast("Todavía no estudiaste ningún tema de este examen: pasá por el Aula de reels.", "warn");
            oralSession(role, rigor.value as "normal" | "exigente", qs, voice.checked, hh.ai);
          },
        }, "Comenzar"),
      ),
    );
  });
}

function shuffle<T>(a: T[]): T[] {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

interface QResult {
  q: OralQuestion;
  score: number;
  missed: string[];
}

function oralSession(role: "profesor" | "juez", rigor: "normal" | "exigente", questions: OralQuestion[], speak: boolean, ai: boolean) {
  const examiner = role === "juez" ? "Jueza Salvatierra" : "Prof. Ibarra";
  const maxFollow = rigor === "exigente" ? 2 : 1;
  const results: QResult[] = [];
  let qi = 0;
  let follow = 0;
  let answers: string[] = [];
  const history: { speaker: "examinador" | "alumno"; text: string }[] = [];

  openPanel({ title: role === "juez" ? "Audiencia oral" : "Examen oral", subtitle: `${examiner} · modo ${rigor}`, wide: true }, (body) => {
    const chat = h("div", { class: "chat" });
    const ta = h("textarea", { placeholder: "Tu respuesta…" });
    const send = h("button", { class: "btn gold", onclick: () => answer() }, "Responder");
    const status = h("span", { class: "muted" });
    const evalBox = h("div");
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const mic = SR
      ? h("button", {
          class: "btn",
          title: "Responder hablando",
          onclick: () => {
            const rec = new SR();
            rec.lang = "es-AR";
            rec.interimResults = false;
            rec.onresult = (e: any) => (ta.value += (ta.value ? " " : "") + e.results[0][0].transcript);
            rec.onerror = () => (status.textContent = "No se pudo usar el micrófono.");
            rec.start();
            status.textContent = "Escuchando…";
            rec.onend = () => (status.textContent = "");
          },
        }, "🎤 Hablar")
      : h("span", { class: "muted" }, "(Reconocimiento de voz no disponible en este navegador)");
    add(body, h("div", { class: "stack" }, h("div", { class: "card" }, chat), ta, h("div", { class: "row" }, send, mic, status), evalBox));

    const say = (who: "exam" | "me" | "sys", text: string) => {
      add(chat, h("div", { class: `msg ${who}` }, who === "exam" ? h("b", null, `${examiner}: `) : null, text));
      chat.scrollTop = chat.scrollHeight;
      if (who === "exam") {
        history.push({ speaker: "examinador", text });
        if (speak && "speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = "es-AR";
          speechSynthesis.cancel();
          speechSynthesis.speak(u);
        }
      }
    };

    const ask = () => {
      const q = questions[qi];
      follow = 0;
      answers = [];
      say("sys", `Pregunta ${qi + 1} de ${questions.length} — ${TOPICS[q.topic]?.name ?? q.topic}`);
      say("exam", q.question);
    };

    const answer = async () => {
      const text = ta.value.trim();
      if (text.length < 3) return;
      ta.value = "";
      say("me", text);
      history.push({ speaker: "alumno", text });
      answers.push(text);
      send.disabled = true;
      status.textContent = "El examinador está evaluando…";
      const q = questions[qi];
      const combined = answers.join(" ");
      let score = 0;
      let repregunta = "";
      let devolucion = "";
      let crit: Record<string, number> = {};
      let missed: string[] = [];
      let extra: HTMLElement[] = [];
      let usedAI = false;
      if (ai) {
        try {
          const ev = await aiOral({ role, rigor, question: q.question, keyPoints: q.keyPoints.map((k) => k.label), legalBasis: q.legalBasis, history: history.slice(0, -1), answer: text });
          crit = ev.criterios;
          score = Object.values(ev.criterios).reduce((a, b) => a + b, 0) / 50;
          repregunta = ev.repregunta;
          devolucion = ev.devolucion;
          missed = ev.conceptosOmitidos;
          extra = [
            ...ev.errores.map((e) => h("p", { class: "notice bad" }, `✗ ${e.error} → ${e.correccion}`)),
            ...ev.advertenciasNormativas.map((a) => h("p", { class: "notice" }, `⚠️ ${a}`)),
          ];
          usedAI = true;
        } catch (e) {
          say("sys", `La IA no respondió (${(e as Error).message}). Se usa el evaluador local.`);
        }
      }
      if (!usedAI) {
        const ev = evaluateLocal(combined, q.keyPoints);
        crit = ev.criterios;
        score = ev.score;
        repregunta = ev.repregunta;
        missed = ev.missed.map((m) => m.label);
        devolucion = ev.covered.length
          ? `Bien: ${ev.covered.map((c) => c.label.toLowerCase()).join("; ")}. ${ev.missed.length ? `Faltó: ${ev.missed.map((c) => c.label.toLowerCase()).join("; ")}.` : ""}`
          : "Su respuesta no desarrolla los conceptos centrales de la pregunta.";
        extra = ev.observaciones.map((o) => h("p", { class: "notice" }, o));
      }
      const penalized = score * (1 - 0.08 * follow);
      clear(evalBox);
      add(evalBox, 
        h(
          "div",
          { class: "card" },
          h("div", { class: "row between" }, h("h4", { style: "margin:0" }, `Evaluación ${usedAI ? "(IA)" : "(local aproximada)"}`), h("b", null, pct(penalized))),
          h("div", { class: "crit" }, Object.entries(crit).flatMap(([k, v]) => [h("span", null, CRIT_LABELS[k] ?? k), bar(v / 10), h("span", null, String(Math.round(v)))])),
          extra,
        ),
      );
      say("exam", devolucion);
      status.textContent = "";
      send.disabled = false;
      if (repregunta && follow < maxFollow && score < 0.9) {
        follow++;
        say("exam", repregunta);
        return;
      }
      results.push({ q, score: penalized, missed });
      qi++;
      if (qi < questions.length) ask();
      else finish();
    };

    const finish = () => {
      const q = results.reduce((a, r) => a + r.score, 0) / results.length;
      const nota = notaFromQuality(q);
      const passed = nota >= 4;
      const rew = recordActivity({
        kind: "oral",
        id: `oral:${role}:${rigor}`,
        topic: results[0].q.topic,
        quality: q,
        label: `Examen oral (${role === "juez" ? "audiencia" : "profesor"})`,
        topicQualities: Object.fromEntries(results.map((r) => [r.q.topic, r.score])),
        errors: results.filter((r) => r.score < 0.7).map((r) => ({ topic: r.q.topic, description: `Oral: "${r.q.question}" — faltó: ${r.missed.join("; ") || "desarrollo"}`, prompt: r.q.question, answer: r.q.modelAnswer })),
        badges: passed ? ["oral-aprobado", ...(rigor === "exigente" ? ["oral-exigente"] : [])] : [],
      });
      say("exam", passed ? `Muy bien. Su calificación es ${nota} (${notaTexto(nota)}).` : `Lamentablemente no alcanza: ${nota}. Le recomiendo repasar y volver a presentarse.`);
      clear(evalBox);
      add(evalBox, 
        h(
          "div",
          { class: "card stack" },
          h("h3", null, `Nota final: ${nota} — ${passed ? "APROBADO" : "DESAPROBADO"}`),
          h("p", null, `+${rew.xp} XP, +${rew.coins} 🪙`),
          results.map((r) => h("details", null, h("summary", null, `${pct(r.score)} — ${r.q.question}`), h("p", null, h("b", null, "Respuesta modelo: "), r.q.modelAnswer), h("p", { class: "muted" }, `Base normativa: ${r.q.legalBasis.join(" · ")}`))),
          h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => oralSetup(role) }, "Rendir otro"), h("button", { class: "btn", onclick: () => openExams() }, "Volver")),
        ),
      );
      ta.disabled = true;
      send.disabled = true;
    };
    say("sys", role === "juez" ? "Se abre la audiencia. Responda con fundamento normativo." : "Comienza el examen. Responda con precisión y cite normas cuando corresponda.");
    ask();
  });
}

function notaTexto(n: number) {
  return n >= 10 ? "sobresaliente" : n >= 8 ? "distinguido" : n >= 6 ? "bueno" : "aprobado";
}

interface MCQ {
  topic: string;
  q: string;
  options: string[];
  correct: number;
  explanation: string;
}

function buildWritten(): MCQ[] {
  const out: MCQ[] = [];
  const nodes = shuffle(TRIBUTARIO_MAP.nodes.filter((n) => n.id !== TRIBUTARIO_MAP.root));
  for (const n of nodes.slice(0, 6)) {
    const distract = shuffle(TRIBUTARIO_MAP.nodes.filter((x) => x.id !== n.id && x.id !== TRIBUTARIO_MAP.root)).slice(0, 3).map((x) => x.label);
    const options = shuffle([n.label, ...distract]);
    out.push({ topic: n.topic, q: `¿A qué concepto corresponde?: "${n.info.explicacion}"`, options, correct: options.indexOf(n.label), explanation: `Corresponde a "${n.label}".` });
  }
  const stages = shuffle(Object.values(CLAUSURA.stages).filter((s) => s.kind === "single" && s.choices));
  for (const st of stages.slice(0, 4)) {
    const opts = shuffle(st.choices!);
    const best = opts.findIndex((c) => c.quality === 1);
    out.push({ topic: st.topic, q: `Caso de clausura (${st.title}): ${st.prompt}`, options: opts.map((o) => o.text), correct: best, explanation: opts.filter((o) => o.quality < 1).map((o) => o.feedback.porQue).filter(Boolean)[0] ?? "" });
  }
  return shuffle(out);
}

function writtenExam() {
  const qs = buildWritten();
  const ans: number[] = new Array(qs.length).fill(-1);
  openPanel({ title: "Simulacro escrito", subtitle: "Derecho Tributario — 10 preguntas", wide: true, back: () => openExams() }, (body) => {
    const render = (done: boolean) => {
      clear(body);
      qs.forEach((q, i) => {
        add(body, 
          h(
            "div",
            { class: "card", style: "margin-bottom:10px" },
            h("h4", { style: "margin-top:0" }, `${i + 1}. ${q.q}`),
            q.options.map((o, j) =>
              h("button", {
                class: `choice ${ans[i] === j ? "sel" : ""} ${done && j === q.correct ? "good" : ""} ${done && ans[i] === j && j !== q.correct ? "bad" : ""}`,
                disabled: done,
                onclick: () => ((ans[i] = j), render(false)),
              }, o),
            ),
            done && ans[i] !== q.correct && q.explanation ? h("p", { class: "notice" }, q.explanation) : null,
          ),
        );
      });
      if (!done)
        add(body, h("button", { class: "btn gold", disabled: ans.includes(-1), onclick: () => grade() }, ans.includes(-1) ? `Faltan ${ans.filter((a) => a === -1).length} respuestas` : "Entregar"));
    };
    const grade = () => {
      const ok = qs.filter((q, i) => ans[i] === q.correct).length;
      const quality = ok / qs.length;
      const r = recordActivity({
        kind: "escrito",
        id: "simulacro:tributario",
        topic: "trib.clausura",
        quality,
        label: "Simulacro escrito",
        topicQualities: qs.reduce<Record<string, number>>((acc, q, i) => ((acc[q.topic] = ans[i] === q.correct ? 1 : 0), acc), {}),
        errors: qs.filter((q, i) => ans[i] !== q.correct).map((q) => ({ topic: q.topic, description: `Simulacro: ${q.q.slice(0, 90)}`, prompt: q.q, answer: q.options[q.correct] })),
      });
      render(true);
      body.prepend(h("div", { class: `notice ${quality >= 0.6 ? "ok" : "bad"}`, style: "margin-bottom:12px" }, `Resultado: ${ok}/${qs.length} — nota ${notaFromQuality(quality)} ${quality >= 0.6 ? "(aprobado)" : "(desaprobado)"} · +${r.xp} XP, +${r.coins} 🪙`));
      body.scrollTop = 0;
    };
    render(false);
  });
}

registerScreen("exams", openExams);
