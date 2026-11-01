/** Preferencias: accesibilidad, música y modo simple. */
import { STATIONS, lofi } from "../audio/lofi.ts";
import { setSfx } from "../audio/sfx.ts";
import { store, type Prefs } from "../core/state.ts";
import { add, clear, h, openPanel, toast } from "./dom.ts";
import { icon } from "./icons.ts";

export function applyPrefs(p: Prefs = store.state.prefs) {
  const r = document.documentElement;
  r.style.setProperty("--ui-scale", String(p.scale));
  r.dataset.contrast = p.contrast ? "1" : "";
  r.dataset.legible = p.legible ? "1" : "";
  r.dataset.reduceMotion = p.reduceMotion ? "1" : "";
  setSfx(p.sfx !== false);
}

export function setPrefs(fn: (p: Prefs) => void) {
  store.update("prefs", (s) => fn(s.prefs));
  applyPrefs();
}

/* ------------------------------ Música ------------------------------ */

let musicReady = false;
export function initMusic() {
  if (musicReady) return;
  musicReady = true;
  const m = store.state.prefs.music;
  lofi.volume = m.volume;
  lofi.setStation(m.station);
  lofi.setRain(m.rain);
  // Los navegadores sólo permiten sonar después de una interacción del usuario.
  if (m.on) {
    const start = () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      if (store.state.prefs.music.on && !lofi.playing) lofi.play().catch(() => {});
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
  }
}

export async function toggleMusic() {
  if (!lofi.supported) return toast("Tu navegador no permite reproducir audio generado.", "warn");
  try {
    await lofi.toggle();
  } catch {
    return toast("No se pudo iniciar el audio. Tocá de nuevo.", "warn");
  }
  setPrefs((p) => (p.music.on = lofi.playing));
}

/** Botón flotante de música (reproduce/pausa y abre el panel de estaciones). */
export function musicWidget(): HTMLElement {
  const btn = h("button", { class: "music-play", "aria-label": "Reproducir o pausar música", onclick: () => toggleMusic() });
  const label = h("button", { class: "music-label", onclick: () => openMusic() });
  const el = h("div", { class: "music-widget" }, btn, label);
  const render = () => {
    clear(btn);
    add(btn, icon(lofi.playing ? "pause" : "play", 18));
    el.classList.toggle("on", lofi.playing);
    clear(label);
    add(label, h("span", { class: "eq", "aria-hidden": "true" }, h("i"), h("i"), h("i")), h("span", null, lofi.fileName || lofi.station.name));
  };
  lofi.onChange(render);
  render();
  return el;
}

export function openMusic() {
  openPanel({ title: "Música para estudiar", subtitle: "Lofi generado en vivo: nunca se repite igual" }, (body) => {
    const render = () => {
      clear(body);
      const vol = h("input", { type: "range", id: "music-vol", min: 0, max: 1, step: 0.05, value: lofi.volume, "aria-label": "Volumen" });
      vol.addEventListener("input", () => {
        lofi.setVolume(Number(vol.value));
        store.state.prefs.music.volume = Number(vol.value);
        store.save();
      });
      add(
        body,
        h("div", { class: "row" }, h("button", { class: "btn gold big", onclick: async () => (await toggleMusic(), render()) }, icon(lofi.playing ? "pause" : "play", 18), lofi.playing ? "Pausar" : "Reproducir"), h("label", { class: "vol" }, icon("volume", 18), vol)),
        h("h3", null, "Estaciones"),
        h(
          "div",
          { class: "stations" },
          STATIONS.map((st) =>
            h(
              "button",
              {
                class: `station ${lofi.station.id === st.id && !lofi.fileName ? "on" : ""}`,
                onclick: async () => {
                  lofi.setStation(st.id);
                  setPrefs((p) => ((p.music.station = st.id), (p.music.rain = lofi.rain)));
                  if (!lofi.playing) await toggleMusic();
                  render();
                },
              },
              h("b", null, st.name),
              h("small", null, `${st.mood} · ${st.bpm} BPM${st.rain ? " · con lluvia" : ""}`),
            ),
          ),
        ),
        h("label", { class: "switch-row" }, h("input", { type: "checkbox", id: "music-rain", checked: lofi.rain, onchange: (e: Event) => (lofi.setRain((e.target as HTMLInputElement).checked), setPrefs((p) => (p.music.rain = lofi.rain))) }), icon("rain", 18), "Sonido de lluvia de fondo"),
        h("h3", null, "Tu propia música"),
        h("p", { class: "muted" }, "¿Tenés un mix de 2 horas descargado? Elegilo y suena en bucle mientras jugás. El archivo no sale de tu dispositivo."),
        h("label", { class: "btn" }, icon("upload", 18), lofi.fileName ? `Sonando: ${lofi.fileName}` : "Elegir archivo de audio", h("input", {
          type: "file",
          id: "music-file",
          accept: "audio/*",
          style: "display:none",
          onchange: async (e: Event) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            try {
              await lofi.useFile(f);
              setPrefs((p) => (p.music.on = true));
            } catch {
              toast("No se pudo reproducir ese archivo.", "error");
            }
            render();
          },
        })),
        lofi.fileName ? h("button", { class: "btn ghost", onclick: () => (lofi.clearFile(), render()) }, "Volver al lofi generado") : null,
      );
    };
    render();
  });
}

/* ------------------------------ Ajustes y accesibilidad ------------------------------ */

export function openSettings() {
  openPanel({ title: "Ajustes", subtitle: "Accesibilidad, lectura y sonido" }, (body) => {
    const render = () => {
      clear(body);
      const p = store.state.prefs;
      const seg = (id: string, label: string, options: [number, string][], value: number, set: (v: number) => void) =>
        h(
          "div",
          { class: "setting" },
          h("span", { class: "setting-label", id }, label),
          h("div", { class: "seg", role: "radiogroup", "aria-labelledby": id }, options.map(([v, l]) => h("button", { role: "radio", "aria-checked": String(v === value), class: v === value ? "on" : "", onclick: () => (set(v), render()) }, l))),
        );
      const sw = (id: string, label: string, hint: string, value: boolean, set: (v: boolean) => void) =>
        h("label", { class: "setting toggle", for: id }, h("span", null, h("span", { class: "setting-label" }, label), h("small", null, hint)), h("input", { type: "checkbox", role: "switch", id, checked: value, onchange: (e: Event) => (set((e.target as HTMLInputElement).checked), render()) }));
      add(
        body,
        h("h3", null, "Lectura"),
        seg("set-scale", "Tamaño del texto", [[1, "Normal"], [1.15, "Grande"], [1.3, "Muy grande"]], p.scale, (v) => setPrefs((q) => (q.scale = v))),
        sw("set-legible", "Letra de alta legibilidad", "Tipografía diseñada para leer con facilidad (Atkinson Hyperlegible).", p.legible, (v) => setPrefs((q) => (q.legible = v))),
        sw("set-contrast", "Alto contraste", "Textos más claros y bordes más marcados.", p.contrast, (v) => setPrefs((q) => (q.contrast = v))),
        h("h3", null, "Movimiento y ritmo"),
        sw("set-motion", "Reducir animaciones", "Quita animaciones y efectos de confeti.", p.reduceMotion, (v) => setPrefs((q) => (q.reduceMotion = v))),
        sw("set-auto", "Reels con avance automático", "Si lo apagás, pasás cada reel cuando quieras.", p.autoAdvance, (v) => setPrefs((q) => (q.autoAdvance = v))),
        seg("set-pace", "Velocidad de los reels", [[1, "Normal"], [1.5, "Lenta"], [2, "Muy lenta"]], p.reelPace, (v) => setPrefs((q) => (q.reelPace = v))),
        sw("set-narrate", "Narrar los reels en voz alta", "Lee cada reel automáticamente.", p.narrate, (v) => setPrefs((q) => (q.narrate = v))),
        h("h3", null, "Forma de jugar"),
        sw("set-simple", "Modo simple", "Sin ciudad 3D: todo se recorre con botones grandes. Ideal para celulares lentos o para ir directo al estudio.", p.simple, (v) => (setPrefs((q) => (q.simple = v)), toast(v ? "Modo simple activado: tocá Continuar o Explorar." : "Modo ciudad 3D activado.", "ok"))),
        h("h3", null, "Ciudad"),
        sw("set-cycle", "Día y noche según tu hora", "De noche se encienden las ventanas y los faroles.", p.dayCycle, (v) => setPrefs((q) => (q.dayCycle = v))),
        h(
          "div",
          { class: "setting" },
          h("span", { class: "setting-label", id: "set-weather" }, "Clima"),
          h("div", { class: "seg", role: "radiogroup", "aria-labelledby": "set-weather" }, ([["auto", "Según la música"], ["despejado", "Despejado"], ["lluvia", "Lluvia"]] as const).map(([v, l]) => h("button", { role: "radio", "aria-checked": String(p.weather === v), class: p.weather === v ? "on" : "", onclick: () => (setPrefs((q) => (q.weather = v)), render()) }, l))),
        ),
        h("h3", null, "Sonido"),
        sw("set-sfx", "Efectos de sonido", "Máquina de escribir, papel, sellos y aciertos.", p.sfx !== false, (v) => setPrefs((q) => (q.sfx = v))),
        h("button", { class: "btn", onclick: () => openMusic() }, icon("music", 18), "Música para estudiar"),
        h("p", { class: "muted" }, "Atajos de teclado: WASD o flechas para caminar · E para entrar · Esc para cerrar · en reels, flechas para avanzar y espacio para pausar."),
      );
    };
    render();
  });
}
