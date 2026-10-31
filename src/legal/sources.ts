/**
 * MOTOR JURÍDICO — Gestión de fuentes.
 *
 * Política de fuentes de LEGAL LIFE:
 *  1. Cada referencia indica norma, artículo, jurisdicción, reformas y fuente oficial.
 *  2. El campo `contenido` es una PARÁFRASIS didáctica, nunca se presenta como texto literal.
 *     El texto literal se consulta en la fuente oficial enlazada.
 *  3. `verificacion.estado` dice honestamente si el contenido fue cotejado contra la fuente
 *     oficial. En esta versión NINGUNA referencia fue cotejada en línea contra InfoLEG
 *     (el entorno de desarrollo no tenía acceso), por eso todas figuran "pendiente".
 *  4. `nivel` distingue regla legal, criterio jurisprudencial y cuestión debatida.
 *  5. Montos y cifras que cambian por actualización NO se incorporan como dato cierto.
 */

export type VerificationState = "verificada" | "pendiente" | "discrepancia";
export type Nivel = "regla" | "criterio_jurisprudencial" | "debatido";
export type Jurisdiccion = "Nacional" | "CABA" | "Provincia de Buenos Aires" | "Otra provincia";

export interface LegalRef {
  id: string;
  norma: string;
  articulo: string;
  titulo: string;
  jurisdiccion: Jurisdiccion;
  materia: string;
  contenido: string;
  tipoContenido: "parafrasis";
  nivel: Nivel;
  reformas: string[];
  /** Fecha desde la cual el contenido descripto se considera aplicable (aprox.). */
  vigenteDesde?: string;
  fuenteOficial: { nombre: string; url: string };
  verificacion: { estado: VerificationState; revisado: string; detalle: string };
}

export const INFOLEG_11683 =
  "https://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/18771/texact.htm";
const ARG_GOB_11683 = "https://www.argentina.gob.ar/normativa/nacional/ley-11683-18771/actualizacion";
const SAIJ_CSJN = "https://sjconsulta.csjn.gov.ar/sjconsulta/";

const PENDIENTE = (detalle = "Paráfrasis no cotejada en línea contra el texto ordenado vigente.") => ({
  estado: "pendiente" as const,
  revisado: "2026-10-31",
  detalle,
});

export const LEGAL_REFS: LegalRef[] = [
  {
    id: "lpt-40",
    norma: "Ley 11.683 (t.o. 1998) — Procedimiento Tributario",
    articulo: "Art. 40",
    titulo: "Infracciones sancionadas con multa y clausura",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "Prevé multa y clausura del establecimiento (de 2 a 6 días según el texto posterior a la Ley 27.430) para quienes incurran en las conductas que enumera, entre ellas: no emitir facturas o comprobantes equivalentes en las formas y condiciones que establece el organismo recaudador; no llevar registraciones de compras o ventas; encargar o transportar mercadería sin respaldo documental; no estar inscripto estando obligado; no conservar comprobantes de adquisición; y no tener registrados a los trabajadores. Prevé además la duplicación de mínimos y máximos ante reincidencia dentro de los dos años.",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: ["Ley 27.430 (B.O. 29/12/2017)"],
    vigenteDesde: "2017-12-29",
    fuenteOficial: { nombre: "InfoLEG — texto actualizado", url: INFOLEG_11683 },
    verificacion: {
      estado: "discrepancia",
      revisado: "2026-10-31",
      detalle:
        "El MONTO de la multa y el UMBRAL del valor de la operación difieren entre versiones publicadas (se encontraron $10 y $20.000 en distintas fuentes secundarias). LEGAL LIFE no usa montos como dato cierto: verificar en el texto oficial vigente a la fecha de referencia.",
    },
  },
  {
    id: "lpt-41",
    norma: "Ley 11.683 (t.o. 1998)",
    articulo: "Art. 41",
    titulo: "Acta de comprobación y audiencia de descargo",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "Los hechos u omisiones del art. 40 deben constar en un acta de comprobación labrada por los funcionarios fiscales, que deja constancia de las circunstancias, su prueba y su encuadramiento legal, y contiene una citación para que el responsable, con las pruebas de que intente valerse, comparezca a una audiencia de defensa fijada en una fecha no anterior a 5 días ni superior a 15 días. El acta debe ser firmada por los actuantes y notificada al responsable. Tras la audiencia, el juez administrativo se pronuncia sobre la multa y la clausura en un plazo breve (2 días).",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: ["Leyes 24.765 y 27.430 (verificar redacción vigente)"],
    fuenteOficial: { nombre: "InfoLEG — texto actualizado", url: INFOLEG_11683 },
    verificacion: PENDIENTE(),
  },
  {
    id: "lpt-41-plazos",
    norma: "Ley 11.683 — jurisprudencia sobre art. 41",
    articulo: "Art. 41 (plazos)",
    titulo: "¿Son perentorios los plazos de la audiencia?",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "Existen pronunciamientos de la Cámara en lo Penal Económico que consideraron que los plazos de los arts. 41 y 77 no son perentorios sino ordenatorios. Por eso, la mera irregularidad en la fijación de la audiencia no conduce automáticamente a la nulidad: la defensa debe demostrar el perjuicio concreto al derecho de defensa (principio de trascendencia). La cuestión no es pacífica.",
    tipoContenido: "parafrasis",
    nivel: "debatido",
    reformas: [],
    fuenteOficial: { nombre: "Sistema de consulta de jurisprudencia CSJN / PJN", url: SAIJ_CSJN },
    verificacion: PENDIENTE("Criterio identificado en fallos de 2020 citados por fuentes secundarias; no se incorporó cita de expediente verificada."),
  },
  {
    id: "lpt-4",
    norma: "Ley 11.683 (t.o. 1998)",
    articulo: "Art. 4",
    titulo: "Cómputo de plazos",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "Los plazos establecidos en días en la ley de procedimiento tributario se computan en días hábiles administrativos.",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: [],
    fuenteOficial: { nombre: "InfoLEG — texto actualizado", url: INFOLEG_11683 },
    verificacion: PENDIENTE(),
  },
  {
    id: "lpt-35f",
    norma: "Ley 11.683 (t.o. 1998)",
    articulo: "Art. 35 inc. f)",
    titulo: "Clausura preventiva",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "Faculta al organismo a clausurar preventivamente un establecimiento cuando el funcionario constate la configuración de alguno de los hechos del art. 40 y concurra un grave perjuicio o el responsable registre antecedentes. La clausura preventiva debe ser comunicada de inmediato al juez (federal o penal económico) para que la confirme o la deje sin efecto. Es una figura distinta de la clausura como sanción del art. 40.",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: ["Verificar redacción vigente"],
    fuenteOficial: { nombre: "InfoLEG — texto actualizado", url: INFOLEG_11683 },
    verificacion: PENDIENTE(),
  },
  {
    id: "lpt-44",
    norma: "Ley 11.683 (t.o. 1998)",
    articulo: "Art. 44",
    titulo: "Quebrantamiento de la clausura",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "Quien quebrante una clausura o viole los precintos o sellos puestos por el organismo es pasible de arresto y de un nuevo período de clausura por el doble de tiempo de la impuesta oportunamente.",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: [],
    fuenteOficial: { nombre: "InfoLEG — texto actualizado", url: INFOLEG_11683 },
    verificacion: PENDIENTE(),
  },
  {
    id: "lpt-76",
    norma: "Ley 11.683 (t.o. 1998)",
    articulo: "Art. 76",
    titulo: "Recursos contra determinaciones y multas (reconsideración / Tribunal Fiscal)",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "Regula la vía recursiva general contra resoluciones que determinan tributos o imponen multas: recurso de reconsideración ante el superior o apelación ante el Tribunal Fiscal de la Nación. Las sanciones de clausura NO siguen esta vía: tienen un régimen recursivo propio (arts. 77 y 78).",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: [],
    fuenteOficial: { nombre: "InfoLEG — texto actualizado", url: INFOLEG_11683 },
    verificacion: PENDIENTE(),
  },
  {
    id: "lpt-77",
    norma: "Ley 11.683 (t.o. 1998)",
    articulo: "Art. 77",
    titulo: "Apelación administrativa contra la clausura",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "Las sanciones de clausura (y de multa impuestas conjuntamente) son recurribles mediante apelación administrativa ante los funcionarios superiores que designe el organismo recaudador, dentro de los 5 días de notificada la resolución. El superior debe expedirse en un plazo breve (10 días).",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: ["Verificar redacción vigente"],
    fuenteOficial: { nombre: "InfoLEG — texto actualizado", url: INFOLEG_11683 },
    verificacion: PENDIENTE(),
  },
  {
    id: "lpt-78",
    norma: "Ley 11.683 (t.o. 1998)",
    articulo: "Art. 78",
    titulo: "Recurso judicial contra la clausura",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "La resolución que resuelve la apelación administrativa puede recurrirse judicialmente ante los juzgados en lo penal económico de la Ciudad de Buenos Aires o los juzgados federales en el resto del país, dentro de los 5 días de notificada. El recurso se interpone y funda ante el propio organismo, que eleva las actuaciones al juez.",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: ["Verificar redacción vigente y el efecto con que se concede el recurso"],
    fuenteOficial: { nombre: "InfoLEG — texto actualizado", url: INFOLEG_11683 },
    verificacion: PENDIENTE("El efecto (devolutivo o suspensivo) del recurso debe verificarse en el texto vigente y leerse junto con la doctrina de 'Lapiduz'."),
  },
  {
    id: "csjn-lapiduz",
    norma: "CSJN, \"Lapiduz, Enrique c/ DGI s/ acción de amparo\"",
    articulo: "Fallos 321:1043 (28/04/1998)",
    titulo: "Naturaleza penal de la clausura y control judicial previo",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "La Corte Suprema sostuvo que la clausura tiene naturaleza penal y que el control judicial suficiente exige que pueda ser revisada por un juez antes de su ejecución; por eso consideró inconstitucional que se ejecutara sin esa revisión previa.",
    tipoContenido: "parafrasis",
    nivel: "criterio_jurisprudencial",
    reformas: [],
    fuenteOficial: { nombre: "CSJN — consulta de fallos", url: SAIJ_CSJN },
    verificacion: PENDIENTE("Cita (Fallos 321:1043) a cotejar en la base oficial de la CSJN."),
  },
  {
    id: "dto-953-2024",
    norma: "Decreto 953/2024",
    articulo: "Arts. 1 y ss.",
    titulo: "Creación de ARCA (sucesora de la AFIP)",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "Disolvió la AFIP y creó la Agencia de Recaudación y Control Aduanero (ARCA), que asume sus funciones. Las menciones a la AFIP en la Ley 11.683 deben entenderse referidas a ARCA.",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: [],
    vigenteDesde: "2024-10-24",
    fuenteOficial: { nombre: "Boletín Oficial", url: "https://www.boletinoficial.gob.ar/" },
    verificacion: PENDIENTE(),
  },
  {
    id: "cn-18",
    norma: "Constitución Nacional",
    articulo: "Art. 18",
    titulo: "Debido proceso y defensa en juicio",
    jurisdiccion: "Nacional",
    materia: "Derecho Constitucional",
    contenido:
      "Garantiza la inviolabilidad de la defensa en juicio de la persona y de los derechos. Fundamento de la exigencia de audiencia de descargo y de control judicial suficiente de las sanciones administrativas.",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: [],
    fuenteOficial: { nombre: "InfoLEG — Constitución Nacional", url: "https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/804/norma.htm" },
    verificacion: PENDIENTE(),
  },
  {
    id: "lpt-35",
    norma: "Ley 11.683 (t.o. 1998)",
    articulo: "Art. 35",
    titulo: "Facultades de verificación y fiscalización",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "Otorga al organismo recaudador amplias facultades de verificación y fiscalización: citar a responsables, exigir la exhibición de libros y comprobantes, inspeccionar establecimientos y labrar actas, entre otras. Incluye la posibilidad de que los agentes actúen como compradores para verificar el cumplimiento de la obligación de emitir comprobantes.",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: ["Verificar incisos vigentes"],
    fuenteOficial: { nombre: "InfoLEG — texto actualizado", url: INFOLEG_11683 },
    verificacion: PENDIENTE(),
  },
  {
    id: "cn-43",
    norma: "Constitución Nacional",
    articulo: "Art. 43",
    titulo: "Acción de amparo",
    jurisdiccion: "Nacional",
    materia: "Derecho Constitucional",
    contenido:
      "Habilita la acción expedita y rápida de amparo contra actos u omisiones de autoridad que lesionen con arbitrariedad o ilegalidad manifiesta derechos constitucionales, siempre que no exista otro medio judicial más idóneo.",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: ["Reforma constitucional de 1994"],
    fuenteOficial: { nombre: "InfoLEG — Constitución Nacional", url: "https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/804/norma.htm" },
    verificacion: PENDIENTE(),
  },
  {
    id: "lpt-ilicitos",
    norma: "Ley 11.683 (t.o. 1998)",
    articulo: "Arts. 38 a 50 (aprox.)",
    titulo: "Infracciones formales y materiales",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "La ley de procedimiento regula las infracciones tributarias: formales (incumplimiento de deberes formales, p. ej. arts. 38, 39 y 40) y materiales (omisión de impuestos, art. 45; defraudación, art. 46). Su aplicación corresponde al organismo recaudador por medio del juez administrativo.",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: ["Ley 27.430"],
    fuenteOficial: { nombre: "InfoLEG — texto actualizado", url: INFOLEG_11683 },
    verificacion: PENDIENTE("La numeración exacta del bloque de infracciones debe cotejarse con el texto vigente."),
  },
  {
    id: "rpt",
    norma: "Régimen Penal Tributario (Ley 27.430, Título IX)",
    articulo: "Arts. 1 y 2",
    titulo: "Evasión simple y agravada",
    jurisdiccion: "Nacional",
    materia: "Derecho Tributario",
    contenido:
      "Tipifica como delito la evasión mediante declaraciones engañosas, ocultaciones maliciosas u otro ardid, cuando el monto evadido supera el umbral legal por tributo y período (evasión simple), y prevé figuras agravadas (montos mayores, interposición de personas, facturas apócrifas, etc.). Los delitos son juzgados por el Poder Judicial, no por el organismo recaudador.",
    tipoContenido: "parafrasis",
    nivel: "regla",
    reformas: ["Los umbrales se actualizan: no se incorporan como dato"],
    fuenteOficial: { nombre: "InfoLEG — Ley 27.430", url: "https://servicios.infoleg.gob.ar/infolegInternet/anexos/305000-309999/305262/texact.htm" },
    verificacion: PENDIENTE(),
  },
];

export const OFFICIAL_SOURCES = [
  { nombre: "Boletín Oficial de la República Argentina", url: "https://www.boletinoficial.gob.ar/" },
  { nombre: "InfoLEG", url: "https://www.infoleg.gob.ar/" },
  { nombre: "Argentina.gob.ar — Normativa", url: "https://www.argentina.gob.ar/normativa" },
  { nombre: "Ley 11.683 — texto actualizado (argentina.gob.ar)", url: ARG_GOB_11683 },
  { nombre: "Poder Judicial de la Nación", url: "https://www.pjn.gov.ar/" },
  { nombre: "CSJN — Consulta de jurisprudencia", url: SAIJ_CSJN },
];

export function getRef(id: string): LegalRef {
  const r = LEGAL_REFS.find((x) => x.id === id);
  if (!r) throw new Error(`Referencia jurídica inexistente: ${id}`);
  return r;
}

export function refLabel(r: LegalRef): string {
  return `${r.articulo} — ${r.norma}`;
}

export interface ReferenceContext {
  jurisdiccion: Jurisdiccion;
  fechaReferencia: string; // ISO yyyy-mm-dd
}

/** Advertencias que el motor muestra al consultar una referencia en un contexto dado. */
export function refWarnings(r: LegalRef, ctx: ReferenceContext): string[] {
  const w: string[] = [];
  if (r.verificacion.estado === "pendiente")
    w.push("Vigencia y texto no verificados contra la fuente oficial: consultá el enlace antes de citarlo.");
  if (r.verificacion.estado === "discrepancia") w.push(`Discrepancia entre fuentes: ${r.verificacion.detalle}`);
  if (r.nivel === "debatido") w.push("Cuestión debatida: no es una regla indiscutida.");
  if (r.nivel === "criterio_jurisprudencial") w.push("Criterio jurisprudencial: su alcance puede variar según el caso.");
  if (r.vigenteDesde && ctx.fechaReferencia < r.vigenteDesde)
    w.push(`La fecha de referencia (${ctx.fechaReferencia}) es anterior a ${r.vigenteDesde}: el contenido descripto podría no ser aplicable.`);
  if (ctx.fechaReferencia > r.verificacion.revisado)
    w.push(`La fecha de referencia es posterior a la última revisión (${r.verificacion.revisado}): pudo haber reformas posteriores.`);
  if (ctx.jurisdiccion !== r.jurisdiccion && r.jurisdiccion === "Nacional" && ctx.jurisdiccion !== "Nacional")
    w.push(`Norma de alcance nacional. Para ${ctx.jurisdiccion} pueden regir además normas locales que LEGAL LIFE todavía no tiene cargadas.`);
  return w;
}
