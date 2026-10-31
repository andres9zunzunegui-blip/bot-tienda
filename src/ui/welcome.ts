/** Bienvenida del primer ingreso: el juego explica que primero se aprende y después se aplica. */
import { CHAPTERS } from "../content/chapters.ts";
import { store } from "../core/state.ts";
import { add, closePanel, h, openPanel } from "./dom.ts";
import { go } from "./nav.ts";

export function showWelcome() {
  store.update("welcome", (s) => (s.welcomed = true));
  openPanel({ title: "Tu primer día en la ciudad", subtitle: `Hola, ${store.state.avatar.name}` }, (body) => {
    add(
      body,
      h(
        "div",
        { class: "interior", style: "background:linear-gradient(135deg,#3a2c1c,#6b5537)" },
        h("div", { class: "npc" }, "👨‍🏫"),
        h("div", { class: "speech" }, "Prof. Ibarra: «Acá no se aprueba de memoria ni de casualidad. Primero estudiás la teoría en el Aula de reels; después defendés clientes en Tribunales y rendís conmigo.»"),
      ),
      h(
        "ol",
        { class: "welcome-steps" },
        h("li", null, h("b", null, "Aprendé: "), `${CHAPTERS.length} capítulos en reels animados, con preguntas rápidas.`),
        h("li", null, h("b", null, "Aplicá: "), "el caso de clausura se habilita al terminar los capítulos 2 a 4."),
        h("li", null, h("b", null, "Rendí: "), "examen oral y audiencia con repreguntas."),
        h("li", null, h("b", null, "Consolidá: "), "tus errores vuelven como tarjetas de repaso."),
      ),
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => go("reels", "cap1") }, "▶ Empezar el Capítulo 1"), h("button", { class: "btn", onclick: () => closePanel() }, "Primero quiero recorrer la ciudad")),
    );
  });
}
