/** PROGRESO, INVENTARIO, MI PERSONAJE, MISIONES, BIBLIOTECA DE NORMAS y LABORATORIO (pendiente). */
import { ITEMS, effectiveAvatar, item } from "../../content/items.ts";
import { store, today, type Avatar } from "../../core/state.ts";
import { avatarPreview } from "../../engine/world.ts";
import { LEGAL_REFS, OFFICIAL_SOURCES, getRef, refLabel, type Jurisdiccion } from "../../legal/sources.ts";
import { BADGES, BUILDING_UNLOCKS, RANKS, claimMission, levelFromXp, rankFor, topicMastery, xpForLevel } from "../../systems/gamification.ts";
import { retention } from "../../systems/memory.ts";
import { SUBJECTS, TOPICS, topicName } from "../../systems/topics.ts";
import { add, bar, clear, confirmTwice, h, openPanel, pct, toast } from "../dom.ts";
import { go, registerScreen } from "../nav.ts";
import { refCard } from "./simulator.ts";

const DAY = 86_400_000;

/* ------------------------------ PROGRESO ------------------------------ */

export function openProgress() {
  openPanel({ title: "Progreso académico", wide: true }, (body) => {
    const s = store.state;
    const lv = levelFromXp(s.xp);
    const topics = [...new Set([...Object.keys(TOPICS), ...Object.keys(s.topicScores)])];
    const errByRef: Record<string, number> = {};
    for (const e of s.errors) if (e.ref) errByRef[e.ref] = (errByRef[e.ref] ?? 0) + 1;
    const errByTopic: Record<string, number> = {};
    for (const e of s.errors) errByTopic[e.topic] = (errByTopic[e.topic] ?? 0) + 1;
    const sims = s.log.filter((l) => l.kind === "simulacion");
    const orals = s.log.filter((l) => l.kind === "oral");
    const reviewed = s.cards.filter((c) => c.lastReview !== undefined);
    add(body, 
      h(
        "div",
        { class: "grid c3" },
        h("div", { class: "card" }, h("h3", null, `Nivel ${lv} — ${rankFor(lv)}`), bar((s.xp - xpForLevel(lv)) / (xpForLevel(lv + 1) - xpForLevel(lv))), h("p", { class: "muted" }, `${s.xp} XP · faltan ${xpForLevel(lv + 1) - s.xp} para el nivel ${lv + 1}`)),
        h("div", { class: "card" }, h("h3", null, "Casos prácticos"), h("p", null, sims.length ? `${sims.length} simulaciones · mejor ${pct(Math.max(...sims.map((x) => x.quality)))} · última ${pct(sims.at(-1)!.quality)}` : "Sin simulaciones")),
        h("div", { class: "card" }, h("h3", null, "Exámenes orales"), h("p", null, orals.length ? `${orals.length} rendidos · aprobados ${orals.filter((o) => o.quality >= 0.6).length} · promedio ${pct(orals.reduce((a, o) => a + o.quality, 0) / orals.length)}` : "Sin exámenes")),
      ),
      h("h3", null, "Dominio por tema"),
      h(
        "table",
        { class: "t" },
        h("tr", null, h("th", null, "Tema"), h("th", null, "Dominio"), h("th", null, "Estado"), h("th", null, "Errores"), h("th", null, "Último repaso")),
        topics.map((t) => {
          const m = topicMastery(s, t);
          const last = s.topicScores[t]?.at(-1)?.at;
          return h(
            "tr",
            null,
            h("td", null, topicName(t, s.materials)),
            h("td", { style: "min-width:120px" }, bar(m, m >= 0.8 ? "ok" : m < 0.5 && last ? "bad" : ""), pct(m)),
            h("td", null, m >= 0.8 ? h("span", { class: "tag ok" }, "dominado") : last ? h("span", { class: "tag warn" }, "pendiente de refuerzo") : h("span", { class: "tag" }, "sin evidencia")),
            h("td", null, String(errByTopic[t] ?? 0)),
            h("td", null, last ? `hace ${Math.floor((Date.now() - last) / DAY)} d` : "—"),
          );
        }),
      ),
      h(
        "div",
        { class: "grid c2", style: "margin-top:12px" },
        h(
          "div",
          { class: "card" },
          h("h3", null, "Artículos que más confundís"),
          Object.keys(errByRef).length
            ? h("ol", null, Object.entries(errByRef).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([r, n]) => h("li", null, `${refLabel(getRef(r))} — ${n} error(es)`)))
            : h("p", { class: "muted" }, "Sin datos todavía."),
        ),
        h(
          "div",
          { class: "card" },
          h("h3", null, "Memoria"),
          h("p", null, `${s.cards.length} tarjetas · ${s.cards.filter((c) => c.due <= Date.now()).length} vencidas`),
          h("p", null, `Retención estimada: ${reviewed.length ? pct(reviewed.reduce((a, c) => a + retention(c), 0) / reviewed.length) : "—"}`),
          h("p", null, `Tarjetas más olvidadas: ${[...s.cards].sort((a, b) => b.lapses - a.lapses).slice(0, 3).filter((c) => c.lapses).map((c) => c.prompt.slice(0, 50)).join(" · ") || "—"}`),
        ),
      ),
      h("h3", null, "Preguntas y decisiones falladas recientes"),
      s.errors.length
        ? h("table", { class: "t" }, [...s.errors].reverse().slice(0, 15).map((e) => h("tr", null, h("td", null, new Date(e.at).toLocaleDateString("es-AR")), h("td", null, e.activity), h("td", null, e.description))))
        : h("p", { class: "muted" }, "Sin errores registrados."),
      h("h3", null, "Historial de actividad"),
      h("table", { class: "t" }, [...s.log].reverse().slice(0, 20).map((l) => h("tr", null, h("td", null, new Date(l.at).toLocaleString("es-AR")), h("td", null, l.detail ?? l.kind), h("td", null, pct(l.quality)), h("td", null, `+${l.xp} XP`), h("td", null, `+${l.coins} 🪙`)))),
      h(
        "div",
        { class: "row", style: "margin-top:14px" },
        h("button", {
          class: "btn",
          onclick: () => {
            const blob = new Blob([store.export()], { type: "application/json" });
            const a = h("a", { href: URL.createObjectURL(blob), download: `legal-life-${today()}.json` });
            a.click();
          },
        }, "Exportar partida"),
        h("label", { class: "btn" }, "Importar partida", h("input", {
          type: "file",
          accept: "application/json",
          style: "display:none",
          onchange: async (e: Event) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            try {
              store.import(await f.text());
              toast("Partida importada", "ok");
              openProgress();
            } catch (err) {
              toast((err as Error).message, "error");
            }
          },
        })),
        h("button", { class: "btn", onclick: (e: Event) => confirmTwice(e.currentTarget as HTMLButtonElement, "Tocá otra vez para borrar todo", () => (store.reset(), openProgress())) }, "Reiniciar progreso"),
      ),
    );
  });
}

/* ------------------------------ INVENTARIO ------------------------------ */

export function openInventory() {
  openPanel({ title: "Inventario", subtitle: "Recompensas, insignias y edificios", wide: true }, (body) => {
    const render = () => {
      clear(body);
      const s = store.state;
      add(body, 
        h("p", null, h("b", null, `🪙 ${s.coins} estampillas fiscales`), h("span", { class: "muted" }, " — se ganan aprobando actividades, nunca por tiempo conectado.")),
        h("h3", null, "Tienda y objetos"),
        h(
          "div",
          { class: "grid c3" },
          ITEMS.map((it) => {
            const owned = s.owned.includes(it.id);
            const equipped = s.equipped.includes(it.id) || s.decorations.includes(it.id);
            const reqOk = !it.requirement || it.requirement.check(s);
            return h(
              "div",
              { class: `card ${!reqOk && !owned ? "locked" : ""}` },
              h("div", { class: "row between" }, h("h3", null, `${it.icon} ${it.name}`), h("span", { class: "tag" }, it.kind)),
              it.requirement ? h("p", { class: `muted` }, reqOk ? "✔ " : "🔒 ", it.requirement.text) : null,
              owned
                ? it.kind === "decoracion"
                  ? h("p", { class: "tag ok" }, "Colocado en la ciudad")
                  : h("button", { class: `btn small ${equipped ? "gold" : ""}`, onclick: () => (equip(it.id), render()) }, equipped ? "Equipado" : "Equipar")
                : h("button", { class: "btn small", disabled: !reqOk || s.coins < it.price, onclick: () => (buy(it.id), render()) }, `Comprar — ${it.price} 🪙`),
            );
          }),
        ),
        h("h3", null, "Insignias"),
        h("div", { class: "grid c3" }, Object.entries(BADGES).map(([id, b]) => h("div", { class: `card ${s.badges.includes(id) ? "" : "locked"}` }, h("h3", null, s.badges.includes(id) ? "🏅 " : "🔒 ", b.name), h("p", { class: "muted" }, b.description)))),
        h("h3", null, "Edificios de la ciudad"),
        h("table", { class: "t" }, BUILDING_UNLOCKS.map((b) => h("tr", null, h("td", null, s.unlocked.includes(b.id) ? "✅" : "🔒"), h("td", null, b.name), h("td", { class: "muted" }, b.requirement)))),
        h("h3", null, "Rangos académicos"),
        h("p", null, RANKS.map((r) => `${r.name} (nivel ${r.level})`).join(" → ")),
      );
    };
    render();
  });
}

function buy(id: string) {
  const it = item(id)!;
  if (store.state.coins < it.price) return;
  store.update("buy", (s) => {
    s.coins -= it.price;
    s.owned.push(id);
    if (it.kind === "decoracion") s.decorations.push(id);
  });
  if (it.kind !== "decoracion") equip(id);
  toast(`Compraste: ${it.name}`, "ok");
}

function equip(id: string) {
  const it = item(id)!;
  store.update("equip", (s) => {
    if (it.kind === "lentes") {
      s.equipped = s.equipped.includes(id) ? s.equipped.filter((x) => x !== id) : [...s.equipped, id];
      return;
    }
    s.equipped = s.equipped.filter((x) => item(x)?.kind !== it.kind);
    s.equipped.push(id);
  });
}

/* ------------------------------ PERSONAJE ------------------------------ */

const SKINS = ["#f1d0b5", "#e0b48a", "#c68e62", "#9a6a43", "#6b4429"];
const HAIRS = ["#1d1611", "#3b2a1f", "#7a4a2a", "#c9a15a", "#9a9a9a", "#6b1f1f"];

export function openCharacter() {
  let preview: ReturnType<typeof avatarPreview> | null = null;
  openPanel({ title: "Mi personaje", onClose: () => preview?.dispose() }, (body) => {
    const stage = h("div", { class: "avatar-stage" });
    const controls = h("div", { class: "stack" });
    add(body, h("div", { class: "grid c2" }, stage, controls));
    requestAnimationFrame(() => {
      preview = avatarPreview(stage);
      preview.set(effectiveAvatar(store.state));
    });
    const set = (patch: Partial<Avatar>) => {
      store.update("avatar", (s) => Object.assign(s.avatar, patch));
      preview?.set(effectiveAvatar(store.state));
      render();
    };
    const render = () => {
      clear(controls);
      const a = store.state.avatar;
      const name = h("input", { type: "text", value: a.name, maxlength: 24, onchange: () => set({ name: name.value.trim() || "Estudiante" }) });
      const s = store.state;
      add(controls, 
        h("label", { class: "field" }, "Nombre", name),
        h("div", null, h("div", { class: "muted" }, "Piel"), h("div", { class: "swatches" }, SKINS.map((c) => h("button", { class: `swatch ${a.skin === c ? "on" : ""}`, style: `background:${c}`, onclick: () => set({ skin: c }) })))),
        h("div", null, h("div", { class: "muted" }, "Pelo"), h("div", { class: "swatches" }, HAIRS.map((c) => h("button", { class: `swatch ${a.hair === c ? "on" : ""}`, style: `background:${c}`, onclick: () => set({ hair: c }) })))),
        h("div", null, h("div", { class: "muted" }, "Vestimenta y accesorios (desbloqueá más en el Inventario)"), h("div", { class: "row" }, ITEMS.filter((i) => i.kind !== "decoracion" && s.owned.includes(i.id)).map((i) => h("button", { class: `btn small ${s.equipped.includes(i.id) ? "gold" : ""}`, onclick: () => (equip(i.id), preview?.set(effectiveAvatar(store.state)), render()) }, `${i.icon} ${i.name}`)))),
        h("button", { class: "btn", onclick: () => go("inventory") }, "Ir al inventario"),
      );
    };
    render();
  });
}

/* ------------------------------ MISIONES ------------------------------ */

export function openMissions() {
  openPanel({ title: "Misiones", subtitle: "Diarias y personalizadas según tus debilidades" }, (body) => {
    const render = () => {
      clear(body);
      const s = store.state;
      add(body, h("p", { class: "muted" }, "Las misiones sólo avanzan con actividades APROBADAS (60 % o más): miden dominio, no participación."));
      for (const m of [...s.missions.list, ...s.specialMissions])
        add(body, 
          h(
            "div",
            { class: "card", style: "margin-bottom:8px" },
            h("div", { class: "row between" }, h("h3", null, m.done ? "✅ " : "🎯 ", m.title), m.personalized ? h("span", { class: "tag info" }, "personalizada") : h("span", { class: "tag" }, "diaria")),
            h("p", { class: "muted" }, m.description),
            bar(m.progress / m.target),
            h("div", { class: "row between" }, h("span", null, `${Math.min(m.progress, m.target)}/${m.target} · Recompensa: ${m.reward.xp} XP, ${m.reward.coins} 🪙`), m.done && !m.claimed ? h("button", { class: "btn gold small", onclick: () => (claimMission(m.id), render()) }, "Reclamar") : m.claimed ? h("span", { class: "tag ok" }, "reclamada") : null),
          ),
        );
    };
    render();
  });
}

/* ------------------------------ BIBLIOTECA DE NORMAS ------------------------------ */

export function openLibrary() {
  openPanel({ title: "Biblioteca de normas", subtitle: "Motor jurídico — fuentes, vigencia y advertencias", wide: true }, (body) => {
    const render = () => {
      clear(body);
      const st = store.state.settings;
      const jur = h("select", { onchange: () => (store.update("settings", (s) => (s.settings.jurisdiccion = jur.value as Jurisdiccion)), render()) }, (["Nacional", "CABA", "Provincia de Buenos Aires", "Otra provincia"] as Jurisdiccion[]).map((j) => h("option", { selected: j === st.jurisdiccion }, j)));
      const date = h("input", { type: "date", value: st.fechaReferencia, onchange: () => (store.update("settings", (s) => (s.settings.fechaReferencia = date.value || today())), render()) });
      const subj = [...new Set(LEGAL_REFS.map((r) => r.materia))];
      add(body, 
        h("p", { class: "notice" }, "Política de fuentes: el contenido de cada norma es una PARÁFRASIS didáctica, no el texto literal. En esta versión ninguna referencia fue cotejada en línea contra InfoLEG; todas se marcan para verificar. LEGAL LIFE no incorpora montos actualizables como dato cierto."),
        h("div", { class: "grid c2" }, h("label", { class: "field" }, "Jurisdicción", jur), h("label", { class: "field" }, "Fecha de referencia", date)),
        st.jurisdiccion !== "Nacional" ? h("p", { class: "notice info" }, `Para ${st.jurisdiccion} todavía no hay normas locales cargadas: se muestran las nacionales con advertencia.`) : null,
        subj.map((m) => h("div", null, h("h3", null, m), LEGAL_REFS.filter((r) => r.materia === m).map((r) => h("div", { class: "card", style: "margin-bottom:6px" }, refCard(r.id))))),
        h("h3", null, "Fuentes oficiales prioritarias"),
        h("ul", null, OFFICIAL_SOURCES.map((o) => h("li", null, h("a", { href: o.url, target: "_blank", rel: "noopener" }, o.nombre)))),
      );
    };
    render();
  });
}

/* ------------------------------ LABORATORIO DE CASOS ------------------------------ */

export function openCases() {
  openPanel({ title: "Laboratorio de casos", subtitle: "Expedientes ficticios basados en tu material" }, (body) => {
    add(body, 
      h("p", { class: "notice" }, "Función todavía NO implementada en esta versión (no forma parte del MVP)."),
      h("p", null, "Lo que ya está disponible y alimenta este laboratorio:"),
      h("ul", null, h("li", null, "El caso jugable de clausura (Tribunales)."), h("li", null, "El motor de simulaciones genérico, listo para nuevos expedientes."), h("li", null, "El procesamiento de tu material en conceptos y normas citadas.")),
      h("p", null, "Materias previstas: ", SUBJECTS.map((s) => s.name).join(", "), "."),
      h("button", { class: "btn gold", onclick: () => go("simulations") }, "Ir a Simulaciones"),
    );
  });
}

registerScreen("progress", openProgress);
registerScreen("inventory", openInventory);
registerScreen("character", openCharacter);
registerScreen("missions", openMissions);
registerScreen("library", openLibrary);
registerScreen("cases", openCases);
