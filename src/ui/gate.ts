/** Puertas de aprendizaje: un desafío sólo se abre después de estudiar su teoría. */
import { chapter } from "../content/chapters.ts";
import { store } from "../core/state.ts";
import { REQUIREMENTS, missingChapters } from "../modules/reels/progress.ts";
import { add, h, openPanel } from "./dom.ts";
import { go } from "./nav.ts";

export function guard(key: keyof typeof REQUIREMENTS | string, run: () => void) {
  const missing = missingChapters(store.state, key);
  if (!missing.length) return run();
  const req = REQUIREMENTS[key];
  openPanel({ title: "🔒 Primero, la teoría", subtitle: `Para ${req.label} necesitás estos capítulos` }, (body) => {
    add(
      body,
      h("p", null, "En LEGAL LIFE primero aprendés y después aplicás. Mirá estos capítulos en el Aula de reels de la Facultad: son cortos, animados y con preguntas rápidas."),
      h(
        "div",
        { class: "stack" },
        missing.map((id) => {
          const c = chapter(id);
          return h("button", { class: "chapter-card next", style: `--c:${c.color}`, onclick: () => go("reels", id) }, h("span", { class: "chapter-n" }, `Capítulo ${c.number}`), h("b", null, c.title), h("small", null, c.subtitle), h("span", { class: "tag warn" }, "▶ ver ahora"));
        }),
      ),
    );
  });
}
