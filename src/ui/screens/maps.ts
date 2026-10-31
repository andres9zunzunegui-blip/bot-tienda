/** Interfaz de REDES CONCEPTUALES: exploración, construcción y evaluación de memoria. */
import { RELATIONS, TRIBUTARIO_MAP } from "../../content/tributarioMap.ts";
import { store } from "../../core/state.ts";
import { checkRelation, layout, pickBlanks, scoreConstruction, type ConceptEdge, type ConceptMap } from "../../modules/conceptmap/model.ts";
import { loadMaterial } from "../../modules/materials/storage.ts";
import { toConceptMap } from "../../modules/materials/processor.ts";
import { recordActivity } from "../../systems/gamification.ts";
import { add, clear, h, openPanel, pct } from "../dom.ts";
import { registerScreen } from "../nav.ts";
import { guard } from "../gate.ts";
import { missingChapters } from "../../modules/reels/progress.ts";
import { refCard } from "./simulator.ts";

type Mode = "explorar" | "construir" | "evaluar";
const SVG = "http://www.w3.org/2000/svg";
const KIND_COLORS: Record<string, string> = {
  concepto: "#3c5a8a",
  institucion: "#7a5a17",
  procedimiento: "#2f6f55",
  norma: "#5a3a7a",
  jurisprudencia: "#7a2f3a",
};

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

async function availableMaps(): Promise<ConceptMap[]> {
  const maps: ConceptMap[] = [TRIBUTARIO_MAP];
  for (const m of store.state.materials) {
    if (m.processed === "no") continue;
    try {
      const st = await loadMaterial(m.id);
      if (st?.processed) maps.push(toConceptMap(m.id, m.name, m.subject, st.processed));
    } catch {
      /* IndexedDB no disponible */
    }
  }
  return maps;
}

export function openMaps(initial?: unknown) {
  let mode: Mode = (typeof initial === "string" && ["explorar", "construir", "evaluar"].includes(initial) ? initial : "explorar") as Mode;
  if (mode !== "explorar" && missingChapters(store.state, "red:practica").length) return guard("red:practica", () => openMaps(mode));
  let maps: ConceptMap[] = [TRIBUTARIO_MAP];
  let map = TRIBUTARIO_MAP;
  openPanel({ title: "Redes conceptuales", subtitle: "Explorá, construí y reconstruí de memoria", wide: true }, (body) => {
    const render = () => {
      clear(body);
      const top = h("div", { class: "row between" });
      const tabs = h("div", { class: "tabs" });
      for (const m of ["explorar", "construir", "evaluar"] as Mode[])
        add(tabs, h("button", { class: mode === m ? "on" : "", onclick: () => (m === "explorar" || map.origin === "material" ? ((mode = m), render()) : guard("red:practica", () => ((mode = m), render()))) }, { explorar: "🔭 Exploración", construir: "🧩 Construcción", evaluar: "🧠 Evaluación" }[m]));
      const sel = h("select", { style: "width:auto", onchange: () => ((map = maps[Number(sel.value)]), render()) }, maps.map((m, i) => h("option", { value: i, selected: m === map }, `${m.title}${m.origin === "material" ? " (tu material)" : ""}`)));
      add(top, tabs, sel);
      add(body, top);
      if (map.origin === "material") add(body, h("p", { class: "notice info" }, "Red generada a partir de tu material. Los nodos marcados como \"externo\" no surgen de tus apuntes."));
      add(body, mapView(map, mode));
    };
    availableMaps().then((m) => {
      maps = m;
      render();
    });
    render();
  });
}

function mapView(map: ConceptMap, mode: Mode): HTMLElement {
  const pos = layout(map);
  const xs = Object.values(pos).map((p) => p.x);
  const ys = Object.values(pos).map((p) => p.y);
  const full = { x: Math.min(...xs) - 180, y: Math.min(...ys) - 60, w: Math.max(...xs) - Math.min(...xs) + 360, h: Math.max(...ys) - Math.min(...ys) + 120 };
  // Encuadre inicial legible: centrado en la raíz, con zoom acorde al ancho de pantalla.
  const vw = Math.min(full.w, Math.max(700, window.innerWidth * 1.35));
  const vh = vw * (full.h / full.w);
  const root = pos[map.root];
  const desktop = window.innerWidth > 720;
  let vb = { x: root.x - vw / 2 + (desktop ? vw * 0.12 : 0), y: root.y - vh / 2, w: vw, h: vh };
  const svg = s("svg", { viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}` });
  const side = h("div", { class: "card map-side" });
  const zoomBy = (f: number) => {
    const cx = vb.x + vb.w / 2;
    const cy = vb.y + vb.h / 2;
    vb = { w: vb.w * f, h: vb.h * f, x: cx - (vb.w * f) / 2, y: cy - (vb.h * f) / 2 };
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  };
  const zoomUi = h("div", { class: "map-zoom" }, h("button", { class: "icon-btn", title: "Acercar", onclick: () => zoomBy(0.8) }, "+"), h("button", { class: "icon-btn", title: "Alejar", onclick: () => zoomBy(1.25) }, "−"));
  const wrap = h("div", { class: "map-wrap" }, svg, zoomUi, side);

  const userEdges: ConceptEdge[] = [];
  let wrong = 0;
  let selected: string | null = null;
  let selectedB: string | null = null;
  const blanks = mode === "evaluar" ? pickBlanks(map, Math.min(7, Math.max(3, Math.floor(map.nodes.length / 2))), Date.now()) : [];
  const assign: Record<string, string> = {};
  let checked = false;
  let bankPick: string | null = null;

  const label = (id: string) => map.nodes.find((n) => n.id === id)!.label;

  const draw = () => {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const edges = mode === "construir" ? userEdges : map.edges;
    for (const e of edges) {
      const a = pos[e.from];
      const b = pos[e.to];
      add(svg, s("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `map-edge ${mode === "construir" ? "ok" : ""}`, "stroke-dasharray": e.label === "se diferencia de" ? "6 5" : "" }));
      const t = s("text", { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 4, class: "map-elabel", "text-anchor": "middle" });
      t.textContent = e.label;
      add(svg, t);
    }
    for (const n of map.nodes) {
      const p = pos[n.id];
      const isBlank = blanks.includes(n.id);
      const shown = isBlank ? (assign[n.id] ? label(assign[n.id]) : "?") : n.label;
      const w = Math.max(120, shown.length * 11.5 + 36);
      const g = s("g", { class: `map-node ${selected === n.id || selectedB === n.id ? "sel" : ""} ${isBlank ? "blank" : ""}`, transform: `translate(${p.x},${p.y})` });
      let stroke = "#8aa0d8";
      if (isBlank && checked) stroke = assign[n.id] === n.id ? "#4cc38a" : "#ef5b5b";
      add(g, s("rect", { x: -w / 2, y: -20, width: w, height: 40, rx: 12, fill: isBlank ? "#141d33" : KIND_COLORS[n.kind], stroke }));
      const t = s("text", { "text-anchor": "middle", y: 7 });
      t.textContent = shown;
      add(g, t);
      g.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onNode(n.id);
      });
      add(svg, g);
    }
  };

  const onNode = (id: string) => {
    if (mode === "explorar") {
      selected = id;
      showInfo(id);
    } else if (mode === "construir") {
      if (!selected || selectedB) {
        selected = id;
        selectedB = null;
      } else if (id !== selected) selectedB = id;
      sideBuild();
    } else {
      if (!blanks.includes(id) || checked) return;
      if (bankPick) {
        for (const k of Object.keys(assign)) if (assign[k] === bankPick) delete assign[k];
        assign[id] = bankPick;
        bankPick = null;
      } else selected = id;
      sideEval();
    }
    draw();
  };

  const showInfo = (id: string) => {
    const n = map.nodes.find((x) => x.id === id)!;
    clear(side);
    add(side, 
      h("h3", null, n.label, " ", h("span", { class: "tag" }, n.kind), n.info.origen ? h("span", { class: `tag ${n.info.origen === "material" ? "info" : "warn"}` }, n.info.origen) : null),
      h("p", null, n.info.explicacion),
      n.info.ejemplo ? h("p", null, h("b", null, "Ejemplo: "), n.info.ejemplo) : null,
      n.info.normas.length ? h("div", null, h("h4", null, "Normas"), h("ul", null, n.info.normas.map((x) => h("li", null, x)))) : null,
      (n.info.refs ?? []).map((r) => refCard(r)),
      n.info.preguntas.length ? h("div", null, h("h4", null, "Preguntas"), h("ul", null, n.info.preguntas.map((x) => h("li", null, x)))) : null,
      h("h4", null, "Relaciones"),
      h("ul", null, map.edges.filter((e) => e.from === id || e.to === id).map((e) => h("li", null, `${label(e.from)} ${e.label} ${label(e.to)}`))),
    );
  };

  const feedback = h("div");
  const sideBuild = () => {
    clear(side);
    const relSel = h("select", null, [...RELATIONS, ...new Set(map.edges.map((e) => e.label))].filter((v, i, a) => a.indexOf(v) === i).map((r) => h("option", { value: r }, r)));
    add(side, 
      h("h3", null, "Construcción"),
      h("p", { class: "muted" }, "Tocá un concepto de origen, luego uno de destino, elegí la relación y conectá. Las relaciones incorrectas se explican."),
      h("div", { class: "kv" }, h("b", null, "Desde"), h("span", null, selected ? label(selected) : "—"), h("b", null, "Hasta"), h("span", null, selectedB ? label(selectedB) : "—")),
      relSel,
      h("div", { class: "row", style: "margin-top:8px" }, h("button", {
        class: "btn gold",
        disabled: !selected || !selectedB,
        onclick: () => {
          const v = checkRelation(map, selected!, selectedB!, relSel.value, userEdges);
          clear(feedback);
          add(feedback, h("p", { class: `notice ${v.ok ? "ok" : "bad"}` }, v.message));
          if (v.ok) userEdges.push({ from: selected!, to: selectedB!, label: relSel.value });
          else if (v.kind !== "repetida") {
            wrong++;
            mistakes.push({ from: selected!, to: selectedB!, label: relSel.value, msg: v.message });
          }
          selected = selectedB = null;
          draw();
          sideBuild();
        },
      }, "Conectar"), h("button", { class: "btn", onclick: () => finishBuild() }, "Entregar")),
      feedback,
      h("p", null, `Relaciones correctas: ${userEdges.length} / ${map.edges.length} · Intentos erróneos: ${wrong}`),
    );
  };
  const mistakes: { from: string; to: string; label: string; msg: string }[] = [];

  const finishBuild = () => {
    const q = scoreConstruction(map, userEdges.length, wrong);
    const topic = map.origin === "material" ? map.nodes[0].topic : "trib.ilicitos";
    const missing = map.edges.filter((e) => !userEdges.some((u) => u.from === e.from && u.to === e.to));
    const r = recordActivity({
      kind: "red",
      id: `${map.id}:construccion`,
      topic,
      quality: q,
      label: `Red conceptual (construcción): ${map.title}`,
      errors: mistakes.slice(0, 8).map((m) => ({
        topic: map.nodes.find((n) => n.id === m.to)?.topic ?? topic,
        description: `Relación incorrecta: ${label(m.from)} ${m.label} ${label(m.to)}`,
        prompt: `¿Qué relación hay entre "${label(m.from)}" y "${label(m.to)}"?`,
        answer: m.msg,
      })),
    });
    clear(side);
    add(side, 
      h("h3", null, `Resultado: ${pct(q)}`),
      h("p", null, `+${r.xp} XP, +${r.coins} 🪙`),
      missing.length ? h("div", null, h("h4", null, "Relaciones que faltaron"), h("ul", null, missing.map((e) => h("li", null, `${label(e.from)} ${e.label} ${label(e.to)}`)))) : h("p", { class: "notice ok" }, "¡Red completa!"),
    );
    mode = "explorar";
    draw();
  };

  const sideEval = () => {
    clear(side);
    const used = new Set(Object.values(assign));
    const bank = h("div", { class: "bank" });
    const options = [...blanks].sort((a, b) => label(a).localeCompare(label(b)));
    for (const id of options)
      add(bank, h("button", { class: bankPick === id ? "sel" : "", disabled: checked || (used.has(id) && bankPick !== id), onclick: () => {
        if (selected && blanks.includes(selected)) {
          for (const k of Object.keys(assign)) if (assign[k] === id) delete assign[k];
          assign[selected] = id;
          selected = null;
        } else bankPick = bankPick === id ? null : id;
        sideEval();
        draw();
      } }, label(id)));
    add(side, 
      h("h3", null, "Evaluación de memoria"),
      h("p", { class: "muted" }, `Reconstruí la red: completá los ${blanks.length} conceptos ocultos (?). Elegí un hueco y después un concepto del banco.`),
      bank,
      h("div", { class: "row", style: "margin-top:10px" }, h("button", { class: "btn gold", disabled: checked || Object.keys(assign).length < blanks.length, onclick: () => finishEval() }, "Corregir")),
      feedback,
    );
  };

  const finishEval = () => {
    checked = true;
    const correct = blanks.filter((b) => assign[b] === b);
    const q = correct.length / blanks.length;
    const parentOf = (id: string) => map.edges.find((e) => e.to === id);
    const r = recordActivity({
      kind: "red",
      id: `${map.id}:evaluacion`,
      topic: map.origin === "material" ? map.nodes[0].topic : "trib.ilicitos",
      quality: q,
      label: `Red conceptual (evaluación): ${map.title}`,
      topicQualities: Object.fromEntries(blanks.map((b) => [map.nodes.find((n) => n.id === b)!.topic, assign[b] === b ? 1 : 0])),
      errors: blanks
        .filter((b) => assign[b] !== b)
        .map((b) => {
          const p = parentOf(b);
          return {
            topic: map.nodes.find((n) => n.id === b)!.topic,
            description: `Ubicó "${label(assign[b])}" donde iba "${label(b)}"`,
            prompt: p ? `Red ${map.title}: ${label(p.from)} ${p.label} ___` : `Red ${map.title}: concepto central`,
            answer: label(b),
          };
        }),
      badges: q >= 0.8 ? ["cartografo"] : [],
    });
    clear(feedback);
    add(feedback, 
      h("p", { class: `notice ${q >= 0.8 ? "ok" : q >= 0.5 ? "" : "bad"}` }, `Acertaste ${correct.length} de ${blanks.length} (${pct(q)}). +${r.xp} XP, +${r.coins} 🪙`),
      h("ul", null, blanks.filter((b) => assign[b] !== b).map((b) => h("li", null, `Pusiste "${label(assign[b])}" donde iba "${label(b)}".`))),
    );
    sideEval();
    draw();
  };

  // Paneo y zoom
  let drag: { x: number; y: number } | null = null;
  svg.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY };
  });
  svg.addEventListener("pointerleave", () => (drag = null));
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = svg.getBoundingClientRect();
    vb.x -= ((e.clientX - drag.x) * vb.w) / r.width;
    vb.y -= ((e.clientY - drag.y) * vb.h) / r.height;
    drag = { x: e.clientX, y: e.clientY };
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  });
  svg.addEventListener("pointerup", () => (drag = null));
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomBy(e.deltaY > 0 ? 1.1 : 0.9);
  }, { passive: false });

  if (mode === "explorar") {
    add(side, h("h3", null, "Exploración"), h("p", { class: "muted" }, "Tocá cualquier concepto para ver su explicación, ejemplos, normas, preguntas y relaciones. Arrastrá para moverte y usá la rueda para acercar."));
  } else if (mode === "construir") sideBuild();
  else sideEval();
  draw();
  return wrap;
}

registerScreen("maps", openMaps);
