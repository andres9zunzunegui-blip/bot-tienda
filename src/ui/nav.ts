/** Registro de pantallas: evita dependencias circulares entre módulos de interfaz. */
export type ScreenId =
  | "study"
  | "simulations"
  | "maps"
  | "exams"
  | "progress"
  | "inventory"
  | "character"
  | "library"
  | "missions"
  | "memory"
  | "materials"
  | "upload"
  | "cases";

const registry = new Map<ScreenId, (arg?: unknown) => void>();

export function registerScreen(id: ScreenId, open: (arg?: unknown) => void) {
  registry.set(id, open);
}

export function go(id: ScreenId, arg?: unknown) {
  const fn = registry.get(id);
  if (!fn) throw new Error(`Pantalla no registrada: ${id}`);
  fn(arg);
}
