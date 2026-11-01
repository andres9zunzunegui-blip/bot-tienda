/**
 * LEGAL LIFE — punto de entrada.
 * Conecta: motor de juego (engine/), estado y persistencia (core/), sistemas
 * (gamificación, memoria), módulos académicos y la interfaz.
 */
import "./ui/styles.css";
import "./ui/screens/simulator.ts";
import "./ui/screens/maps.ts";
import "./ui/screens/exams.ts";
import "./ui/screens/study.ts";
import "./ui/screens/memory.ts";
import "./ui/screens/materials.ts";
import "./ui/screens/meta.ts";
import "./ui/screens/reels.ts";
import { showWelcome } from "./ui/welcome.ts";
import { store } from "./core/state.ts";
import { World } from "./engine/world.ts";
import { ensureDailyMissions } from "./systems/gamification.ts";
import { h, panelOpen, toast } from "./ui/dom.ts";
import { installFx, setFxAnchor } from "./ui/fx.ts";
import { openSimpleCity, renderHud, renderMenu } from "./ui/hud.ts";
import { applyPrefs, initMusic } from "./ui/prefs.ts";
import { openInterior } from "./ui/interiors.ts";

applyPrefs();
initMusic();
ensureDailyMissions();
setInterval(ensureDailyMissions, 60_000);
installFx();

const gameEl = document.getElementById("game")!;
const hudEl = document.getElementById("hud")!;
const menuEl = document.getElementById("menu")!;
let playing = false;
let world: World | null = null;

const hud = renderHud(hudEl, () => showMenu());

try {
  world = new World(gameEl, store.state, {
    onEnter: (id) => openInterior(id),
    onNear: (spec, unlocked) => hud.setNear(spec, unlocked, () => world?.enterNear()),
  });
  world.start();
  (window as unknown as { __legalLifeWorld: World }).__legalLifeWorld = world; // depuración / pruebas E2E
  world.setPaused(true);
  world.setAttract(true);
  store.subscribe((s) => world?.refresh(s));
  setFxAnchor(() => (playing && world ? world.playerScreen() : { x: innerWidth / 2, y: innerHeight / 2 }));
} catch (e) {
  console.error(e);
  gameEl.append(h("div", { class: "notice bad", style: "position:absolute;bottom:20px;left:16px;right:16px" }, "Tu navegador no pudo iniciar WebGL: el mundo 3D no está disponible, pero todas las funciones académicas siguen accesibles desde el menú."));
}

const menu = renderMenu(menuEl, () => {
  if (store.state.prefs.simple || !world) {
    if (!world && !store.state.prefs.simple) toast("El mundo 3D no está disponible: usamos el modo simple.", "warn");
    if (!store.state.welcomed) return showWelcome();
    return openSimpleCity();
  }
  playing = true;
  world.setAttract(false);
  menu.hide();
  hudEl.style.display = "";
  world.setPaused(panelOpen());
  if (!store.state.welcomed) showWelcome();
});

function showMenu() {
  playing = false;
  hudEl.style.display = "none";
  menu.show();
  world?.setPaused(true);
  world?.setAttract(true);
}

// Pausa el mundo mientras hay un panel abierto.
new MutationObserver(() => world?.setPaused(!playing || panelOpen())).observe(document.getElementById("overlays")!, { childList: true });

// Guarda la posición del personaje periódicamente.
setInterval(() => {
  if (!world || !playing) return;
  store.state.playerPos = world.getPlayerPos();
  store.save();
}, 5000);
