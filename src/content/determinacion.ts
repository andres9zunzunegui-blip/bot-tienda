/**
 * CASO 2 — Determinación de oficio (Ley 11.683, arts. 16, 17 y 76).
 * Hechos, personas y empresa son FICTICIOS. Referencias en src/legal/sources.ts.
 */
import type { Ctx, Scenario } from "../modules/simulator/engine.ts";

const has = (c: Ctx, f: string) => c.flags.has(f);

export const DETERMINACION: Scenario = {
  id: "determinacion-11683",
  title: "Determinación de oficio — Imprenta Los Andes",
  subject: "Derecho Tributario",
  role: "Abogado/a de la empresa contribuyente",
  jurisdiccion: "Nacional",
  topic: "trib.determinacion",
  summary:
    "ARCA impugna las declaraciones juradas de IVA de una imprenta y quiere determinar el impuesto sobre base presunta. Defendé a la empresa desde la vista hasta el recurso.",
  start: "vista",
  initialDocs: ["guia"],
  docs: {
    guia: {
      id: "guia",
      title: "Mapa del procedimiento",
      body: () => `<ol>
<li><b>Vista</b> al contribuyente con los cargos (art. 17).</li>
<li><b>Descargo y prueba</b> en 15 días, prorrogables una vez.</li>
<li><b>Resolución fundada</b> del juez administrativo. Si pasan 90 días sin resolución, pronto despacho; 30 días más, caducidad.</li>
<li><b>Recurso</b> en 15 días: reconsideración ante el superior <i>o</i> apelación ante el Tribunal Fiscal (art. 76), vías excluyentes.</li>
</ol><p class="muted">Paráfrasis didáctica: verificá el texto vigente en la fuente oficial.</p>`,
    },
    vista: {
      id: "vista",
      title: "Vista de determinación (ficticia)",
      body: () => `<p><b>Contribuyente:</b> Imprenta Los Andes S.R.L. (ficticia).</p>
<p><b>Cargo:</b> se impugnan las DDJJ de IVA de enero a junio. Según el organismo, las compras de papel del período no guardan relación con las ventas declaradas: aplicando el rendimiento promedio del sector, se presumen ventas omitidas.</p>
<p><b>Base:</b> presunta (coeficiente de rendimiento del papel).</p>
<p><b>Plazo:</b> 15 días hábiles para formular descargo y ofrecer prueba.</p>`,
    },
    stock: {
      id: "stock",
      title: "Informe interno: stock de papel",
      body: () => `<p>El 40 % del papel comprado en marzo quedó en depósito: se adquirió por una oferta para un pedido de una editorial que se canceló. Hay remitos de ingreso a depósito y un inventario firmado por el contador.</p>
<p class="muted">Si se prueba, el coeficiente del organismo sobreestima las ventas.</p>`,
    },
    resolucion: {
      id: "resolucion",
      title: "Resolución determinativa (ficticia)",
      body: (c) =>
        has(c, "pericia")
          ? `<p>Se determina el impuesto, pero <b>se reduce la base</b>: se admite parcialmente el stock acreditado por la pericia contable.</p>`
          : `<p>Se determina el impuesto sobre la base presunta original, con intereses. Se impone multa por omisión.</p>`,
    },
  },
  stages: {
    vista: {
      id: "vista",
      phase: 1,
      title: "Llega la vista",
      authority: "Juez administrativo de ARCA",
      topic: "trib.determinacion",
      refs: ["lpt-16", "lpt-17"],
      addsDocs: ["vista"],
      narrative: () => "El gerente de la imprenta te reenvía una notificación: \"Dice VISTA. ¿Esperamos a ver qué deciden?\". Leé la vista en el expediente.",
      prompt: "¿Qué hacés con la vista?",
      kind: "single",
      choices: [
        {
          id: "a",
          text: "Esperar a la resolución final y recurrir después.",
          quality: 0,
          refs: ["lpt-17"],
          feedback: {
            porQue: "La vista es la oportunidad de defensa y de ofrecer prueba en sede administrativa. No contestarla deja que el organismo resuelva sólo con sus cargos.",
            consecuencia: "La determinación se dicta sin la versión ni la prueba de la empresa.",
            alternativa: "Contestar la vista en 15 días con descargo y prueba (pidiendo prórroga si hace falta).",
          },
        },
        {
          id: "b",
          text: "Contestar la vista dentro de los 15 días, y si la prueba no llega a tiempo, pedir la prórroga por única vez.",
          quality: 1,
          flags: ["contesta"],
          refs: ["lpt-17"],
          feedback: { porQue: "", consecuencia: "", alternativa: "" },
        },
        {
          id: "c",
          text: "Pagar lo que pide el organismo para evitar problemas.",
          quality: 0.2,
          refs: ["lpt-16"],
          feedback: {
            porQue: "Es una opción posible, pero la empresa tiene una defensa concreta (el stock de papel) que puede reducir la base presunta.",
            consecuencia: "Se paga un impuesto sobre ventas que quizá no existieron.",
            alternativa: "Defenderse en la vista con prueba del stock.",
          },
        },
      ],
      weight: 1.5,
      next: () => "base",
      deadline: "15 días hábiles, prorrogables una vez",
    },
    base: {
      id: "base",
      phase: 2,
      title: "Analizar la base presunta",
      authority: "Estudio jurídico",
      topic: "trib.determinacion",
      refs: ["lpt-16"],
      addsDocs: ["stock"],
      narrative: () => "El contador te pasa un informe interno sobre el papel. Leelo en el expediente.",
      prompt: "¿Cuál es el punto débil del cálculo del organismo?",
      kind: "single",
      choices: [
        {
          id: "a",
          text: "Que la presunción supone que todo el papel comprado se usó en el período, y parte quedó en stock.",
          quality: 1,
          flags: ["detecta"],
          refs: ["lpt-16"],
          feedback: { porQue: "", consecuencia: "", alternativa: "" },
        },
        {
          id: "b",
          text: "Que el organismo no puede usar presunciones nunca.",
          quality: 0.1,
          refs: ["lpt-16"],
          feedback: {
            porQue: "La ley admite la determinación sobre base presunta. Lo que se discute es que la presunción sea razonable en el caso concreto.",
            consecuencia: "Un planteo absoluto y sin respaldo se rechaza.",
            alternativa: "Atacar el presupuesto fáctico de la presunción: el stock no consumido.",
          },
        },
        {
          id: "c",
          text: "Que la vista no tiene la firma de un juez del Poder Judicial.",
          quality: 0,
          refs: ["lpt-17"],
          feedback: {
            porQue: "La determinación de oficio es un procedimiento administrativo: la dicta el juez administrativo del organismo, no un juez judicial.",
            consecuencia: "Defecto inexistente: resta seriedad a la defensa.",
            alternativa: "Discutir la base presunta con prueba.",
          },
        },
      ],
      weight: 1,
      next: () => "prueba",
    },
    prueba: {
      id: "prueba",
      phase: 3,
      title: "Ofrecer prueba",
      authority: "Estudio jurídico",
      topic: "trib.determinacion",
      refs: ["lpt-17"],
      narrative: () => "Preparás el descargo. Necesitás demostrar que el papel está en el depósito.",
      prompt: "Marcá la prueba que conviene ofrecer.",
      kind: "multi",
      choices: [
        { id: "pericia", text: "Pericia contable sobre inventario y registros.", quality: 1, correct: true, flags: ["pericia"], refs: ["lpt-17"], feedback: { porQue: "Es la prueba técnica idónea para acreditar el stock y recalcular la base.", consecuencia: "Sin ella, el stock queda sin acreditar.", alternativa: "Ofrecer pericia contable." } },
        { id: "remitos", text: "Remitos de ingreso a depósito e inventario firmado.", quality: 1, correct: true, refs: ["lpt-17"], feedback: { porQue: "Documentan que el papel no se consumió.", consecuencia: "Se pierde respaldo documental.", alternativa: "Acompañarlos con el descargo." } },
        { id: "inspeccion", text: "Pedir que se constate el stock en el depósito.", quality: 1, correct: true, refs: ["lpt-17"], feedback: { porQue: "Una constatación directa refuerza la pericia.", consecuencia: "Menos elementos para convencer.", alternativa: "Ofrecer la constatación." } },
        { id: "testigo", text: "Testigos sobre la buena reputación de la empresa.", quality: 0, correct: false, refs: ["lpt-17"], feedback: { porQue: "La reputación no prueba el stock ni la base imponible.", consecuencia: "Prueba inconducente.", alternativa: "Concentrarse en la prueba contable y documental." } },
      ],
      weight: 1.5,
      next: () => "demora",
    },
    demora: {
      id: "demora",
      phase: 4,
      title: "El organismo no resuelve",
      authority: "ARCA",
      topic: "trib.determinacion",
      refs: ["lpt-17"],
      narrative: () => "Pasaron 95 días desde que contestaste la vista y no hay resolución. El gerente pregunta si hay que hacer algo.",
      prompt: "¿Qué corresponde?",
      kind: "single",
      choices: [
        {
          id: "a",
          text: "Pedir pronto despacho: si en 30 días no se resuelve, caduca el procedimiento.",
          quality: 1,
          flags: ["pronto"],
          refs: ["lpt-17"],
          feedback: { porQue: "", consecuencia: "", alternativa: "" },
        },
        {
          id: "b",
          text: "Nada: el procedimiento ya caducó automáticamente.",
          quality: 0.2,
          refs: ["lpt-17"],
          feedback: {
            porQue: "La caducidad no opera sola a los 90 días: hace falta pedir pronto despacho y que pasen 30 días más sin resolución.",
            consecuencia: "Si no se pide pronto despacho, el organismo puede resolver más tarde.",
            alternativa: "Pedir pronto despacho.",
          },
        },
        {
          id: "c",
          text: "Ir directo al Tribunal Fiscal por la demora.",
          quality: 0.1,
          refs: ["lpt-76"],
          feedback: {
            porQue: "El recurso ante el Tribunal Fiscal se dirige contra una resolución determinativa, que todavía no existe.",
            consecuencia: "Recurso improcedente.",
            alternativa: "Pedir pronto despacho según el art. 17.",
          },
        },
      ],
      weight: 1,
      next: () => "recurso",
    },
    recurso: {
      id: "recurso",
      phase: 5,
      title: "La resolución y el recurso",
      authority: "Juez administrativo de ARCA",
      topic: "trib.determinacion",
      refs: ["lpt-76", "tfn-efecto"],
      addsDocs: ["resolucion"],
      deadline: "15 días hábiles desde la notificación",
      narrative: (c) =>
        has(c, "pericia")
          ? "Antes de que caduque, el juez administrativo resuelve: reduce la base pero igual determina impuesto. La empresa quiere seguir discutiendo. El monto supera el mínimo del Tribunal Fiscal."
          : "El juez administrativo resuelve sobre la base presunta original. La empresa quiere discutir. El monto supera el mínimo del Tribunal Fiscal.",
      prompt: "¿Qué vía elegís y por qué?",
      kind: "single",
      choices: [
        {
          id: "a",
          text: "Apelación ante el Tribunal Fiscal dentro de 15 días: órgano especializado y no se puede intimar el pago de lo apelado mientras tramita.",
          quality: 1,
          flags: ["tfn"],
          refs: ["lpt-76", "tfn-efecto"],
          feedback: { porQue: "", consecuencia: "", alternativa: "" },
        },
        {
          id: "b",
          text: "Reconsideración ante el superior y, en paralelo, apelación ante el Tribunal Fiscal.",
          quality: 0,
          refs: ["lpt-76"],
          feedback: {
            porQue: "Las vías del art. 76 son excluyentes: hay que elegir una.",
            consecuencia: "Se arriesga la inadmisibilidad y la pérdida de la instancia elegida.",
            alternativa: "Elegir una sola vía; si el monto lo permite, el Tribunal Fiscal suele ser conveniente.",
          },
        },
        {
          id: "c",
          text: "Reconsideración ante el superior dentro de 15 días.",
          quality: 0.6,
          flags: ["reconsideracion"],
          refs: ["lpt-76"],
          feedback: {
            porQue: "Es una vía válida, pero se queda en sede administrativa y no tiene las ventajas del Tribunal Fiscal (especialización y efecto sobre la intimación de pago).",
            consecuencia: "Defensa posible, aunque menos protectora.",
            alternativa: "Apelación ante el Tribunal Fiscal, cuando el monto lo permite.",
          },
        },
        {
          id: "d",
          text: "Oponer excepciones en una ejecución fiscal más adelante.",
          quality: 0,
          refs: ["lpt-92"],
          feedback: {
            porQue: "En la ejecución fiscal no se discute el fondo de la deuda: las excepciones son taxativas.",
            consecuencia: "La determinación queda firme y luego se ejecuta.",
            alternativa: "Recurrir la determinación en 15 días por el art. 76.",
          },
        },
      ],
      weight: 2,
      next: () => null,
    },
  },
  ending(c, score) {
    if (!has(c, "contesta"))
      return {
        title: "Determinación sin defensa",
        tone: "mal",
        resolucion: "La empresa no contestó la vista: el impuesto se determinó sobre la base presunta original, con intereses y multa.",
        fundamentos: ["Art. 17 Ley 11.683: la vista es la oportunidad de descargo y prueba en sede administrativa."],
        nota: "En la determinación de oficio, la vista es la instancia clave.",
      };
    if (has(c, "tfn") && has(c, "pericia") && score >= 0.75)
      return {
        title: "Base reducida y apelación en curso",
        tone: "ok",
        resolucion:
          "La pericia redujo la base presunta en sede administrativa. La empresa apeló ante el Tribunal Fiscal por el resto, y mientras tramita no puede intimársele el pago de lo apelado.",
        fundamentos: [
          "Art. 16: la base presunta debe ser razonable y cede ante prueba en contrario.",
          "Art. 17: la vista permitió producir prueba contable.",
          "Art. 76: elección de la vía del Tribunal Fiscal dentro de los 15 días.",
        ],
        nota: "Resolución ficticia con fines didácticos. El resultado real depende de la prueba y del criterio del tribunal.",
      };
    return {
      title: "Defensa parcial",
      tone: "parcial",
      resolucion: "La empresa se defendió, pero sin aprovechar todas las herramientas: el reclamo se mantiene en buena parte.",
      fundamentos: ["Arts. 16, 17 y 76 Ley 11.683: prueba idónea y elección estratégica de la vía recursiva."],
      nota: "Revisá las decisiones marcadas para ver qué faltó.",
    };
  },
};
