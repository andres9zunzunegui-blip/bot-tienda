/** Interiores de los edificios: cada uno da acceso a los sistemas correspondientes. */
import { CLAUSURA } from "../content/clausura.ts";
import { store } from "../core/state.ts";
import { BUILDINGS } from "../engine/buildings.ts";
import { BUILDING_UNLOCKS } from "../systems/gamification.ts";
import { add, h, openPanel } from "./dom.ts";
import { go, type ScreenId } from "./nav.ts";
import { openSimulator } from "./screens/simulator.ts";
import { guard } from "./gate.ts";

interface Action {
  icon: string;
  title: string;
  desc: string;
  run: () => void;
}

const nav = (id: ScreenId, arg?: unknown) => () => go(id, arg);

const INTERIORS: Record<string, { bg: string; npc: string; speech: string; actions: Action[] }> = {
  facultad: {
    bg: "linear-gradient(135deg,#3a2c1c,#6b5537)",
    npc: "👨‍🏫",
    speech: "Prof. Ibarra: «Bienvenido/a. Primero, la teoría en el Aula de reels. Después le voy a preguntar y repreguntar.»",
    actions: [
      { icon: "🎬", title: "Aula de reels", desc: "Aprendé la teoría con capítulos animados.", run: nav("learn") },
      { icon: "🎓", title: "Examen oral", desc: "Con el Prof. Ibarra, con repreguntas.", run: nav("exams", "profesor") },
      { icon: "📖", title: "Estudiar unidades", desc: "Materias, unidades y comprensión.", run: nav("study") },
      { icon: "🕸️", title: "Redes conceptuales", desc: "Explorar, construir, reconstruir.", run: nav("maps") },
      { icon: "📝", title: "Simulacro escrito", desc: "10 preguntas de opción múltiple.", run: nav("exams") },
    ],
  },
  tribunal: {
    bg: "linear-gradient(135deg,#1c2433,#3d4a63)",
    npc: "👩‍⚖️",
    speech: "Jueza Salvatierra: «Tengo en mi despacho una clausura de la Ley 11.683. ¿Asume la defensa?»",
    actions: [
      { icon: "⚖️", title: "Caso: clausura — La Espiga", desc: "Simulador completo del procedimiento.", run: () => guard("sim:clausura", () => openSimulator(CLAUSURA)) },
      { icon: "🔨", title: "Audiencia oral", desc: "Fundamentá ante la jueza.", run: nav("exams", "juez") },
      { icon: "📚", title: "Normas aplicables", desc: "Biblioteca del motor jurídico.", run: nav("library") },
    ],
  },
  biblioteca: {
    bg: "linear-gradient(135deg,#3b1f16,#6e3a26)",
    npc: "🧑‍💼",
    speech: "Bibliotecaria: «Traé tus apuntes: los convertimos en unidades, redes y preguntas.»",
    actions: [
      { icon: "📤", title: "Cargar material", desc: "PDF, DOCX, PPTX o texto.", run: nav("upload") },
      { icon: "📚", title: "Mis materiales", desc: "Unidades y conceptos generados.", run: nav("materials") },
      { icon: "⚖️", title: "Biblioteca de normas", desc: "Fuentes, vigencia, advertencias.", run: nav("library") },
    ],
  },
  estudio: {
    bg: "linear-gradient(135deg,#132238,#2b4a70)",
    npc: "👩",
    speech: "Marta Gómez: «Gracias por defenderme, doctor/a. ¿Revisamos cómo salió todo?»",
    actions: [
      { icon: "📂", title: "Laboratorio de casos", desc: "Expedientes ficticios (no implementado).", run: nav("cases") },
      { icon: "⚖️", title: "Volver a defender a Marta", desc: "Reintentar el caso de clausura.", run: () => guard("sim:clausura", () => openSimulator(CLAUSURA)) },
      { icon: "📊", title: "Desempeño en casos", desc: "Historial y errores.", run: nav("progress") },
    ],
  },
  arca: {
    bg: "linear-gradient(135deg,#1f2a36,#465566)",
    npc: "🕵️",
    speech: "Inspector Ledesma: «Desde acá se labran las actas. Conocer cómo trabajamos te hace mejor defensor/a.»",
    actions: [
      { icon: "📚", title: "Facultades del organismo", desc: "Arts. 35, 40 y 41 en la biblioteca.", run: nav("library") },
      { icon: "🕸️", title: "Red: procedimientos", desc: "Ubicá el organismo en la red.", run: nav("maps", "evaluar") },
    ],
  },
  audiencias: {
    bg: "linear-gradient(135deg,#2c1d16,#5a3b2a)",
    npc: "👩‍⚖️",
    speech: "Secretario: «La sala está lista. Modo exigente recomendado.»",
    actions: [{ icon: "🔨", title: "Audiencia oral", desc: "Con repreguntas.", run: nav("exams", "juez") }],
  },
  investigacion: {
    bg: "linear-gradient(135deg,#16283a,#2f5878)",
    npc: "🧑‍🔬",
    speech: "Investigadora: «Una red bien armada vale más que cien resúmenes.»",
    actions: [
      { icon: "🧠", title: "Reconstruir de memoria", desc: "Modo evaluación.", run: nav("maps", "evaluar") },
      { icon: "🧩", title: "Construir relaciones", desc: "Modo construcción.", run: nav("maps", "construir") },
    ],
  },
  archivo: {
    bg: "linear-gradient(135deg,#2e2516,#5c4a2a)",
    npc: "🗂️",
    speech: "Archivista: «Acá guardamos cada error para que no se repita.»",
    actions: [
      { icon: "📊", title: "Errores frecuentes", desc: "Progreso y artículos confundidos.", run: nav("progress") },
      { icon: "🧠", title: "Entrenador de memoria", desc: "Repetición espaciada.", run: nav("memory") },
    ],
  },
  entrenamiento: {
    bg: "linear-gradient(135deg,#132a1d,#2c5a3d)",
    npc: "🏋️",
    speech: "Entrenador: «Misiones personalizadas sobre tus puntos débiles.»",
    actions: [
      { icon: "🎯", title: "Misiones", desc: "Diarias y personalizadas.", run: nav("missions") },
      { icon: "🧠", title: "Entrenador de memoria", desc: "Recuperación activa.", run: nav("memory") },
    ],
  },
};

export function openInterior(id: string) {
  const spec = BUILDINGS.find((b) => b.id === id)!;
  const unlocked = store.state.unlocked.includes(id);
  if (!unlocked) {
    const req = BUILDING_UNLOCKS.find((b) => b.id === id)?.requirement ?? "";
    openPanel({ title: `${spec.icon} ${spec.name}`, subtitle: "En construcción" }, (body) =>
      add(body, h("p", { class: "notice" }, `🔒 Este edificio se construye cuando demostrás dominio: ${req}.`), h("p", { class: "muted" }, "Los edificios no se compran: el conocimiento es el motor de la ciudad.")),
    );
    return;
  }
  const it = INTERIORS[id];
  openPanel({ title: `${spec.icon} ${spec.name}` }, (body) => {
    add(body, 
      h("div", { class: "interior", style: `background:${it.bg}` }, h("div", { class: "npc" }, it.npc), h("div", { class: "speech" }, it.speech)),
      h("div", { class: "grid c2" }, it.actions.map((a) => h("div", { class: "card click", onclick: a.run }, h("h3", null, `${a.icon} ${a.title}`), h("p", { class: "muted" }, a.desc)))),
    );
  });
}
