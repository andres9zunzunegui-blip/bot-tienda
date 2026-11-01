/** HUD del mundo, portada y modo simple. */
import { CHAPTERS } from "../content/chapters.ts";
import { aiLabel, aiMode } from "../core/ai.ts";
import { store } from "../core/state.ts";
import type { BuildingSpec } from "../engine/buildings.ts";
import { BUILDINGS } from "../engine/buildings.ts";
import { chapterDone, nextStep } from "../modules/reels/progress.ts";
import { currentStreak, levelFromXp, rankFor, xpForLevel } from "../systems/gamification.ts";
import { daysUntil } from "../systems/plan.ts";
import { add, bar, clear, h, openPanel } from "./dom.ts";
import { guard } from "./gate.ts";
import { icon } from "./icons.ts";
import { openInterior } from "./interiors.ts";
import { go } from "./nav.ts";
import { FILETE_BAND, FILETE_CORNER, stampSvg } from "./ornaments.ts";
import { musicWidget, openSettings } from "./prefs.ts";

export function runStep(a: ReturnType<typeof nextStep>["action"]) {
  if (a.type === "chapter") go("reels", a.id);
  else if (a.type === "sim") guard(`sim:${a.id}`, () => go("simulations"));
  else if (a.type === "oral") go("exams", "profesor");
  else if (a.type === "memory") go("memory");
  else go("maps", "evaluar");
}

function xpRatio() {
  const s = store.state;
  const lv = levelFromXp(s.xp);
  return (s.xp - xpForLevel(lv)) / (xpForLevel(lv + 1) - xpForLevel(lv));
}

/* ------------------------------ HUD ------------------------------ */

export function renderHud(root: HTMLElement, onMenu: () => void) {
  const top = h("div", { class: "hud-top" });
  const missions = h("div", { class: "hud-card hud-missions" });
  const prompt = h("div");
  const navBtn = (ic: string, label: string, fn: () => void) => h("button", { class: "hud-btn", onclick: fn, "aria-label": label }, icon(ic, 20), h("span", null, label));
  const actions = h(
    "nav",
    { class: "hud-actions", "aria-label": "Acciones" },
    navBtn("menu", "Menú", onMenu),
    navBtn("reels", "Aprender", () => go("learn")),
    navBtn("brain", "Repasar", () => go("memory")),
    navBtn("target", "Misiones", () => go("missions")),
    navBtn("settings", "Ajustes", () => openSettings()),
  );
  add(root, top, missions, prompt, actions, h("div", { class: "hud-music" }, musicWidget()));

  const update = () => {
    const s = store.state;
    const lv = levelFromXp(s.xp);
    const due = s.cards.filter((c) => c.due <= Date.now()).length;
    clear(top);
    add(
      top,
      h(
        "button",
        { class: "hud-card hud-player", onclick: () => go("progress"), "aria-label": "Ver progreso" },
        h("div", { class: "lvl" }, String(lv)),
        h("div", { style: "flex:1;min-width:0;text-align:left" }, h("div", null, h("b", null, s.avatar.name), h("span", { class: "muted" }, ` · ${rankFor(lv)}`)), bar(xpRatio())),
      ),
      h(
        "div",
        { class: "hud-res" },
        h("button", { class: "hud-card", title: "Racha diaria", onclick: () => go("plan") }, "🔥 ", String(currentStreak(s))),
        h("div", { class: "hud-card", title: "Estampillas fiscales (se ganan aprobando)" }, "🪙 ", String(s.coins)),
        h("button", { class: "hud-card", title: "Tarjetas para repasar", onclick: () => go("memory") }, "🧠 ", String(due)),
      ),
    );
    clear(missions);
    const step = nextStep(s);
    add(
      missions,
      h("button", { class: "next-step", onclick: () => runStep(step.action) }, h("small", null, "SIGUIENTE PASO"), h("span", null, step.text), icon("arrow", 18)),
      h(
        "button",
        { class: "mini-missions", onclick: () => go("missions") },
        h("small", null, "MISIONES DE HOY"),
        s.missions.list.map((m) => h("div", { class: `m ${m.done ? "done" : ""}` }, m.done ? (m.claimed ? "✔ " : "🎁 ") : "○ ", m.title, h("span", { class: "muted" }, ` ${Math.min(m.progress, m.target)}/${m.target}`))),
      ),
    );
  };
  store.subscribe(update);
  update();

  return {
    setNear(spec: BuildingSpec | null, unlocked: boolean, enter: () => void) {
      clear(prompt);
      if (!spec) return;
      add(prompt, h("button", { class: "prompt", onclick: enter }, h("kbd", null, "E"), unlocked ? `Entrar a ${spec.name}` : `${spec.name} (en construcción)`));
    },
  };
}

/* ------------------------------ Portada ------------------------------ */

const SECTIONS: { ic: string; title: string; hint: string; color: string; go: () => void; badge?: (s: typeof store.state) => string | undefined }[] = [
  { ic: "reels", title: "Aprender", hint: "Teoría en reels", color: "#b3282d", go: () => go("learn"), badge: (s) => `${CHAPTERS.filter((c) => chapterDone(s, c.id)).length}/${CHAPTERS.length}` },
  { ic: "scale", title: "Casos", hint: "Defendé clientes", color: "#1f5fa8", go: () => go("simulations") },
  { ic: "cap", title: "Exámenes", hint: "Oral y escrito", color: "#2f8f6b", go: () => go("exams") },
  { ic: "brain", title: "Repasar", hint: "Memoria espaciada", color: "#7a3fa0", go: () => go("memory"), badge: (s) => { const n = s.cards.filter((c) => c.due <= Date.now()).length; return n ? String(n) : undefined; } },
  { ic: "target", title: "Mi plan", hint: "Racha y examen", color: "#d9782b", go: () => go("plan"), badge: (s) => (currentStreak(s) ? `🔥${currentStreak(s)}` : undefined) },
  { ic: "network", title: "Redes", hint: "Mapas conceptuales", color: "#2a8a9a", go: () => go("maps") },
  { ic: "chart", title: "Progreso", hint: "Tu rendimiento", color: "#5a6b7d", go: () => go("progress") },
  { ic: "book", title: "Normas", hint: "Fuentes y vigencia", color: "#8a6d2e", go: () => go("library") },
  { ic: "bag", title: "Inventario", hint: "Premios y tienda", color: "#a0522d", go: () => go("inventory") },
  { ic: "user", title: "Personaje", hint: "Tu avatar", color: "#3a4a8a", go: () => go("character") },
];

export function renderMenu(root: HTMLElement, onPlay: () => void) {
  const caratula = h("article", { class: "caratula", "aria-label": "Tu expediente de estudiante" });
  const cta = h("div", { class: "home-cta" });
  const tabs = h("nav", { class: "biblio", "aria-label": "Secciones" });
  const status = h("div", { class: "home-status" });
  const corners = ["tl", "tr", "bl", "br"].map((c) => h("span", { class: `filete-corner ${c}`, html: FILETE_CORNER }));
  const screen = h(
    "div",
    { class: "menu-screen" },
    h(
      "div",
      { class: "home" },
      h(
        "section",
        { class: "home-hero" },
        h(
          "div",
          { class: "cartel" },
          corners,
          h("p", { class: "cartel-kicker" }, "Escuela de Derecho · Buenos Aires"),
          h("h1", { class: "logo" }, h("span", { class: "l1" }, "Legal"), h("span", { class: "l2" }, "Life")),
          h("div", { class: "cartel-band", html: FILETE_BAND }),
          h("p", { class: "cartel-sub" }, "El videojuego para aprender Derecho argentino"),
        ),
        caratula,
        cta,
      ),
      h("section", { class: "home-side" }, h("h2", { class: "side-title" }, "Bibliorato"), tabs),
    ),
    h("footer", { class: "home-foot" }, musicWidget(), h("button", { class: "btn ghost small", onclick: () => openSettings() }, icon("eye", 18), "Accesibilidad"), status),
  );
  add(root, screen);

  const update = () => {
    const s = store.state;
    const lv = levelFromXp(s.xp);
    const done = CHAPTERS.filter((c) => chapterDone(s, c.id)).length;
    const step = nextStep(s);
    const streak = currentStreak(s);
    const year = new Date().getFullYear();
    const legajo = String(Math.abs(hashName(s.avatar.name + s.createdAt)) % 9000 + 1000);
    const stamps = CHAPTERS.filter((c) => chapterDone(s, c.id)).slice(-3);
    clear(caratula);
    add(
      caratula,
      h("div", { class: "car-tab" }, `EXPTE. N° ${legajo}/${year}`),
      h("div", { class: "car-head" }, h("span", null, "FACULTAD DE DERECHO"), h("span", null, `FOJAS ${Math.floor(s.xp / 10)}`)),
      h("p", { class: "car-title" }, "«", h("b", null, s.avatar.name.toUpperCase()), " s/ APRENDIZAJE DEL DERECHO TRIBUTARIO»"),
      h(
        "dl",
        { class: "car-fields" },
        h("dt", null, "Categoría"), h("dd", null, `${rankFor(lv)} · Nivel ${lv}`),
        h("dt", null, "Teoría"), h("dd", null, `${done} de ${CHAPTERS.length} capítulos`),
        h("dt", null, "Racha"), h("dd", null, streak ? `🔥 ${streak} día${streak > 1 ? "s" : ""} seguidos` : "sin racha"),
        h("dt", null, "Examen"), h("dd", null, s.exam && daysUntil(s.exam.date) >= 0 ? h("button", { class: "link-btn", onclick: () => go("plan") }, `${s.exam.label}: ${daysUntil(s.exam.date) === 0 ? "¡hoy!" : `en ${daysUntil(s.exam.date)} días`}`) : h("button", { class: "link-btn", onclick: () => go("plan") }, "cargar fecha →")),
      ),
      h("div", { class: "car-xp" }, bar(xpRatio()), h("span", null, `${s.xp} XP`)),
      h("div", { class: "car-stamps", "aria-hidden": "true" }, stamps.map((c, k) => h("span", { class: "mini-stamp", style: `--r:${[-9, 6, -3][k]}deg`, html: stampSvg(`Cap. ${c.number}`, "Aprobado") }))),
      h("div", { class: "car-state" }, done === CHAPTERS.length ? "EN CONDICIONES DE RENDIR" : "EN TRÁMITE"),
    );
    clear(cta);
    add(
      cta,
      h("button", { class: "btn-hero", onclick: () => runStep(step.action) }, h("span", { class: "bh-ico" }, icon("play", 22)), h("span", { class: "bh-txt" }, h("b", null, s.log.length || done ? "Continuar" : "Empezar"), h("small", null, step.text)), icon("arrow", 22)),
      h("button", { class: "btn-secondary", onclick: onPlay }, icon("city", 20), s.prefs.simple ? "Recorrer la ciudad (modo simple)" : "Salir a la ciudad"),
    );
    clear(tabs);
    add(
      tabs,
      SECTIONS.map((sec, k) => {
        const badge = sec.badge?.(s);
        return h(
          "button",
          { class: "biblio-tab", style: `--c:${sec.color};--i:${k}`, onclick: sec.go },
          h("span", { class: "bt-ico" }, icon(sec.ic, 22)),
          h("span", { class: "bt-txt" }, h("b", null, sec.title), h("small", null, sec.hint)),
          badge ? h("span", { class: "tile-badge" }, badge) : null,
        );
      }),
    );
  };
  store.subscribe(update);
  update();

  aiMode().then((mode) => {
    add(status, h("span", { class: `pill ${mode ? "ok" : "warn"}` }, aiLabel(mode)), h("button", { class: "pill info", onclick: () => go("library") }, "Fuentes y vigencia"));
  });
  return {
    show() {
      screen.hidden = false;
    },
    hide() {
      screen.hidden = true;
    },
  };
}

function hashName(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/* ------------------------------ Modo simple ------------------------------ */

export function openSimpleCity() {
  openPanel({ title: "La ciudad", subtitle: "Elegí a dónde ir" }, (body) => {
    const s = store.state;
    const step = nextStep(s);
    add(
      body,
      h("button", { class: "btn-hero", onclick: () => runStep(step.action) }, h("span", { class: "bh-ico" }, icon("play", 22)), h("span", { class: "bh-txt" }, h("b", null, "Siguiente paso"), h("small", null, step.text)), icon("arrow", 22)),
      h(
        "div",
        { class: "places" },
        BUILDINGS.map((b) => {
          const open = s.unlocked.includes(b.id);
          return h("button", { class: `place ${open ? "" : "locked"}`, onclick: () => openInterior(b.id) }, h("span", { class: "place-ico" }, b.icon), h("b", null, b.name), h("small", null, open ? "Entrar" : "🔒 En construcción"));
        }),
      ),
    );
  });
}
