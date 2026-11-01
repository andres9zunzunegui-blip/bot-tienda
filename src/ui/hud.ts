/** HUD del mundo, portada y modo simple. */
import { CHAPTERS } from "../content/chapters.ts";
import { effectiveAvatar } from "../content/items.ts";
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
        h("div", { class: "hud-card", title: "Monedas" }, "🪙 ", String(s.coins)),
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

const EMBLEM = `<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="emb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7dc8c"/><stop offset="1" stop-color="#b8861f"/></linearGradient></defs>
<circle cx="60" cy="60" r="56" fill="none" stroke="url(#emb)" stroke-width="3"/><circle cx="60" cy="60" r="48" fill="none" stroke="url(#emb)" stroke-width="1" opacity=".5"/>
<path d="M30 46 60 30l30 16z" fill="url(#emb)"/><rect x="32" y="48" width="56" height="4" rx="1" fill="url(#emb)"/>
<g fill="url(#emb)"><rect x="36" y="55" width="6" height="28" rx="1"/><rect x="50" y="55" width="6" height="28" rx="1"/><rect x="64" y="55" width="6" height="28" rx="1"/><rect x="78" y="55" width="6" height="28" rx="1"/></g>
<rect x="30" y="85" width="60" height="5" rx="1" fill="url(#emb)"/><rect x="26" y="91" width="68" height="4" rx="1" fill="url(#emb)"/></svg>`;

export function renderMenu(root: HTMLElement, onPlay: () => void) {
  const card = h("div", { class: "student-card" });
  const cta = h("div", { class: "home-cta" });
  const tiles = h("div", { class: "home-tiles" });
  const status = h("div", { class: "home-status" });
  const screen = h(
    "div",
    { class: "menu-screen" },
    h(
      "div",
      { class: "home" },
      h(
        "section",
        { class: "home-hero" },
        h("div", { class: "emblem", html: EMBLEM }),
        h("p", { class: "eyebrow" }, "Videojuego universitario · Derecho argentino"),
        h("h1", { class: "logo" }, "LEGAL", h("span", null, "LIFE")),
        h("p", { class: "tagline" }, "Aprendé la teoría, defendé clientes, rendí ante el profesor. Tu ciudad crece con lo que sabés."),
        card,
        cta,
      ),
      h("section", { class: "home-side", "aria-label": "Secciones" }, h("h2", { class: "side-title" }, "Secciones"), tiles),
    ),
    h("footer", { class: "home-foot" }, musicWidget(), h("button", { class: "btn ghost small", onclick: () => openSettings() }, icon("eye", 18), "Accesibilidad"), status),
  );
  add(root, screen);

  const tile = (ic: string, title: string, hint: string, fn: () => void, badge?: string) =>
    h("button", { class: "tile", onclick: fn }, h("span", { class: "tile-ico" }, icon(ic, 24)), h("span", { class: "tile-txt" }, h("b", null, title), h("small", null, hint)), badge ? h("span", { class: "tile-badge" }, badge) : null);

  const update = () => {
    const s = store.state;
    const lv = levelFromXp(s.xp);
    const av = effectiveAvatar(s);
    const done = CHAPTERS.filter((c) => chapterDone(s, c.id)).length;
    const due = s.cards.filter((c) => c.due <= Date.now()).length;
    const step = nextStep(s);
    clear(card);
    add(
      card,
      h("div", { class: "avatar-dot", style: `background:${av.suit};--skin:${av.skin}` }, h("span", null, (s.avatar.name[0] ?? "E").toUpperCase())),
      h(
        "div",
        { class: "sc-main" },
        h("div", { class: "sc-name" }, h("b", null, s.avatar.name), h("span", null, rankFor(lv))),
        h("div", { class: "sc-bar" }, h("span", null, `Nivel ${lv}`), bar(xpRatio()), h("span", null, `${s.xp} XP`)),
        h("div", { class: "sc-stats" }, h("span", null, `🔥 ${currentStreak(s)} día${currentStreak(s) === 1 ? "" : "s"}`), h("span", null, `📚 Teoría ${done}/${CHAPTERS.length}`), h("span", null, `🪙 ${s.coins}`), h("span", null, `🏅 ${s.badges.length}`)),
        s.exam && daysUntil(s.exam.date) >= 0 ? h("button", { class: "sc-exam", onclick: () => go("plan") }, `🎓 ${s.exam.label}: ${daysUntil(s.exam.date) === 0 ? "¡es hoy!" : `faltan ${daysUntil(s.exam.date)} días`}`) : h("button", { class: "sc-exam muted-btn", onclick: () => go("plan") }, "＋ Cargar fecha de examen y armar plan"),
      ),
    );
    clear(cta);
    add(
      cta,
      h("button", { class: "btn-hero", onclick: () => runStep(step.action) }, h("span", { class: "bh-ico" }, icon("play", 22)), h("span", { class: "bh-txt" }, h("b", null, s.log.length || done ? "Continuar" : "Empezar"), h("small", null, step.text)), icon("arrow", 22)),
      h("button", { class: "btn-secondary", onclick: onPlay }, icon("city", 20), s.prefs.simple ? "Recorrer la ciudad (modo simple)" : "Explorar la ciudad 3D"),
    );
    clear(tiles);
    add(
      tiles,
      tile("reels", "Aprender", "Teoría en reels", () => go("learn"), `${done}/${CHAPTERS.length}`),
      tile("scale", "Casos", "Simulá procedimientos", () => go("simulations")),
      tile("cap", "Exámenes", "Oral y escrito", () => go("exams")),
      tile("network", "Redes", "Mapas conceptuales", () => go("maps")),
      tile("brain", "Repasar", "Memoria espaciada", () => go("memory"), due ? String(due) : undefined),
      tile("chart", "Progreso", "Tu rendimiento", () => go("progress")),
      tile("bag", "Inventario", "Premios y tienda", () => go("inventory")),
      tile("user", "Personaje", "Tu avatar", () => go("character")),
      tile("target", "Mi plan", "Racha y examen", () => go("plan"), currentStreak(s) ? `🔥${currentStreak(s)}` : undefined),
      tile("book", "Normas", "Fuentes y vigencia", () => go("library")),
    );
  };
  store.subscribe(update);
  update();

  aiMode().then((mode) => {
    add(
      status,
      h("span", { class: `pill ${mode ? "ok" : "warn"}` }, aiLabel(mode)),
      h("button", { class: "pill info", onclick: () => go("library") }, "Fuentes y vigencia"),
    );
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
