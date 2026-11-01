/** MI PLAN: fecha de examen, cuenta regresiva, plan diario y racha. */
import { store } from "../../core/state.ts";
import { currentStreak } from "../../systems/gamification.ts";
import { buildPlan, daysUntil, isoDay, type PlanTask } from "../../systems/plan.ts";
import { add, clear, h, openPanel, toast } from "../dom.ts";
import { guard } from "../gate.ts";
import { icon } from "../icons.ts";
import { go, registerScreen } from "../nav.ts";

export function runTask(t: PlanTask) {
  if (t.kind === "chapter") go("reels", t.id);
  else if (t.kind === "sim") guard(`sim:${t.id}`, () => go("simulations"));
  else if (t.kind === "oral") go("exams", "profesor");
  else if (t.kind === "escrito") go("exams");
  else go("memory");
}

const fmt = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
};

export function openPlan() {
  openPanel({ title: "Mi plan de estudio", subtitle: "Racha diaria y cuenta regresiva al examen" }, (body) => {
    const render = () => {
      clear(body);
      const s = store.state;
      const streak = currentStreak(s);
      const date = h("input", { type: "date", id: "exam-date", value: s.exam?.date ?? "", min: isoDay(Date.now()) });
      const label = h("input", { type: "text", id: "exam-label", placeholder: "Ej.: Parcial de Tributario", value: s.exam?.label ?? "" });
      add(
        body,
        h(
          "div",
          { class: "streak-card" },
          h("div", { class: `flame ${streak ? "on" : ""}`, "aria-hidden": "true" }, "🔥"),
          h("div", null, h("b", null, streak ? `${streak} día${streak > 1 ? "s" : ""} seguidos` : "Sin racha activa"), h("small", null, streak ? `Tu mejor racha: ${s.streak.best} días. Aprobá algo hoy para mantenerla.` : "Aprobá un capítulo, caso, examen o repaso para empezar una racha.")),
        ),
        h("h3", null, "Fecha de examen"),
        h("div", { class: "grid c2" }, h("label", { class: "field" }, "¿Qué rendís?", label), h("label", { class: "field" }, "¿Cuándo?", date)),
        h(
          "div",
          { class: "row", style: "margin-top:10px" },
          h("button", {
            class: "btn gold",
            onclick: () => {
              if (!date.value) return toast("Elegí una fecha.", "warn");
              store.update("exam", (st) => (st.exam = { date: date.value, label: label.value.trim() || "Examen" }));
              render();
            },
          }, icon("target", 18), "Guardar y armar mi plan"),
          s.exam ? h("button", { class: "btn ghost", onclick: () => (store.update("exam", (st) => (st.exam = null)), render()) }, "Quitar fecha") : null,
        ),
      );
      if (!s.exam) {
        add(body, h("p", { class: "muted" }, "Cargá la fecha de tu parcial o final y el juego reparte lo que te falta en los días que quedan, dejando el día anterior para el simulacro y el repaso."));
        return;
      }
      const left = daysUntil(s.exam.date);
      if (left < 0) {
        add(body, h("p", { class: "notice" }, "La fecha ya pasó. Cargá la próxima."));
        return;
      }
      const plan = buildPlan(s);
      add(
        body,
        h("div", { class: "countdown" }, h("span", { class: "cd-n" }, String(left)), h("span", null, left === 0 ? `¡Hoy rendís ${s.exam.label}!` : `día${left === 1 ? "" : "s"} para ${s.exam.label}`)),
        h(
          "ol",
          { class: "plan-days" },
          plan.map((d, k) =>
            h(
              "li",
              { class: `plan-day ${k === 0 ? "today" : ""} ${d.isExam ? "exam" : ""}` },
              h("div", { class: "pd-date" }, k === 0 ? "Hoy" : fmt(d.date)),
              d.isExam
                ? h("div", { class: "pd-tasks" }, h("b", null, `🎓 ${s.exam!.label}. ¡Éxitos!`))
                : h("div", { class: "pd-tasks" }, d.tasks.map((t) => (k === 0 ? h("button", { class: "pd-task", onclick: () => runTask(t) }, t.label, icon("arrow", 16)) : h("span", { class: "pd-task static" }, t.label)))),
            ),
          ),
        ),
      );
    };
    render();
  });
}

registerScreen("plan", openPlan);
