/** Catálogo de recompensas: personalización del personaje y decoración de la ciudad. */
import type { Avatar, GameState } from "../core/state.ts";
import { levelFromXp } from "../systems/gamification.ts";

export interface Item {
  id: string;
  name: string;
  kind: "traje" | "accesorio" | "lentes" | "decoracion";
  price: number;
  color?: string;
  accessory?: "maletin" | "codigo" | "toga";
  requirement?: { text: string; check: (s: GameState) => boolean };
  icon: string;
}

export const ITEMS: Item[] = [
  { id: "traje-azul", name: "Traje azul marino", kind: "traje", price: 0, color: "#24324f", icon: "🧥" },
  { id: "traje-gris", name: "Traje gris oxford", kind: "traje", price: 60, color: "#4a4f5a", icon: "🧥" },
  { id: "traje-bordo", name: "Traje bordó", kind: "traje", price: 80, color: "#6b2132", icon: "🧥" },
  { id: "traje-verde", name: "Traje verde inglés", kind: "traje", price: 80, color: "#1f4d3a", icon: "🧥" },
  { id: "maletin", name: "Maletín de cuero", kind: "accesorio", price: 0, accessory: "maletin", icon: "💼" },
  { id: "codigo", name: "Código anotado", kind: "accesorio", price: 40, accessory: "codigo", icon: "📕" },
  {
    id: "toga",
    name: "Toga académica",
    kind: "accesorio",
    price: 150,
    accessory: "toga",
    icon: "🎓",
    requirement: { text: "Requiere la insignia \"Oral aprobado\"", check: (s) => s.badges.includes("oral-aprobado") },
  },
  { id: "lentes", name: "Anteojos de lectura", kind: "lentes", price: 30, icon: "👓" },
  { id: "bancos", name: "Bancos de plaza", kind: "decoracion", price: 60, icon: "🪑" },
  { id: "farolas", name: "Farolas", kind: "decoracion", price: 70, icon: "🏮" },
  { id: "arboleda", name: "Arboleda", kind: "decoracion", price: 80, icon: "🌳" },
  {
    id: "fuente",
    name: "Fuente central",
    kind: "decoracion",
    price: 150,
    icon: "⛲",
    requirement: { text: "Requiere nivel 3", check: (s) => levelFromXp(s.xp) >= 3 },
  },
  {
    id: "temis",
    name: "Estatua de Temis",
    kind: "decoracion",
    price: 300,
    icon: "⚖️",
    requirement: { text: "Requiere la insignia \"Defensa impecable\"", check: (s) => s.badges.includes("defensa-impecable") },
  },
];

export function item(id: string): Item | undefined {
  return ITEMS.find((i) => i.id === id);
}

/** Apariencia efectiva del avatar según los objetos equipados. */
export function effectiveAvatar(s: GameState) {
  const suit = s.equipped.map(item).find((i) => i?.kind === "traje");
  const acc = s.equipped.map(item).find((i) => i?.kind === "accesorio");
  return {
    ...s.avatar,
    suit: suit?.color ?? s.avatar.suit,
    accessory: (acc?.accessory ?? "ninguno") as Avatar["accessory"],
    glasses: s.equipped.includes("lentes"),
  };
}
