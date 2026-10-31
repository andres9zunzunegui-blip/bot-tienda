/** Catálogo de materias y temas. Los temas de material cargado se agregan dinámicamente ("mat:<id>"). */

export interface Subject {
  id: string;
  name: string;
  status: "con-contenido" | "solo-material";
}

export const SUBJECTS: Subject[] = [
  { id: "tributario", name: "Derecho Tributario", status: "con-contenido" },
  { id: "civil", name: "Derecho Civil", status: "solo-material" },
  { id: "procesal", name: "Derecho Procesal", status: "solo-material" },
  { id: "administrativo", name: "Derecho Administrativo", status: "solo-material" },
  { id: "constitucional", name: "Derecho Constitucional", status: "solo-material" },
  { id: "consumidor", name: "Derecho del Consumidor", status: "solo-material" },
  { id: "dipr", name: "Derecho Internacional Privado", status: "solo-material" },
  { id: "comercial", name: "Derecho Comercial", status: "solo-material" },
];

export const TOPICS: Record<string, { name: string; subject: string }> = {
  "trib.clausura": { name: "Clausura (Ley 11.683)", subject: "tributario" },
  "trib.procedimiento-clausura": { name: "Procedimiento de clausura: acta y audiencia", subject: "tributario" },
  "trib.recursos-clausura": { name: "Recursos contra la clausura", subject: "tributario" },
  "trib.ilicitos": { name: "Ilícitos tributarios", subject: "tributario" },
  "trib.infracciones": { name: "Infracciones formales y materiales", subject: "tributario" },
  "trib.delitos": { name: "Delitos tributarios", subject: "tributario" },
  "trib.organos": { name: "Órganos: ARCA, juez administrativo, TFN", subject: "tributario" },
  "trib.determinacion": { name: "Determinación de oficio", subject: "tributario" },
  "trib.ejecucion": { name: "Ejecución fiscal", subject: "tributario" },
  "const.defensa": { name: "Debido proceso y defensa en juicio", subject: "constitucional" },
};

export function topicName(id: string, materials: { id: string; name: string }[] = []): string {
  if (TOPICS[id]) return TOPICS[id].name;
  if (id.startsWith("mat:")) {
    const m = materials.find((x) => `mat:${x.id}` === id);
    return m ? `Material: ${m.name}` : "Material cargado";
  }
  return id;
}
