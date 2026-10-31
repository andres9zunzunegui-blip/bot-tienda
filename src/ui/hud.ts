/** HUD del mundo y menú principal. */
import { store } from "../core/state.ts";
import { getHealth } from "../core/api.ts";
import type { BuildingSpec } from "../engine/buildings.ts";
import { levelFromXp, rankFor, xpForLevel } from "../systems/gamification.ts";
import { add, bar, clear, h } from "./dom.ts";
import { go } from "./nav.ts";
import { nextStep } from "../modules/reels/progress.ts";
import { guard } from "./gate.ts";

export function renderHud(root: HTMLElement, onMenu: () => void) {
  const top = h("div", { class: "hud-top" });
  const missions = h("div", { class: "hud-card hud-missions", onclick: () => go("missions"), style: "cursor:pointer" });
  const prompt = h("div");
  const actions = h(
    "div",
    { class: "hud-actions" },
    [
      ["☰ Menú", onMenu],
      ["📖 Estudiar", () => go("study")],
      ["🧠 Repasar", () => go("memory")],
      ["🎯 Misiones", () => go("missions")],
      ["📊 Progreso", () => go("progress")],
      ["🎒 Inventario", () => go("inventory")],
      ["👤 Personaje", () => go("character")],
    ].map(([t, fn]) => h("button", { class: "hud-btn", onclick: fn as () => void }, t as string)),
  );
  add(root, top, missions, prompt, actions);

  const update = () => {
    const s = store.state;
    const lv = levelFromXp(s.xp);
    const due = s.cards.filter((c) => c.due <= Date.now()).length;
    clear(top);
    add(top, 
      h(
        "div",
        { class: "hud-card hud-player", onclick: () => go("progress"), style: "cursor:pointer" },
        h("div", { class: "lvl" }, String(lv)),
        h("div", { style: "flex:1;min-width:0" }, h("div", null, h("b", null, s.avatar.name), " · ", h("span", { class: "muted" }, rankFor(lv))), bar((s.xp - xpForLevel(lv)) / (xpForLevel(lv + 1) - xpForLevel(lv)))),
      ),
      h("div", { class: "hud-res" }, h("div", { class: "hud-card", title: "Monedas" }, "🪙 ", String(s.coins)), h("div", { class: "hud-card", title: "Tarjetas para repasar" }, "🧠 ", String(due)), h("div", { class: "hud-card", title: "Insignias" }, "🏅 ", String(s.badges.length))),
    );
    clear(missions);
    const step = nextStep(s);
    add(missions, h("div", { class: "next-step", onclick: (e: Event) => (e.stopPropagation(), runStep(step.action)) }, h("h4", null, "SIGUIENTE PASO"), h("div", null, "➜ ", step.text)));
    add(missions, 
      h("h4", null, "MISIONES DE HOY"),
      s.missions.list.map((m) => h("div", { class: `m ${m.done ? "done" : ""}` }, m.done ? (m.claimed ? "✔ " : "🎁 ") : "◻ ", m.title, h("span", { class: "muted" }, ` ${Math.min(m.progress, m.target)}/${m.target}`))),
    );
  };
  store.subscribe(update);
  update();

  return {
    setNear(spec: BuildingSpec | null, unlocked: boolean, enter: () => void) {
      clear(prompt);
      if (!spec) return;
      add(prompt, h("div", { class: "prompt", onclick: enter }, h("kbd", null, "E"), unlocked ? `Entrar a ${spec.name}` : `${spec.name} (en construcción)`));
    },
  };
}

export function renderMenu(root: HTMLElement, onPlay: () => void) {
  const btn = (ico: string, title: string, sub: string, fn: () => void, cls = "") => h("button", { class: `menu-btn ${cls}`, onclick: fn }, h("span", { class: "ico" }, ico), h("b", null, title), h("small", null, sub));
  const status = h("div", { class: "menu-foot" });
  const screen = h(
    "div",
    { class: "menu-screen" },
    h(
      "div",
      { class: "menu-inner" },
      h("h1", { class: "logo" }, "LEGAL LIFE"),
      h("p", { class: "tagline" }, "La ciudad universitaria donde el conocimiento jurídico construye tu camino"),
      h(
        "div",
        { class: "menu-grid" },
        btn("🏙️", "JUGAR", "Entrar a la ciudad", onPlay, "primary"),
        btn("🎬", "ESTUDIAR", "Capítulos en reels", () => go("learn")),
        btn("⚖️", "SIMULACIONES", "Procedimientos jurídicos", () => go("simulations")),
        btn("🕸️", "REDES CONCEPTUALES", "Mapas de conocimiento", () => go("maps")),
        btn("🎓", "EXÁMENES", "Orales y escritos", () => go("exams")),
        btn("📊", "PROGRESO", "Estadísticas académicas", () => go("progress")),
        btn("🎒", "INVENTARIO", "Recompensas", () => go("inventory")),
        btn("👤", "MI PERSONAJE", "Personalizar avatar", () => go("character")),
      ),
      status,
    ),
  );
  add(root, screen);
  getHealth().then((hh) => {
    add(status, 
      h("span", { class: `pill ${hh.ok ? "ok" : "bad"}` }, hh.ok ? "● Servidor conectado" : "● Servidor no disponible (modo sin conexión)"),
      h("span", { class: `pill ${hh.ai ? "ok" : "warn"}` }, hh.ai ? "● IA activa" : "● IA no configurada — evaluador local"),
      h("span", { class: "pill warn" }, "OCR de fotografías: no implementado"),
      h("span", { class: "pill info", style: "cursor:pointer", onclick: () => go("library") }, "⚖️ Fuentes y vigencia"),
    );
  });
  return {
    show() {
      screen.style.display = "";
    },
    hide() {
      screen.style.display = "none";
    },
  };
}

function runStep(a: ReturnType<typeof nextStep>["action"]) {
  if (a.type === "chapter") go("reels", a.id);
  else if (a.type === "sim") guard("sim:clausura", () => go("simulations"));
  else if (a.type === "oral") go("exams", "profesor");
  else if (a.type === "memory") go("memory");
  else go("maps", "evaluar");
}
