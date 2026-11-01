/** Interfaz del SIMULADOR DE PROCEDIMIENTOS JURÍDICOS. */
import { CLAUSURA } from "../../content/clausura.ts";
import { DETERMINACION } from "../../content/determinacion.ts";
import { aiMode, evaluateOral, AIUnavailable } from "../../core/ai.ts";
import { store } from "../../core/state.ts";
import { getRef, refLabel, refWarnings } from "../../legal/sources.ts";
import { SimulationRun, type Choice, type DecisionRecord, type Scenario, type Stage } from "../../modules/simulator/engine.ts";
import { recordActivity } from "../../systems/gamification.ts";
import { topicName } from "../../systems/topics.ts";
import { add, clear, h, openPanel, pct } from "../dom.ts";
import { go, registerScreen } from "../nav.ts";
import { guard } from "../gate.ts";
import { stamp } from "../fx.ts";

const PORTRAITS: Record<string, string> = {
  "Funcionarios fiscales de ARCA": "🕵️",
  "Expediente administrativo": "📂",
  ARCA: "🏦",
  "Estudio jurídico": "💼",
  "Juez administrativo de ARCA": "👨‍⚖️",
  "Funcionario superior de ARCA → Poder Judicial": "⚖️",
};

const PENDING_SCENARIOS = [
  { title: "Ejecución fiscal", subject: "Derecho Tributario" },
  { title: "Juicio ordinario: demanda y contestación", subject: "Derecho Procesal" },
  { title: "Reclamo por producto defectuoso", subject: "Derecho del Consumidor" },
  { title: "Acción de amparo", subject: "Derecho Constitucional" },
  { title: "Procedimiento administrativo y recursos", subject: "Derecho Administrativo" },
];

export function openSimulations() {
  openPanel({ title: "Simulaciones", subtitle: "Procedimientos jurídicos interactivos", wide: true }, (body) => {
    const runs = store.state.log.filter((l) => l.kind === "simulacion" && l.id === CLAUSURA.id);
    const runsDet = store.state.log.filter((l) => l.kind === "simulacion" && l.id === DETERMINACION.id);
    add(body, 
      h(
        "div",
        { class: "grid c2" },
        h(
          "div",
          { class: "card click", onclick: () => guard("sim:clausura", () => openSimulator(CLAUSURA)) },
          h("div", { class: "row between" }, h("h3", null, "⚖️ ", CLAUSURA.title), h("span", { class: "tag ok" }, "Disponible")),
          h("p", { class: "muted" }, CLAUSURA.summary),
          h("div", { class: "kv" }, h("b", null, "Tu rol"), h("span", null, CLAUSURA.role), h("b", null, "Jurisdicción"), h("span", null, CLAUSURA.jurisdiccion), h("b", null, "Etapas"), h("span", null, "10 fases, con ramificaciones")),
          runs.length ? h("p", null, `Mejor resultado: ${pct(Math.max(...runs.map((r) => r.quality)))} — ${runs.length} intento(s)`) : h("p", null, "Sin intentos todavía."),
          h("button", { class: "btn gold" }, "Jugar"),
        ),
        h(
          "div",
          { class: "card click", onclick: () => guard("sim:determinacion", () => openSimulator(DETERMINACION)) },
          h("div", { class: "row between" }, h("h3", null, "⚖️ ", DETERMINACION.title), h("span", { class: "tag ok" }, "Disponible")),
          h("p", { class: "muted" }, DETERMINACION.summary),
          h("div", { class: "kv" }, h("b", null, "Tu rol"), h("span", null, DETERMINACION.role), h("b", null, "Jurisdicción"), h("span", null, DETERMINACION.jurisdiccion), h("b", null, "Etapas"), h("span", null, "5 fases, con ramificaciones")),
          runsDet.length ? h("p", null, `Mejor resultado: ${pct(Math.max(...runsDet.map((r) => r.quality)))} — ${runsDet.length} intento(s)`) : h("p", null, "Sin intentos todavía."),
          h("button", { class: "btn gold" }, "Jugar"),
        ),
        h(
          "div",
          { class: "card" },
          h("h3", null, "Otros procedimientos"),
          h("p", { class: "notice" }, "Todavía NO implementados en esta versión. El motor de simulaciones ya admite nuevos escenarios; falta cargar su contenido jurídico verificado."),
          h("ul", null, PENDING_SCENARIOS.map((p) => h("li", null, `${p.title} `, h("span", { class: "tag" }, p.subject)))),
        ),
      ),
    );
  });
}

export function openSimulator(scenario: Scenario) {
  const run = new SimulationRun(scenario);
  let aiOn = false;
  aiMode().then((m) => (aiOn = m !== null));
  let pending: DecisionRecord | null = null; // decisión tomada en una etapa con argumento
  let revealed: { rec: DecisionRecord; stage: Stage } | null = null;
  let docOpen: string | null = null;

  openPanel({ title: scenario.title, subtitle: scenario.role, wide: true }, (body) => {
    const render = () => {
      clear(body);
      if (run.finished && !revealed) return renderEnd(body, run);
      const st = revealed?.stage ?? run.stage!;
      const phases = h("div", { class: "phases", title: `Fase ${st.phase} de 10` });
      for (let i = 1; i <= 10; i++) add(phases, h("span", { class: i < st.phase ? "done" : i === st.phase ? "now" : "" }));

      const main = h("div", { class: "stack" });
      add(main, 
        phases,
        h(
          "div",
          { class: "scene" },
          h("div", { class: "who" }, h("div", { class: "portrait" }, PORTRAITS[st.authority] ?? "🏛️"), h("div", null, h("div", { class: "muted" }, `Fase ${st.phase} · ${st.authority}`), h("h3", { style: "margin:0" }, st.title))),
          h("p", null, st.narrative(run.ctx)),
          st.deadline ? h("p", { class: "notice info" }, `⏱️ Plazo en juego: ${st.deadline}`) : null,
        ),
      );

      if (revealed) add(main, renderReveal(revealed.rec, revealed.stage, () => {
        revealed = null;
        render();
      }));
      else if (pending || st.kind === "argument") add(main, renderArgument(st));
      else add(main, renderChoices(st));

      const side = h("div", { class: "stack" });
      add(side, 
        h("div", { class: "card" }, h("h4", { style: "margin-top:0" }, "📁 Expediente"), run.docs.map((id) => h("button", { class: `btn small ${docOpen === id ? "gold" : ""}`, style: "margin:3px", onclick: () => ((docOpen = docOpen === id ? null : id), render()) }, scenario.docs[id].title))),
        docOpen ? h("div", { class: "doc", html: scenario.docs[docOpen].body(run.ctx) }) : null,
        h("div", { class: "card" }, h("h4", { style: "margin-top:0" }, "📚 Normas de esta etapa"), st.refs.map((r) => refCard(r))),
        h("div", { class: "card" }, h("div", { class: "row between" }, h("b", null, "Desempeño"), h("span", null, pct(run.score()))), h("p", { class: "muted" }, "La nota depende de la corrección jurídica de cada decisión, no del tiempo.")),
      );
      add(body, h("div", { class: "sim" }, main, side));
    };

    const renderChoices = (st: Stage) => {
      const wrap = h("div", { class: "card" }, h("h4", { style: "margin-top:0" }, st.prompt));
      const sel = new Set<string>();
      const btns: HTMLButtonElement[] = [];
      const confirm = h("button", { class: "btn gold", disabled: true, onclick: () => submit() }, st.kind === "multi" ? "Confirmar selección" : "Decidir");
      for (const c of st.choices!) {
        const b = h("button", {
          class: "choice",
          onclick: () => {
            if (st.kind === "single") {
              sel.clear();
              btns.forEach((x) => x.classList.remove("sel"));
            }
            if (sel.has(c.id)) sel.delete(c.id);
            else sel.add(c.id);
            b.classList.toggle("sel", sel.has(c.id));
            confirm.disabled = sel.size === 0;
          },
        }, st.kind === "multi" ? "☐ " : "", c.text);
        btns.push(b);
        add(wrap, b);
      }
      const submit = () => {
        const rec = run.decide([...sel]);
        if (st.argument) {
          pending = rec;
          revealed = { rec, stage: st };
        } else revealed = { rec, stage: st };
        render();
      };
      add(wrap, h("div", { class: "row" }, confirm, st.kind === "multi" ? h("span", { class: "muted" }, "Marcá todas las que correspondan.") : null));
      return wrap;
    };

    const renderArgument = (st: Stage) => {
      const arg = st.argument!;
      const ta = h("textarea", { placeholder: "Escribí tu argumento con fundamento normativo…" });
      const status = h("p", { class: "muted" }, aiOn ? "Evaluación con IA (jueza virtual)." : "Evaluación local aproximada (sin IA en esta vista).");
      const btn = h("button", {
        class: "btn gold",
        onclick: async () => {
          const text = ta.value.trim();
          if (text.length < 20) {
            status.textContent = "Escribí un argumento de al menos un par de oraciones.";
            return;
          }
          btn.disabled = true;
          status.textContent = "Evaluando…";
          let external: { score: number; feedback: string } | undefined;
          if (aiOn) {
            try {
              const ev = await evaluateOral({
                role: "juez",
                rigor: store.state.settings.oralRigor,
                question: `${st.narrative(run.ctx)}\n${arg.prompt}`,
                keyPoints: arg.keyPoints.map((k) => k.label),
                legalBasis: st.refs.map((r) => `${refLabel(getRef(r))}: ${getRef(r).contenido}`),
                history: [],
                answer: text,
              });
              const c = ev.criterios;
              external = {
                score: (c.precision + c.fundamentacion + c.argumentacion + c.terminologia + c.relacion) / 50,
                feedback: [ev.devolucion, ...ev.errores.map((e) => `✗ ${e.error} → ${e.correccion}`), ...ev.advertenciasNormativas.map((a) => `⚠️ ${a}`)].join(" "),
              };
            } catch (e) {
              if (e instanceof AIUnavailable) aiOn = false;
              status.textContent = e instanceof AIUnavailable ? "La IA no está habilitada: se usa la evaluación local." : `${(e as Error).message} Se usa la evaluación local.`;
            }
          }
          const rec = run.argue(text, external, pending ?? undefined);
          pending = null;
          revealed = { rec, stage: st };
          render();
        },
      }, "Presentar");
      return h("div", { class: "card" }, h("h4", { style: "margin-top:0" }, arg.prompt), ta, h("div", { class: "row" }, btn), status);
    };

    const renderReveal = (rec: DecisionRecord, st: Stage, onNext: () => void) => {
      const wrap = h("div", { class: "card stack" });
      if (st.choices && rec.chosen.length) {
        for (const c of st.choices) {
          const chosen = rec.chosen.includes(c.id);
          const good = st.kind === "single" ? c.quality === 1 : c.correct;
          let cls = "choice";
          if (chosen && good) cls += " good";
          else if (chosen && !good) cls += " bad";
          else if (!chosen && good) cls += st.kind === "multi" ? " missed" : " good";
          add(wrap, h("button", { class: cls, disabled: true }, chosen ? "➤ " : "", c.text));
        }
      }
      const q = rec.quality;
      add(wrap, h("p", { class: `notice ${q >= 0.9 ? "ok" : q >= 0.5 ? "" : "bad"}` }, q >= 0.9 ? "✔ Decisión jurídicamente correcta." : q >= 0.5 ? "△ Decisión parcialmente correcta." : "✗ Decisión incorrecta.", ` Calidad: ${pct(q)}`));
      for (const m of rec.mistakes) add(wrap, explain(m.choice, m.kind));
      if (rec.argument !== undefined)
        add(wrap, 
          h("div", { class: "card" }, h("h4", { style: "margin-top:0" }, `Tu argumento — ${pct(rec.argumentScore ?? 0)} `, h("span", { class: "tag" }, rec.argumentSource === "ia" ? "evaluado con IA" : "evaluación local aproximada")), h("p", { class: "muted" }, rec.argument), h("p", null, rec.argumentFeedback ?? "")),
        );
      if (pending && rec === pending) {
        add(wrap, h("button", { class: "btn gold", onclick: () => ((revealed = null), render()) }, "Ahora, fundamentá por escrito →"));
      } else add(wrap, h("button", { class: "btn gold", onclick: onNext }, run.finished ? "Ver resolución final" : "Continuar →"));
      return wrap;
    };

    render();
  });
}

function explain(c: Choice, kind: "elegida-incorrecta" | "omitida") {
  const refs = (c.refs ?? []).map((r) => refLabel(getRef(r))).join("; ") || "—";
  return h(
    "div",
    { class: "fb5" },
    h("div", null, h("b", null, kind === "omitida" ? "Omitiste: " : "Qué decidiste: "), c.text),
    h("div", null, h("b", null, kind === "omitida" ? "Por qué era relevante: " : "Por qué es incorrecto: "), c.feedback.porQue),
    h("div", null, h("b", null, "Norma aplicable: "), refs),
    h("div", null, h("b", null, "Consecuencia: "), c.feedback.consecuencia),
    h("div", null, h("b", null, "Alternativa correcta: "), c.feedback.alternativa),
  );
}

export function refCard(id: string) {
  const r = getRef(id);
  const w = refWarnings(r, store.state.settings);
  return h(
    "details",
    { class: "ref" },
    h("summary", null, h("b", null, r.articulo), ` — ${r.titulo} `, r.verificacion.estado === "discrepancia" ? h("span", { class: "tag bad" }, "discrepancia") : h("span", { class: "tag warn" }, "verificar")),
    h("p", null, r.contenido),
    h("p", { class: "muted" }, `${r.norma} · ${r.jurisdiccion} · Paráfrasis didáctica (no es texto literal)`),
    r.reformas.length ? h("p", { class: "muted" }, `Reformas: ${r.reformas.join("; ")}`) : null,
    w.map((x) => h("p", { class: "notice" }, x)),
    h("a", { href: r.fuenteOficial.url, target: "_blank", rel: "noopener" }, `Fuente oficial: ${r.fuenteOficial.nombre} ↗`),
  );
}

const recorded = new WeakMap<SimulationRun, { xp: number; coins: number }>();

function renderEnd(body: HTMLElement, run: SimulationRun) {
  const end = run.ending();
  const score = run.finalQuality();
  const rawScore = run.score();
  const s = run.scenario;
  const mistakes = run.decisions.flatMap((d) => d.mistakes.map((m) => ({ ...m, stage: s.stages[d.stageId] })));
  const reward = recorded.get(run) ?? recordActivity({
    kind: "simulacion",
    id: s.id,
    topic: s.topic ?? "trib.clausura",
    quality: score,
    label: `Simulación: ${s.title}`,
    topicQualities: run.topicQualities(),
    errors: mistakes.map((m) => ({
      topic: m.stage.topic,
      description: `${m.stage.title}: ${m.kind === "omitida" ? "omitió" : "eligió"} "${m.choice.text.slice(0, 90)}"`,
      prompt: `Caso clausura — ${m.stage.prompt}${m.kind === "omitida" ? ` (¿qué circunstancia omitiste?)` : ""}`,
      answer: m.choice.feedback.alternativa || m.choice.text,
      ref: m.choice.refs?.[0],
    })),
    badges: ["primera-defensa", ...(score >= 0.9 ? ["defensa-impecable"] : [])],
  });
  if (!recorded.has(run)) stamp(end.tone === "ok" ? "Resolución" : end.tone === "parcial" ? "Resolución" : "Sentencia", end.tone === "ok" ? "Favorable" : end.tone === "parcial" ? "Parcial" : "Firme", end.title, end.tone === "ok" ? "#2f8f6b" : end.tone === "parcial" ? "#1f5fa8" : "#b3282d");
  recorded.set(run, reward);
  const tone = end.tone === "ok" ? "ok" : end.tone === "parcial" ? "" : "bad";
  add(body, 
    h(
      "div",
      { class: "stack" },
      h("div", { class: "scene" }, h("div", { class: "who" }, h("div", { class: "portrait" }, end.tone === "ok" ? "🏆" : end.tone === "parcial" ? "📜" : "⛔"), h("div", null, h("div", { class: "muted" }, "Fase 10 · Resolución final"), h("h3", { style: "margin:0" }, end.title)))),
      h("div", { class: "doc" }, h("p", null, h("b", null, "RESOLUCIÓN. "), end.resolucion), h("p", null, h("b", null, "FUNDAMENTOS:")), h("ul", null, end.fundamentos.map((f) => h("li", null, f))), h("p", { class: "muted" }, end.nota)),
      h("div", { class: `notice ${tone}` }, `Nota final del caso: ${pct(score)}${score < rawScore ? ` (tus decisiones promediaron ${pct(rawScore)}, pero el desenlace limita la nota)` : ""} — Recompensa: +${reward.xp} XP, +${reward.coins} 🪙`),
      h("div", { class: "card" }, h("h3", null, "Análisis por tema"), Object.entries(run.topicQualities()).map(([t, q]) => h("div", { class: "row between" }, h("span", null, topicName(t)), h("span", null, pct(q))))),
      mistakes.length
        ? h("div", { class: "card stack" }, h("h3", null, `Revisión de errores (${mistakes.length})`), h("p", { class: "muted" }, "Cada error se agregó al Entrenador de memoria para repasarlo con repetición espaciada."), mistakes.map((m) => h("div", null, h("h4", null, `${m.stage.title}`), explain(m.choice, m.kind))))
        : h("p", { class: "notice ok" }, "Sin errores. ¡Defensa impecable!"),
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => openSimulator(s) }, "Volver a jugar"), h("button", { class: "btn", onclick: () => go("memory") }, "Repasar errores"), h("button", { class: "btn", onclick: () => go("exams", "juez") }, "Audiencia oral con la jueza")),
    ),
  );
}

registerScreen("simulations", openSimulations);
