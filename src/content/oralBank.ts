/** Banco de preguntas para exámenes orales y audiencias (Derecho Tributario). */
import type { KeyPoint } from "../modules/oral/localEvaluator.ts";

export interface OralQuestion {
  id: string;
  topic: string;
  role: "profesor" | "juez";
  question: string;
  keyPoints: KeyPoint[];
  legalBasis: string[];
  modelAnswer: string;
}

const ART = (n: string) => `art(iculo|\\.)? ?${n}`;

export const ORAL_BANK: OralQuestion[] = [
  {
    id: "elementos-ilicito",
    topic: "trib.ilicitos",
    role: "profesor",
    question: "¿Cuáles son los elementos constitutivos del ilícito tributario?",
    keyPoints: [
      { id: "conducta", label: "Conducta (acción u omisión)", groups: [["accion", "omision", "conducta", "comportamiento"]], criterio: "precision", followUp: "¿El ilícito tributario puede cometerse por omisión? Dé un ejemplo." },
      { id: "tipicidad", label: "Tipicidad: descripción legal previa", groups: [["tipic", "descript[ao] (en|por) la ley", "previsto en la ley", "legalidad", "ley previa"]], criterio: "precision", followUp: "¿Qué exige el principio de tipicidad en materia infraccional tributaria?" },
      { id: "antijuridicidad", label: "Antijuridicidad", groups: [["antijuridic", "contrari[ao] al (derecho|ordenamiento)", "ilicitud"]], criterio: "precision", followUp: "¿Puede haber causas de justificación en un ilícito tributario?" },
      { id: "culpabilidad", label: "Culpabilidad (dolo o culpa); rechazo de la responsabilidad objetiva", groups: [["culpab", "dolo", "culpa", "subjetiv", "reproch"]], criterio: "fundamentacion", followUp: "¿Rige el principio de culpabilidad en las infracciones formales, o la responsabilidad es objetiva?" },
      { id: "sancion", label: "Sanción prevista", groups: [["sancion", "pena", "multa", "clausura"]], criterio: "relacion" },
      { id: "infraccion-delito", label: "Distinción infracción / delito", groups: [["infraccion"], ["delito"]], criterio: "relacion", followUp: "¿Qué diferencia hay entre una infracción y un delito tributario?" },
    ],
    legalBasis: [
      "Ley 11.683, régimen de infracciones (paráfrasis, verificar)",
      "CSJN, \"Parafina del Plata S.A.\" (1968), sobre la exigencia de culpabilidad en las infracciones tributarias — cita a verificar",
      "Régimen Penal Tributario (Ley 27.430, Título IX)",
    ],
    modelAnswer:
      "El ilícito tributario requiere una conducta humana (acción u omisión) típica —descripta previamente por la ley—, antijurídica y culpable, a la que la ley asigna una sanción. Por su naturaleza penal rige el principio de culpabilidad: la jurisprudencia de la CSJN rechazó la responsabilidad puramente objetiva. Los ilícitos se dividen en infracciones (aplicadas por el organismo recaudador) y delitos (Régimen Penal Tributario, juzgados por el Poder Judicial).",
  },
  {
    id: "procedimiento-clausura",
    topic: "trib.procedimiento-clausura",
    role: "profesor",
    question: "Explique el procedimiento de clausura de la Ley 11.683, desde el acta hasta la revisión judicial.",
    keyPoints: [
      { id: "acta", label: "Acta de comprobación con hechos, prueba y encuadre legal (art. 41)", groups: [["acta"], ["comprobacion", "hechos", "encuadre", ART("41")]], criterio: "precision", followUp: "¿Qué debe contener el acta de comprobación?" },
      { id: "audiencia", label: "Audiencia de descargo entre 5 y 15 días", groups: [["audiencia", "descargo"], ["(5|cinco)", "(15|quince)"]], criterio: "precision", followUp: "¿Entre qué plazos debe fijarse la audiencia de descargo?" },
      { id: "juez", label: "Resuelve el juez administrativo", groups: [["juez administrativo"]], criterio: "relacion", followUp: "¿Quién resuelve la aplicación de la clausura en sede administrativa?" },
      { id: "art77", label: "Apelación administrativa ante el superior (art. 77, 5 días)", groups: [["apelacion administrativa", ART("77"), "superior"]], criterio: "fundamentacion", followUp: "¿Qué recurso procede contra la resolución que impone la clausura y en qué plazo?" },
      { id: "art78", label: "Recurso judicial: penal económico (CABA) o federal (art. 78)", groups: [["penal economico", "federal", ART("78"), "judicial"]], criterio: "fundamentacion", followUp: "¿Ante qué juez se recurre judicialmente y cómo se interpone el recurso?" },
      { id: "habiles", label: "Plazos en días hábiles administrativos", groups: [["habiles"]], criterio: "terminologia" },
    ],
    legalBasis: ["Ley 11.683 arts. 4, 40, 41, 77 y 78 (paráfrasis, verificar)"],
    modelAnswer:
      "Los funcionarios labran un acta de comprobación con los hechos, la prueba y el encuadre (art. 41), citando al responsable a una audiencia de defensa no antes de 5 ni después de 15 días. El juez administrativo resuelve en un plazo breve. La resolución es apelable administrativamente ante el superior dentro de 5 días (art. 77) y lo que éste resuelva, mediante recurso judicial ante los juzgados en lo penal económico (CABA) o federales, interpuesto ante el organismo dentro de 5 días (art. 78). Los plazos son en días hábiles administrativos.",
  },
  {
    id: "preventiva-vs-sancion",
    topic: "trib.clausura",
    role: "profesor",
    question: "¿Qué diferencia hay entre la clausura preventiva y la clausura como sanción?",
    keyPoints: [
      { id: "prev-norma", label: "La preventiva está en el art. 35 inc. f)", groups: [["preventiva"], [ART("35"), "inciso f", "inc\\.? ?f"]], criterio: "fundamentacion" },
      { id: "prev-req", label: "Requisitos de la preventiva: hecho del art. 40 + grave perjuicio o antecedentes", groups: [["grave perjuicio", "antecedentes", "reincid"]], criterio: "precision", followUp: "¿Qué requisitos exige la clausura preventiva además del hecho del art. 40?" },
      { id: "prev-juez", label: "Comunicación inmediata al juez para que la confirme o la deje sin efecto", groups: [["juez"], ["comunic", "confirm", "inmediat", "control"]], criterio: "relacion", followUp: "¿Qué control judicial tiene la clausura preventiva?" },
      { id: "sancion", label: "La sanción del art. 40 se aplica tras el procedimiento del art. 41", groups: [["sancion"], [ART("40"), ART("41"), "procedimiento", "audiencia"]], criterio: "precision" },
      { id: "naturaleza", label: "Naturaleza: cautelar vs. punitiva", groups: [["cautelar", "preventiv", "precautori"], ["penal", "punitiv", "sancion"]], criterio: "relacion" },
    ],
    legalBasis: ["Ley 11.683 art. 35 inc. f), art. 40 y art. 41 (paráfrasis, verificar)"],
    modelAnswer:
      "La clausura preventiva (art. 35 inc. f) es una medida cautelar que el funcionario puede disponer al constatar un hecho del art. 40 cuando concurre grave perjuicio o antecedentes, y debe comunicarse de inmediato al juez para que la confirme o la deje sin efecto. La clausura del art. 40 es una sanción de naturaleza penal que se impone tras el procedimiento del art. 41 (acta, audiencia y resolución del juez administrativo) y es recurrible por los arts. 77 y 78.",
  },
  {
    id: "formales-materiales",
    topic: "trib.infracciones",
    role: "profesor",
    question: "Distinga las infracciones formales de las materiales y dé ejemplos.",
    keyPoints: [
      { id: "formales", label: "Formales: incumplimiento de deberes formales", groups: [["formal"], ["deber", "obligacion", "informar", "facturar", "presentar"]], criterio: "precision" },
      { id: "materiales", label: "Materiales: afectan la recaudación (omisión, defraudación)", groups: [["material"], ["omision", "defraud", "recaudacion", "impuesto", "perjuicio fiscal"]], criterio: "precision", followUp: "¿Qué infracciones materiales prevé la Ley 11.683?" },
      { id: "ejemplos", label: "Ejemplos concretos", groups: [["factura", "declaracion jurada", "inscri", "registr"]], criterio: "relacion" },
      { id: "defraudacion", label: "La defraudación exige ardid o engaño (dolo)", groups: [["defraud"], ["ardid", "engan", "dolo"]], criterio: "precision", followUp: "¿Qué distingue a la defraudación de la omisión?" },
      { id: "normas", label: "Cita normativa (arts. 38-40, 45, 46)", groups: [[ART("3[89]"), ART("40"), ART("45"), ART("46")]], criterio: "fundamentacion" },
    ],
    legalBasis: ["Ley 11.683 arts. 38, 39, 40, 45 y 46 (paráfrasis, verificar numeración vigente)"],
    modelAnswer:
      "Las infracciones formales sancionan el incumplimiento de deberes formales (presentar declaraciones, facturar, inscribirse; arts. 38 a 40). Las materiales afectan la recaudación: la omisión de impuestos (art. 45), de base culposa, y la defraudación (art. 46), que requiere ardid o engaño.",
  },
  {
    id: "omision-evasion",
    topic: "trib.delitos",
    role: "profesor",
    question: "¿Qué diferencia hay entre la omisión de impuestos y la evasión simple?",
    keyPoints: [
      { id: "omision", label: "Omisión: infracción material de la Ley 11.683", groups: [["omision"], ["infraccion", ART("45")]], criterio: "precision" },
      { id: "evasion", label: "Evasión: delito del Régimen Penal Tributario", groups: [["evasion"], ["delito", "penal"]], criterio: "precision" },
      { id: "ardid", label: "La evasión exige ardid o engaño", groups: [["ardid", "engan", "ocultac", "maliciosa"]], criterio: "precision", followUp: "¿Qué elemento subjetivo y modal exige la evasión?" },
      { id: "umbral", label: "La evasión exige superar un umbral de monto", groups: [["umbral", "monto", "condicion objetiva"]], criterio: "precision", followUp: "¿Existe un monto mínimo para que haya evasión?" },
      { id: "autoridad", label: "Autoridad: organismo/juez administrativo vs. Poder Judicial", groups: [["juez administrativo", "organismo", "arca", "afip"], ["judicial", "juez penal", "penal economico", "federal"]], criterio: "relacion", followUp: "¿Quién juzga cada figura?" },
    ],
    legalBasis: ["Ley 11.683 art. 45 (paráfrasis)", "Régimen Penal Tributario art. 1 (umbral actualizable: verificar)"],
    modelAnswer:
      "La omisión es una infracción material de la Ley 11.683 (art. 45), que no requiere ardid, sancionada con multa por el organismo. La evasión simple es un delito del Régimen Penal Tributario: exige declaraciones engañosas, ocultaciones maliciosas u otro ardid y superar un umbral de monto; la juzga el Poder Judicial y prevé pena de prisión.",
  },
  {
    id: "juez-tfn-clausura",
    topic: "trib.recursos-clausura",
    role: "juez",
    question: "Doctor/a, fundamente por qué no corresponde llevar esta clausura ante el Tribunal Fiscal de la Nación.",
    keyPoints: [
      { id: "regimen", label: "Régimen recursivo específico: arts. 77 y 78", groups: [[ART("77"), ART("78"), "especific", "propio"]], criterio: "fundamentacion" },
      { id: "art76", label: "El art. 76 rige para determinaciones y multas", groups: [[ART("76"), "determinacion", "tribunal fiscal"]], criterio: "relacion", followUp: "¿Para qué actos está prevista la vía del art. 76?" },
      { id: "naturaleza", label: "Naturaleza penal de la clausura", groups: [["penal"]], criterio: "precision", followUp: "¿Qué naturaleza le asigna la Corte a la clausura?" },
      { id: "juez", label: "Revisión por juez penal económico / federal", groups: [["penal economico", "federal"]], criterio: "precision" },
    ],
    legalBasis: ["Ley 11.683 arts. 76, 77 y 78 (paráfrasis)", "CSJN \"Lapiduz\" (1998)"],
    modelAnswer:
      "Porque la clausura tiene un régimen recursivo propio: apelación administrativa ante el superior (art. 77) y recurso judicial ante el fuero penal económico o federal (art. 78). La vía del art. 76 (reconsideración o Tribunal Fiscal) está prevista para determinaciones de tributos y multas. Además, la naturaleza penal de la clausura justifica su revisión por jueces del fuero penal.",
  },
];

/** Nota universitaria argentina (1-10) a partir de la calidad 0..1. Aprobado = 4 (60 %). */
export function notaFromQuality(q: number): number {
  if (q < 0.6) return Math.max(1, Math.round((q / 0.6) * 3));
  return Math.min(10, 4 + Math.round(((q - 0.6) / 0.4) * 6));
}
