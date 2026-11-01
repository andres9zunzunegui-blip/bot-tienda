/**
 * "Game feel": cada logro se sella como en un expediente. XP flotante, sellos
 * de goma que golpean la pantalla, papel picado con colores de fileteado y sonido.
 */
import { sfx } from "../audio/sfx.ts";
import { events } from "../core/state.ts";
import { h, toast } from "./dom.ts";
import { stampSvg } from "./ornaments.ts";

let anchor: () => { x: number; y: number } = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
export function setFxAnchor(fn: () => { x: number; y: number }) {
  anchor = fn;
}

const reduced = () => document.documentElement.dataset.reduceMotion === "1";

function floatText(text: string) {
  const p = anchor();
  const el = h("div", { class: "float-xp", style: `left:${p.x - 30}px;top:${p.y - 20}px` }, text);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

export function confetti(n = 60) {
  if (reduced()) return;
  const colors = ["#e8b23a", "#b3282d", "#2f8f6b", "#6fa8dc", "#f4ead2"];
  for (let i = 0; i < n; i++) {
    const c = h("div", {
      class: "confetti",
      style: `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};animation-duration:${1.8 + Math.random() * 1.6}s;animation-delay:${Math.random() * 0.4}s`,
    });
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4000);
  }
}

let stampQueue = Promise.resolve();

/** Un sello de goma golpea la pantalla (en cola, para que no se pisen). */
export function stamp(top: string, main: string, sub = "", color = "#b3282d") {
  stampQueue = stampQueue.then(
    () =>
      new Promise<void>((resolve) => {
        const el = h(
          "div",
          { class: "stamp-fx", role: "status", "aria-live": "polite" },
          h("div", { class: "stamp-mark", html: stampSvg(top.toUpperCase(), main.toUpperCase(), color) }),
          sub ? h("p", null, sub) : null,
        );
        document.body.appendChild(el);
        setTimeout(() => sfx.stamp(), reduced() ? 0 : 230);
        setTimeout(() => el.classList.add("out"), 1700);
        setTimeout(() => (el.remove(), resolve()), 2100);
      }),
  );
}

export function installFx() {
  events.on((e) => {
    switch (e.type) {
      case "reward":
        if (e.xp) floatText(`+${e.xp} XP`);
        if (e.xp || e.coins) sfx.good();
        toast(`📜 ${e.label}: ${e.xp ? `+${e.xp} XP` : ""} ${e.coins ? `· +${e.coins} estampillas` : ""}`.trim(), "ok");
        break;
      case "levelup":
        sfx.fanfare();
        stamp("Promovido/a", `Nivel ${e.level}`, e.rank, "#2f8f6b");
        confetti();
        break;
      case "badge":
        stamp("Insignia", "Otorgada", e.name, "#b3282d");
        break;
      case "unlock":
        stamp("Edificio", "Habilitado", e.name, "#1f5fa8");
        confetti(40);
        break;
      case "toast":
        toast(e.text, e.tone);
        break;
    }
  });
}
