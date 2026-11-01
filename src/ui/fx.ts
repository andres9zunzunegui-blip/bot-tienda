/** Efectos visuales de progresión: XP flotante, subida de nivel, insignias y desbloqueos. */
import { events } from "../core/state.ts";
import { banner, h, toast } from "./dom.ts";

let anchor: () => { x: number; y: number } = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
export function setFxAnchor(fn: () => { x: number; y: number }) {
  anchor = fn;
}

function floatText(text: string) {
  const p = anchor();
  const el = h("div", { class: "float-xp", style: `left:${p.x - 30}px;top:${p.y - 20}px` }, text);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

export function confetti(n = 60) {
  if (document.documentElement.dataset.reduceMotion === "1") return;
  const colors = ["#f5d47e", "#e3b448", "#5aa2f0", "#4cc38a", "#ef5b5b", "#ffffff"];
  for (let i = 0; i < n; i++) {
    const c = h("div", {
      class: "confetti",
      style: `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};animation-duration:${1.8 + Math.random() * 1.6}s;animation-delay:${Math.random() * 0.4}s`,
    });
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4000);
  }
}

export function installFx() {
  events.on((e) => {
    switch (e.type) {
      case "reward":
        if (e.xp) floatText(`+${e.xp} XP`);
        toast(`${e.label}: ${e.xp ? `+${e.xp} XP` : ""} ${e.coins ? `+${e.coins} 🪙` : ""}`.trim(), "ok");
        break;
      case "levelup":
        banner(`¡Nivel ${e.level}!`, e.rank);
        confetti();
        break;
      case "badge":
        banner(`🏅 ${e.name}`, "Nueva insignia", "badge");
        break;
      case "unlock":
        banner(`🏗️ ${e.name}`, "¡Nuevo edificio desbloqueado en la ciudad!", "unlock");
        confetti(40);
        break;
      case "toast":
        toast(e.text, e.tone);
        break;
    }
  });
}
