/** Tarjetas de recuperación activa derivadas del contenido de referencia. */
import { CLAUSURA } from "../content/clausura.ts";
import { ORAL_BANK } from "../content/oralBank.ts";
import { TRIBUTARIO_MAP } from "../content/tributarioMap.ts";
import type { MemoryCard } from "../core/state.ts";
import { newCard } from "./memory.ts";

export function contentCardsFor(topic: string, now = Date.now()): MemoryCard[] {
  const cards: MemoryCard[] = [];
  for (const n of TRIBUTARIO_MAP.nodes)
    if (n.topic === topic && n.id !== TRIBUTARIO_MAP.root)
      cards.push(newCard(`map:${n.id}`, topic, `Definí: ${n.label}`, n.info.explicacion, "contenido", now));
  for (const q of ORAL_BANK) if (q.topic === topic) cards.push(newCard(`oral:${q.id}`, topic, q.question, q.modelAnswer, "contenido", now));
  for (const st of Object.values(CLAUSURA.stages)) {
    if (st.topic !== topic || !st.choices || st.kind !== "single") continue;
    const best = st.choices.find((c) => c.quality === 1);
    if (best) cards.push(newCard(`sim:${st.id}`, topic, `Caso clausura — ${st.prompt}`, best.text, "contenido", now));
  }
  return cards;
}
