/** ENTRENADOR DE MEMORIA: recuperación activa por escrito + repetición espaciada (SM-2). */
import { store, type MemoryCard } from "../../core/state.ts";
import { dueCards, retention, review, upsertCard } from "../../systems/memory.ts";
import { recordActivity, weakestTopics } from "../../systems/gamification.ts";
import { contentCardsFor } from "../../systems/seed.ts";
import { TOPICS, topicName } from "../../systems/topics.ts";
import { add, clear, h, openPanel, pct } from "../dom.ts";
import { go, registerScreen } from "../nav.ts";

const DAY = 86_400_000;

export function openMemory() {
  openPanel({ title: "Entrenador de memoria", subtitle: "Recuperación activa y repetición espaciada", wide: true }, (body) => {
    const s = store.state;
    const due = dueCards(s.cards);
    const weak = weakestTopics(s, 3);
    const avgRet = s.cards.filter((c) => c.lastReview !== undefined).map((c) => retention(c));
    add(body, 
      h(
        "div",
        { class: "grid c3" },
        h("div", { class: "card" }, h("h3", null, `${due.length}`), h("p", { class: "muted" }, "tarjetas vencidas hoy")),
        h("div", { class: "card" }, h("h3", null, `${s.cards.length}`), h("p", { class: "muted" }, `en total · ${s.cards.filter((c) => c.source === "error").length} originadas en errores`)),
        h("div", { class: "card" }, h("h3", null, avgRet.length ? pct(avgRet.reduce((a, b) => a + b, 0) / avgRet.length) : "—"), h("p", { class: "muted" }, "retención estimada (curva de olvido)")),
      ),
      weak.length ? h("p", { class: "notice info" }, `Misión sugerida: reforzar ${weak.map((w) => topicName(w, s.materials)).join(", ")}.`) : null,
      h(
        "div",
        { class: "row", style: "margin:12px 0" },
        h("button", { class: "btn gold", disabled: !due.length, onclick: () => session(due.slice(0, 15)) }, due.length ? `Repasar ${Math.min(15, due.length)} tarjetas` : "No hay tarjetas vencidas"),
        h("button", {
          class: "btn",
          onclick: () => {
            store.update("cards", (st) => {
              for (const t of Object.keys(TOPICS)) for (const c of contentCardsFor(t)) st.cards = upsertCard(st.cards, c);
            });
            openMemory();
          },
        }, "Agregar todas las tarjetas del contenido incluido"),
      ),
      s.cards.length === 0 ? h("p", { class: "muted" }, "Las tarjetas se crean al estudiar unidades, al cargar material y, sobre todo, a partir de tus errores en simulaciones, redes y exámenes.") : null,
      h(
        "table",
        { class: "t" },
        h("tr", null, h("th", null, "Tarjeta"), h("th", null, "Tema"), h("th", null, "Origen"), h("th", null, "Próximo repaso"), h("th", null, "Olvidos")),
        [...s.cards]
          .sort((a, b) => a.due - b.due)
          .slice(0, 60)
          .map((c) =>
            h(
              "tr",
              null,
              h("td", null, c.prompt.slice(0, 90)),
              h("td", null, topicName(c.topic, s.materials)),
              h("td", null, h("span", { class: `tag ${c.source === "error" ? "bad" : c.source === "material" ? "info" : ""}` }, c.source)),
              h("td", null, c.due <= Date.now() ? "hoy" : `en ${Math.ceil((c.due - Date.now()) / DAY)} día(s)`),
              h("td", null, String(c.lapses)),
            ),
          ),
      ),
    );
  });
}

function session(cards: MemoryCard[]) {
  let i = 0;
  let ok = 0;
  openPanel({ title: "Repaso", back: openMemory }, (body) => {
    const render = () => {
      clear(body);
      if (i >= cards.length) {
        add(body, h("h3", null, `Sesión terminada: ${ok}/${cards.length} recordadas`), h("button", { class: "btn gold", onclick: openMemory }, "Volver"), h("button", { class: "btn", onclick: () => go("missions") }, "Ver misiones"));
        return;
      }
      const c = cards[i];
      const ta = h("textarea", { placeholder: "Escribí lo que recordás ANTES de ver la respuesta (recuperación activa)…" });
      const reveal = h("button", { class: "btn gold", onclick: () => show() }, "Mostrar respuesta");
      const box = h("div");
      add(body, 
        h("p", { class: "muted" }, `Tarjeta ${i + 1} de ${cards.length} · ${topicName(c.topic, store.state.materials)}`),
        h("div", { class: "scene" }, h("h3", { style: "margin:0" }, c.prompt)),
        ta,
        reveal,
        box,
      );
      const show = () => {
        if (ta.value.trim().length < 3) {
          ta.placeholder = "Intentá recordar algo antes de mirar: la recuperación activa es lo que fija el conocimiento.";
          ta.focus();
          return;
        }
        reveal.remove();
        ta.disabled = true;
        add(box, 
          h("div", { class: "card" }, h("h4", { style: "margin-top:0" }, "Respuesta esperada"), h("p", null, c.answer)),
          h("p", { class: "muted" }, "Compará con tu respuesta y calificá con honestidad: el algoritmo programa el próximo repaso según tu recuerdo."),
          h("div", { class: "row" }, [
            [1, "No la recordé"],
            [3, "Con dificultad"],
            [4, "Bien"],
            [5, "Perfecta"],
          ].map(([g, l]) => h("button", { class: `btn ${g === 1 ? "" : g === 5 ? "gold" : ""}`, onclick: () => grade(g as number) }, l))),
        );
      };
      const grade = (g: number) => {
        const before = c.interval;
        const updated = review(c, g);
        store.update("review", (s) => {
          const k = s.cards.findIndex((x) => x.id === c.id);
          if (k >= 0) s.cards[k] = updated;
        });
        if (g >= 3) ok++;
        const longGap = before >= 6 && g >= 4;
        recordActivity({
          kind: "repaso",
          id: `card:${c.id}`,
          topic: c.topic,
          quality: g / 5,
          label: "Repaso espaciado",
          bonusXp: longGap ? 20 : 0,
          badges: [
            ...(longGap ? ["retencion"] : []),
            ...(store.state.log.filter((l) => l.kind === "repaso" && l.quality >= 0.6).length + (g >= 3 ? 1 : 0) >= 10 ? ["memoria-10"] : []),
          ],
        });
        i++;
        render();
      };
    };
    render();
  });
}

registerScreen("memory", openMemory);
