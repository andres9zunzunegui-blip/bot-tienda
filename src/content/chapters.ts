/**
 * CAPÍTULOS DE TEORÍA en formato reel (vertical, animado, con mini-preguntas).
 * El contenido es coherente con src/legal/sources.ts: son paráfrasis didácticas
 * y cada reel cita sus referencias, que conservan su estado de verificación.
 */

interface Base {
  refs?: string[];
}

export type Reel = Base &
  (
    | { kind: "intro"; title: string; words: string[]; caption: string }
    | { kind: "lista"; title: string; items: { icon: string; text: string }[]; caption: string }
    | { kind: "comparar"; title: string; left: { title: string; items: string[] }; right: { title: string; items: string[] }; caption: string }
    | { kind: "linea"; title: string; steps: { label: string; sub: string }[]; caption: string }
    | { kind: "dato"; title: string; big: string; unit: string; caption: string }
    | { kind: "caso"; title: string; lines: { who: string; name: string; text: string }[]; caption: string }
    | { kind: "alerta"; title: string; text: string; caption: string }
    | { kind: "calendario"; title: string; days: { label: string; mark: "acta" | "habil" | "finde" | "audiencia" | "minimo" }[]; caption: string }
    | { kind: "check"; question: string; options: string[]; correct: number; explain: string }
  );

export interface Chapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  topic: string;
  /** Temas cuyo dominio alimenta este capítulo. */
  topics: string[];
  color: string;
  reels: Reel[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: "cap1",
    number: 1,
    title: "Ilícitos tributarios",
    subtitle: "Elementos, infracciones y delitos",
    topic: "trib.ilicitos",
    topics: ["trib.ilicitos", "trib.infracciones", "trib.delitos"],
    color: "#3c5a8a",
    reels: [
      {
        kind: "intro",
        title: "¿Qué es un ilícito tributario?",
        words: ["Una conducta", "típica,", "antijurídica", "y culpable", "que la ley sanciona."],
        caption: "Antes de defender a nadie, necesitás saber qué se le imputa. Todo ilícito tributario reúne estos elementos.",
        refs: ["lpt-ilicitos"],
      },
      {
        kind: "lista",
        title: "Los elementos, uno por uno",
        items: [
          { icon: "🏃", text: "Conducta: una acción o una omisión humana." },
          { icon: "📜", text: "Tipicidad: una ley previa la describe." },
          { icon: "⚠️", text: "Antijuridicidad: contradice el ordenamiento." },
          { icon: "🧠", text: "Culpabilidad: dolo o culpa del autor." },
          { icon: "🔨", text: "Sanción: la consecuencia que fija la ley." },
        ],
        caption: "La jurisprudencia de la Corte rechazó la responsabilidad puramente objetiva en las infracciones tributarias: hace falta culpabilidad (cita a verificar: \"Parafina del Plata\", 1968).",
        refs: ["lpt-ilicitos"],
      },
      {
        kind: "comparar",
        title: "Infracción vs. delito",
        left: { title: "Infracción", items: ["Ley 11.683", "La aplica el organismo (juez administrativo)", "Multa, clausura"] },
        right: { title: "Delito", items: ["Régimen Penal Tributario", "Lo juzga el Poder Judicial", "Prisión"] },
        caption: "Misma familia, mundos distintos: cambia la norma, la autoridad y la sanción.",
        refs: ["lpt-ilicitos", "rpt"],
      },
      {
        kind: "check",
        question: "Un comercio vende sin emitir factura. ¿Qué es, en principio?",
        options: ["Un delito de evasión simple", "Una infracción formal", "Una infracción material"],
        correct: 1,
        explain: "Es el incumplimiento de un deber formal (emitir comprobantes). La evasión exige ardid y superar un umbral.",
      },
      {
        kind: "comparar",
        title: "Formales vs. materiales",
        left: { title: "Formales", items: ["Incumplen deberes formales", "No facturar, no inscribirse", "No presentar declaraciones"] },
        right: { title: "Materiales", items: ["Afectan la recaudación", "Omisión de impuestos", "Defraudación (con ardid)"] },
        caption: "Las formales castigan el desorden; las materiales, el impuesto que no entró.",
        refs: ["lpt-ilicitos", "lpt-40"],
      },
      {
        kind: "comparar",
        title: "Omisión vs. evasión simple",
        left: { title: "Omisión", items: ["Infracción material", "No requiere ardid", "Multa del organismo"] },
        right: { title: "Evasión simple", items: ["Delito", "Ardid o engaño + umbral", "Juez penal, prisión"] },
        caption: "La frontera está en el engaño y en el monto. Por eso es una de las preguntas favoritas de examen.",
        refs: ["rpt"],
      },
      {
        kind: "alerta",
        title: "Cuidado con los montos",
        text: "Los umbrales de la evasión y las multas se actualizan. LEGAL LIFE no te pide memorizar cifras: verificá siempre el texto vigente.",
        caption: "En un examen, mejor decir \"supera el umbral legal vigente\" que inventar un número.",
        refs: ["rpt"],
      },
      {
        kind: "check",
        question: "¿Qué exige la evasión simple que la omisión no exige?",
        options: ["Que haya una deuda tributaria", "Ardid o engaño y superar un umbral", "Que lo detecte un inspector"],
        correct: 1,
        explain: "La evasión es un delito: requiere un ardid y que el monto evadido supere el umbral legal.",
      },
    ],
  },
  {
    id: "cap2",
    number: 2,
    title: "La clausura",
    subtitle: "Artículo 40 de la Ley 11.683",
    topic: "trib.clausura",
    topics: ["trib.clausura"],
    color: "#7a5a17",
    reels: [
      {
        kind: "intro",
        title: "Cerrar un comercio como castigo",
        words: ["Multa", "+", "clausura", "del establecimiento."],
        caption: "La clausura es la sanción más temida por un comerciante: su local queda cerrado. Está en el art. 40 de la Ley 11.683.",
        refs: ["lpt-40"],
      },
      {
        kind: "dato",
        title: "¿Cuánto dura?",
        big: "2 a 6",
        unit: "días de clausura",
        caption: "Junto con una multa. Es la escala posterior a la Ley 27.430; el texto anterior decía 3 a 10 días. Verificá siempre la versión vigente.",
        refs: ["lpt-40"],
      },
      {
        kind: "lista",
        title: "Conductas que la provocan",
        items: [
          { icon: "🧾", text: "No emitir facturas o comprobantes." },
          { icon: "📒", text: "No registrar compras o ventas." },
          { icon: "🚚", text: "Transportar mercadería sin respaldo." },
          { icon: "🪪", text: "No estar inscripto estando obligado." },
          { icon: "🗂️", text: "No conservar comprobantes de compra." },
          { icon: "👷", text: "No registrar a los trabajadores." },
        ],
        caption: "Paráfrasis del art. 40: no es el texto literal. Consultá la fuente oficial antes de citar.",
        refs: ["lpt-40"],
      },
      {
        kind: "alerta",
        title: "Reincidencia",
        text: "Si se comete otra infracción del art. 40 dentro de los 2 años, se duplican los mínimos y los máximos de la sanción.",
        caption: "Por eso en una defensa siempre se revisan los antecedentes: su ausencia sirve para pedir el mínimo.",
        refs: ["lpt-40"],
      },
      {
        kind: "check",
        question: "Según el texto posterior a la Ley 27.430, ¿qué escala de clausura prevé el art. 40?",
        options: ["De 3 a 10 días", "De 2 a 6 días", "De 30 a 60 días"],
        correct: 1,
        explain: "2 a 6 días. La escala de 3 a 10 días es la del texto anterior: un error típico es citar una versión derogada.",
      },
      {
        kind: "comparar",
        title: "Preventiva vs. sanción",
        left: { title: "Preventiva (art. 35 f)", items: ["Medida cautelar", "Grave perjuicio o antecedentes", "Aviso inmediato al juez"] },
        right: { title: "Sanción (art. 40)", items: ["Pena de naturaleza penal", "Tras acta y audiencia", "Recurrible (arts. 77 y 78)"] },
        caption: "Son figuras distintas. Confundirlas en un examen oral es muy común.",
        refs: ["lpt-35f", "lpt-40"],
      },
      {
        kind: "caso",
        title: "¿Y si reabro igual?",
        lines: [
          { who: "👩", name: "Marta", text: "Si me clausuran, abro por la puerta de atrás." },
          { who: "🧑‍⚖️", name: "Vos", text: "No. Eso es quebrantar la clausura (art. 44)." },
          { who: "📕", name: "Ley", text: "Arresto y nueva clausura por el doble de tiempo." },
        ],
        caption: "Quebrantar la clausura es una infracción autónoma y más grave. Un buen defensor jamás lo aconseja.",
        refs: ["lpt-44"],
      },
      {
        kind: "dato",
        title: "¿Quién la aplica hoy?",
        big: "ARCA",
        unit: "sucesora de la AFIP",
        caption: "Desde el Decreto 953/2024, las menciones a la AFIP en la Ley 11.683 se entienden referidas a ARCA.",
        refs: ["dto-953-2024"],
      },
      {
        kind: "check",
        question: "¿Qué distingue a la clausura preventiva?",
        options: ["Se comunica de inmediato al juez para que la confirme o la deje sin efecto", "Dura siempre 6 días", "La aplica el Tribunal Fiscal"],
        correct: 0,
        explain: "Es una medida cautelar del art. 35 inc. f) con control judicial inmediato.",
      },
    ],
  },
  {
    id: "cap3",
    number: 3,
    title: "Acta y audiencia",
    subtitle: "El procedimiento del art. 41",
    topic: "trib.procedimiento-clausura",
    topics: ["trib.procedimiento-clausura", "const.defensa"],
    color: "#2f6f55",
    reels: [
      {
        kind: "intro",
        title: "Del mostrador al expediente",
        words: ["Constatación,", "acta,", "audiencia,", "resolución."],
        caption: "Antes de clausurar, el organismo tiene que seguir un procedimiento. Cada paso es una oportunidad para la defensa.",
        refs: ["lpt-41"],
      },
      {
        kind: "linea",
        title: "El camino del procedimiento",
        steps: [
          { label: "Constatación", sub: "Funcionarios fiscales (art. 35)" },
          { label: "Acta de comprobación", sub: "Hechos, prueba y encuadre (art. 41)" },
          { label: "Audiencia de descargo", sub: "Ante el juez administrativo" },
          { label: "Resolución", sub: "Multa y clausura, o no" },
        ],
        caption: "Memorizá el orden: constatan los inspectores, resuelve el juez administrativo.",
        refs: ["lpt-35", "lpt-41"],
      },
      {
        kind: "lista",
        title: "Qué debe tener el acta",
        items: [
          { icon: "📝", text: "Los hechos y sus circunstancias." },
          { icon: "🔎", text: "La prueba de esos hechos." },
          { icon: "⚖️", text: "El encuadre legal de la conducta." },
          { icon: "📅", text: "La citación a la audiencia, con pruebas." },
          { icon: "✍️", text: "La firma de los actuantes y la notificación." },
        ],
        caption: "Si al acta le falta algo, ahí puede haber una defensa. Si no le falta nada, no inventes defectos.",
        refs: ["lpt-41"],
      },
      {
        kind: "dato",
        title: "¿Cuándo es la audiencia?",
        big: "5 a 15",
        unit: "días hábiles administrativos",
        caption: "No antes de 5 ni después de 15 días. Los plazos en días de la Ley 11.683 se cuentan en días hábiles administrativos (art. 4).",
        refs: ["lpt-41", "lpt-4"],
      },
      {
        kind: "calendario",
        title: "Contemos juntos",
        days: [
          { label: "Vie 6", mark: "acta" },
          { label: "Sáb 7", mark: "finde" },
          { label: "Dom 8", mark: "finde" },
          { label: "Lun 9", mark: "habil" },
          { label: "Mar 10", mark: "habil" },
          { label: "Mié 11", mark: "audiencia" },
          { label: "Jue 12", mark: "habil" },
          { label: "Vie 13", mark: "minimo" },
        ],
        caption: "Acta el viernes 6 y audiencia el miércoles 11: sólo 3 días hábiles. El mínimo se alcanzaba el viernes 13. Hay una irregularidad.",
        refs: ["lpt-41", "lpt-4"],
      },
      {
        kind: "check",
        question: "Acta el viernes 6 y audiencia el miércoles 11, sin feriados. ¿Cuántos días hábiles hay?",
        options: ["5", "3", "4"],
        correct: 1,
        explain: "Lunes 9, martes 10 y miércoles 11: 3 días hábiles. Sábado y domingo no cuentan.",
      },
      {
        kind: "alerta",
        title: "Esto se debate",
        text: "Hay fallos que consideran ORDENATORIOS los plazos del art. 41. Si es así, la irregularidad sola no anula: tenés que probar un perjuicio concreto a la defensa.",
        caption: "No es una regla indiscutida. En un examen, mencioná el debate y el principio de trascendencia.",
        refs: ["lpt-41-plazos", "cn-18"],
      },
      {
        kind: "lista",
        title: "Una defensa sólida",
        items: [
          { icon: "🙋", text: "Concurrir a la audiencia, siempre." },
          { icon: "📎", text: "Llevar y ofrecer toda la prueba." },
          { icon: "⏱️", text: "Objetar el plazo y probar el perjuicio." },
          { icon: "🧾", text: "Discutir los hechos (defensa de fondo)." },
          { icon: "⬇️", text: "En subsidio, pedir el mínimo de la escala." },
        ],
        caption: "Una buena defensa combina planteos formales, de fondo y subsidiarios.",
        refs: ["lpt-41", "cn-18"],
      },
      {
        kind: "check",
        question: "La audiencia se fijó antes de tiempo. ¿Qué conviene hacer?",
        options: ["No ir: la audiencia no vale", "Concurrir, objetar el plazo y probar el perjuicio concreto", "Presentar un amparo inmediato"],
        correct: 1,
        explain: "La irregularidad se hace valer en la audiencia. Si no vas, se puede resolver sin tu descargo.",
      },
    ],
  },
  {
    id: "cap4",
    number: 4,
    title: "Recursos contra la clausura",
    subtitle: "Arts. 77 y 78 y control judicial",
    topic: "trib.recursos-clausura",
    topics: ["trib.recursos-clausura", "trib.organos"],
    color: "#7a2f3a",
    reels: [
      {
        kind: "intro",
        title: "Te clausuraron. ¿Y ahora?",
        words: ["Cinco días", "para apelar.", "Cinco días", "para ir al juez."],
        caption: "La clausura tiene un régimen recursivo propio y con plazos muy breves. Equivocarse de vía es perder el caso.",
        refs: ["lpt-77", "lpt-78"],
      },
      {
        kind: "linea",
        title: "La escalera recursiva",
        steps: [
          { label: "Resolución", sub: "Juez administrativo" },
          { label: "Apelación administrativa", sub: "Art. 77 · 5 días · funcionario superior" },
          { label: "Recurso judicial", sub: "Art. 78 · 5 días · se presenta ante el organismo" },
          { label: "Juzgado", sub: "Penal Económico (CABA) o Federal" },
        ],
        caption: "El superior se expide en un plazo breve. Si confirma, recién ahí se va al juez.",
        refs: ["lpt-77", "lpt-78"],
      },
      {
        kind: "comparar",
        title: "¿Tribunal Fiscal? No.",
        left: { title: "Art. 76", items: ["Determinaciones y multas", "Reconsideración", "Tribunal Fiscal de la Nación"] },
        right: { title: "Arts. 77 y 78", items: ["Clausura", "Apelación administrativa", "Juez penal económico / federal"] },
        caption: "La trampa clásica: llevar una clausura al Tribunal Fiscal. Esa vía no corresponde.",
        refs: ["lpt-76", "lpt-77", "lpt-78"],
      },
      {
        kind: "check",
        question: "¿Qué recurso procede primero contra la resolución que impone una clausura?",
        options: ["Apelación ante el Tribunal Fiscal", "Apelación administrativa ante el superior (art. 77)", "Recurso extraordinario ante la Corte"],
        correct: 1,
        explain: "Art. 77, dentro de los 5 días. El Tribunal Fiscal no interviene en las clausuras.",
      },
      {
        kind: "caso",
        title: "¿Qué juez me toca?",
        lines: [
          { who: "🏙️", name: "Comercio en CABA", text: "Juzgado Nacional en lo Penal Económico." },
          { who: "🌄", name: "Comercio en Córdoba", text: "Juzgado federal de la jurisdicción." },
          { who: "📮", name: "En ambos casos", text: "El recurso se presenta ante el organismo, que eleva las actuaciones." },
        ],
        caption: "La competencia depende del lugar. Elegir mal el tribunal demora la causa.",
        refs: ["lpt-78"],
      },
      {
        kind: "dato",
        title: "CSJN, \"Lapiduz\" (1998)",
        big: "Penal",
        unit: "la naturaleza de la clausura",
        caption: "La Corte exigió control judicial antes de ejecutar la clausura. Cita a verificar: Fallos 321:1043.",
        refs: ["csjn-lapiduz"],
      },
      {
        kind: "alerta",
        title: "Verificá el efecto del recurso",
        text: "Con qué efecto se concede el recurso del art. 78 debe leerse en el texto vigente y junto con \"Lapiduz\".",
        caption: "No lo des por sentado: citá la norma vigente y la doctrina de la Corte.",
        refs: ["lpt-78", "csjn-lapiduz"],
      },
      {
        kind: "check",
        question: "La panadería está en Rosario. ¿Quién revisa judicialmente la clausura?",
        options: ["Un juzgado federal", "El Tribunal Fiscal de la Nación", "Un juzgado civil provincial"],
        correct: 0,
        explain: "Fuera de la Ciudad de Buenos Aires intervienen los juzgados federales (art. 78).",
      },
    ],
  },
];

export function chapter(id: string): Chapter {
  const c = CHAPTERS.find((x) => x.id === id);
  if (!c) throw new Error(`Capítulo inexistente: ${id}`);
  return c;
}
