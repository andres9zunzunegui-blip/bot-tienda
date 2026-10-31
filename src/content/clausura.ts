/**
 * CASO 1 — Procedimiento de clausura (Ley 11.683, arts. 40, 41, 77 y 78).
 * Hechos, personas y comercio son FICTICIOS. Las referencias normativas remiten
 * a src/legal/sources.ts, donde consta su estado de verificación.
 */
import type { Ctx, Scenario } from "../modules/simulator/engine.ts";

const has = (c: Ctx, f: string) => c.flags.has(f);

export const CLAUSURA: Scenario = {
  id: "clausura-11683",
  title: "Clausura — Panadería La Espiga",
  subject: "Derecho Tributario",
  role: "Abogado/a defensor/a de la titular del establecimiento",
  jurisdiccion: "Nacional — establecimiento en la Ciudad Autónoma de Buenos Aires",
  summary:
    "Agentes del organismo recaudador (ARCA) constatan una venta sin emisión de factura electrónica en una panadería. Defendé a la titular desde la inspección hasta la revisión judicial.",
  start: "inspeccion",
  initialDocs: ["guia"],
  docs: {
    guia: {
      id: "guia",
      title: "Mapa del procedimiento",
      body: () => `<ol>
<li><b>Constatación</b> por funcionarios fiscales (facultades del art. 35).</li>
<li><b>Acta de comprobación</b> con hechos, prueba, encuadre legal y citación a audiencia (art. 41).</li>
<li><b>Audiencia de defensa</b> ante el <b>juez administrativo</b> del organismo (fecha: no antes de 5 ni después de 15 días).</li>
<li><b>Resolución</b> del juez administrativo sobre multa y clausura.</li>
<li><b>Apelación administrativa</b> ante el funcionario superior (art. 77).</li>
<li><b>Recurso judicial</b> ante el juzgado en lo penal económico (CABA) o federal (resto del país) (art. 78).</li>
</ol>
<p class="muted">Los plazos en días de la Ley 11.683 se computan en días hábiles administrativos (art. 4). Esta guía es una paráfrasis: verificá el texto vigente en la fuente oficial.</p>`,
    },
    acta: {
      id: "acta",
      title: "Acta de comprobación N° 0417 (ficticia)",
      body: (c) => `<p><b>Lugar:</b> Av. Ficticia 1234, CABA — "Panadería La Espiga", titular Marta Gómez (CUIT ficticio 27-00000000-0).</p>
<p><b>Fecha y hora:</b> viernes 6, 11:05 h.</p>
<p><b>Actuantes:</b> inspectores R. Ledesma (legajo 0001) y L. Paz (legajo 0002), con orden de intervención.</p>
<p><b>Hechos:</b> a las 11:02 h los actuantes adquirieron una torta y una docena de facturas por <b>$ 38.500</b> (monto ficticio, elegido para superar cualquiera de los umbrales publicados), abonados en efectivo. No se emitió ni entregó factura o comprobante equivalente. Testigo: cliente presente, Sr. J. Pérez.</p>
<p><b>Encuadre legal:</b> art. 40 inc. a) de la Ley 11.683 (t.o. 1998 y modif.).</p>
<p><b>Citación:</b> se cita a la responsable a comparecer, munida de las pruebas de que intente valerse, a la <b>audiencia de descargo del miércoles 11, 10:00 h</b>, en la Agencia N° 9 (ficticia), ante el juez administrativo.</p>
<p><b>Observaciones de la responsable:</b> ${
        has(c, "constancia")
          ? `"Dejo constancia de que el comprobante se estaba generando en el sistema cuando intervinieron los inspectores, y de que no estoy de acuerdo con lo consignado." Firma en disconformidad.`
          : "Firma sin observaciones."
      }</p>
<p><b>Firmas:</b> ambos actuantes y la responsable. Se entrega copia.</p>
<p class="muted">Calendario: entre el viernes 6 y el miércoles 11 no hay feriados.</p>`,
    },
    comprobante: {
      id: "comprobante",
      title: "Factura electrónica emitida (ficticia)",
      body: () => `<p>Factura B N° 0003-00012345 — fecha viernes 6 — <b>hora de autorización 11:09 h</b> — importe $ 38.500 — consumidor final.</p>
<p class="muted">Emitida 4 minutos después del labrado del acta. Que esta emisión posterior excluya o no la infracción es una cuestión de prueba y de criterio jurisprudencial: no es una regla automática.</p>`,
    },
    antecedentes: {
      id: "antecedentes",
      title: "Informe de antecedentes",
      body: () => `<p>Consulta del sistema del organismo: <b>la responsable no registra infracciones del art. 40 en los últimos dos años</b>. Inscripta y al día con sus declaraciones juradas.</p>
<p class="muted">La reincidencia dentro de los dos años duplica mínimos y máximos (art. 40). Su ausencia es relevante para la graduación de la sanción.</p>`,
    },
    testimonio: {
      id: "testimonio",
      title: "Declaración de la empleada (borrador)",
      body: () => `<p>Lucía Ferreyra, cajera: "El cobro se hizo en efectivo y en ese momento el punto de venta estaba procesando el comprobante; la pantalla quedó congelada unos minutos. Cuando se reinició, la factura salió autorizada a las 11:09."</p>
<p class="muted">El relato podría respaldarse con el registro técnico del proveedor del sistema de facturación, que tarda alrededor de una semana en emitirse.</p>`,
    },
    resolucion: {
      id: "resolucion",
      title: "Resolución del juez administrativo (ficticia)",
      body: (c) => {
        const dias = clausuraDias(c);
        return `<p><b>VISTO</b> el acta N° 0417 ${has(c, "descargo") || has(c, "descargo-debil") ? "y el descargo presentado" : "y la incomparecencia de la responsable a la audiencia"}…</p>
<p><b>CONSIDERANDO:</b> que se encuentra acreditada la falta de emisión del comprobante al momento de la operación; ${
          has(c, "nulidad-con-perjuicio") || has(c, "nulidad-sola")
            ? "que el planteo de nulidad por el plazo de la audiencia se rechaza por entenderse que los plazos del art. 41 son ordenatorios"
            : "que no se formularon planteos de nulidad"
        }; ${has(c, "graduacion") ? "que la responsable no registra antecedentes, lo que justifica graduar la sanción en el mínimo legal" : "que se gradúa la sanción según las constancias de la causa"}.</p>
<p><b>RESUELVO:</b> aplicar multa dentro de la escala vigente y <b>clausura por ${dias} días</b> del establecimiento.</p>
<p class="muted">Notificada el lunes 16.</p>`;
      },
    },
  },
  stages: {
    inspeccion: {
      id: "inspeccion",
      phase: 1,
      title: "La inspección",
      authority: "Funcionarios fiscales de ARCA",
      topic: "trib.procedimiento-clausura",
      refs: ["lpt-35", "lpt-41"],
      narrative: () =>
        "Viernes, 11:10 h. Te llama Marta Gómez, titular de la Panadería La Espiga: \"Dos inspectores de ARCA compraron una torta, dicen que no les di factura y están escribiendo un acta. ¿Qué hago?\"",
      prompt: "¿Qué le aconsejás mientras los inspectores labran el acta?",
      kind: "single",
      choices: [
        {
          id: "a",
          text: "Que les pida que se retiren y no los deje terminar el acta.",
          quality: 0,
          refs: ["lpt-35"],
          feedback: {
            porQue: "Los funcionarios actúan en ejercicio de facultades legales de verificación. Obstaculizarlos no impide que el acta se labre y expone a la responsable a consecuencias adicionales.",
            consecuencia: "El acta se labra igual, con constancia de la actitud obstructiva, y se pierde la oportunidad de controlar su contenido.",
            alternativa: "Controlar la identidad de los actuantes, leer el acta, pedir copia y dejar constancia de la disconformidad y de los hechos relevantes.",
          },
        },
        {
          id: "b",
          text: "Que verifique credenciales y orden de intervención, lea el acta completa, pida copia y, si no está de acuerdo, deje constancia escrita de su versión antes de firmar.",
          quality: 1,
          flags: ["constancia"],
          refs: ["lpt-41"],
          feedback: { porQue: "", consecuencia: "", alternativa: "" },
        },
        {
          id: "c",
          text: "Que firme rápido para que se vayan; después lo vemos.",
          quality: 0.3,
          refs: ["lpt-41"],
          feedback: {
            porQue: "Firmar no equivale a reconocer la infracción, pero hacerlo sin leer impide dejar constancia inmediata de hechos favorables (por ejemplo, que el comprobante se estaba generando).",
            consecuencia: "El acta, que es un instrumento labrado por funcionarios públicos, queda sin observaciones de la responsable: la prueba en contrario será más difícil.",
            alternativa: "Leer el acta y dejar constancia escrita de la disconformidad y de la versión de los hechos.",
          },
        },
      ],
      weight: 1,
      next: () => "hechos",
      addsDocs: ["acta"],
    },
    hechos: {
      id: "hechos",
      phase: 2,
      title: "Los hechos de la fiscalización",
      authority: "Expediente administrativo",
      topic: "trib.infracciones",
      refs: ["lpt-40", "lpt-ilicitos", "rpt"],
      narrative: () =>
        "Marta te envía una foto del acta y el comprobante que salió del sistema minutos después. Abrí el EXPEDIENTE para leer los documentos.",
      prompt: "Según el acta, ¿qué conducta se le atribuye a la responsable?",
      kind: "single",
      addsDocs: ["comprobante"],
      choices: [
        {
          id: "a",
          text: "Omisión de impuestos (infracción material).",
          quality: 0,
          refs: ["lpt-ilicitos"],
          feedback: {
            porQue: "La omisión de impuestos es una infracción MATERIAL que supone un tributo dejado de pagar. Aquí no se discute un impuesto adeudado sino el incumplimiento del deber formal de emitir comprobantes.",
            consecuencia: "Una defensa construida sobre la inexistencia de deuda tributaria sería inconducente.",
            alternativa: "Identificar la infracción FORMAL de no emitir factura o comprobante equivalente (art. 40 inc. a).",
          },
        },
        {
          id: "b",
          text: "No emitir factura o comprobante equivalente por una operación (incumplimiento de un deber formal).",
          quality: 1,
          refs: ["lpt-40"],
          feedback: { porQue: "", consecuencia: "", alternativa: "" },
        },
        {
          id: "c",
          text: "Evasión tributaria simple.",
          quality: 0,
          refs: ["rpt"],
          feedback: {
            porQue: "La evasión es un DELITO del Régimen Penal Tributario: exige ardid o engaño y superar un umbral de monto por tributo y período, y la juzga el Poder Judicial. Una venta sin factura, por sí sola, es una infracción formal.",
            consecuencia: "Confundir infracción con delito lleva a equivocar autoridad, procedimiento y defensas.",
            alternativa: "Encuadrar el hecho como infracción formal del art. 40 inc. a).",
          },
        },
        {
          id: "d",
          text: "Falta de inscripción ante el organismo.",
          quality: 0,
          refs: ["lpt-40"],
          feedback: {
            porQue: "La falta de inscripción es otro inciso del art. 40, pero el acta no la atribuye: la responsable está inscripta.",
            consecuencia: "Defenderse de un hecho que no se imputó deja sin respuesta el que sí se imputó.",
            alternativa: "Leer el acta: el hecho atribuido es la falta de emisión del comprobante.",
          },
        },
      ],
      weight: 1,
      next: () => "imputacion",
    },
    imputacion: {
      id: "imputacion",
      phase: 3,
      title: "La imputación del organismo",
      authority: "ARCA",
      topic: "trib.clausura",
      refs: ["lpt-40", "lpt-ilicitos"],
      narrative: () => "El acta encuadra el hecho en una norma concreta. Antes de defender, tenés que saber qué sanción está en juego.",
      prompt: "¿Qué sanción prevé la norma que el organismo aplica?",
      kind: "single",
      choices: [
        {
          id: "a",
          text: "Multa y clausura del establecimiento de 2 a 6 días (art. 40 Ley 11.683, texto posterior a la Ley 27.430).",
          quality: 1,
          refs: ["lpt-40"],
          feedback: { porQue: "", consecuencia: "", alternativa: "" },
        },
        {
          id: "b",
          text: "Sólo multa por infracción formal, sin clausura.",
          quality: 0.3,
          refs: ["lpt-40"],
          feedback: {
            porQue: "Hay infracciones formales sancionadas sólo con multa, pero las conductas del art. 40 tienen prevista conjuntamente multa y clausura.",
            consecuencia: "Subestimar la sanción lleva a no preparar la defensa contra la clausura, que es lo que más perjudica al comercio.",
            alternativa: "Multa y clausura de 2 a 6 días (art. 40).",
          },
        },
        {
          id: "c",
          text: "Prisión de 2 a 6 años.",
          quality: 0,
          refs: ["rpt"],
          feedback: {
            porQue: "Las penas privativas de libertad corresponden a los delitos del Régimen Penal Tributario, no a la infracción del art. 40.",
            consecuencia: "Error grave de encuadre: confunde el régimen infraccional con el penal.",
            alternativa: "Multa y clausura de 2 a 6 días (art. 40).",
          },
        },
        {
          id: "d",
          text: "Clausura de 3 a 10 días.",
          quality: 0.4,
          refs: ["lpt-40"],
          feedback: {
            porQue: "Esa era la escala del texto ANTERIOR a la Ley 27.430. Usar una versión derogada es un error típico: siempre hay que verificar la vigencia a la fecha de los hechos.",
            consecuencia: "Una defensa que pide graduar sobre una escala derogada pierde credibilidad.",
            alternativa: "Clausura de 2 a 6 días, según el texto vigente (verificar en la fuente oficial).",
          },
        },
      ],
      weight: 1,
      next: () => "analisis",
      addsDocs: ["antecedentes", "testimonio"],
    },
    analisis: {
      id: "analisis",
      phase: 4,
      title: "Análisis de las actuaciones",
      authority: "Estudio jurídico",
      topic: "trib.procedimiento-clausura",
      refs: ["lpt-41", "lpt-4", "lpt-41-plazos", "lpt-40"],
      narrative: () =>
        "Tenés el acta, el comprobante, el informe de antecedentes y el borrador de declaración de la cajera. Revisá todo con lupa: fechas, firmas, encuadre y citación.",
      prompt: "Marcá TODAS las circunstancias jurídicamente relevantes para la defensa (y sólo esas).",
      kind: "multi",
      choices: [
        {
          id: "plazo",
          text: "La audiencia se fijó para el 3.er día hábil posterior al acta, antes del mínimo de 5 días.",
          quality: 1,
          correct: true,
          refs: ["lpt-41", "lpt-4"],
          feedback: {
            porQue: "Viernes 6 → lunes 9 (1), martes 10 (2), miércoles 11 (3): sólo 3 días hábiles. El art. 41 exige una fecha no anterior a 5 días.",
            consecuencia: "Omitirlo es perder un agravio procesal concreto vinculado al derecho de defensa.",
            alternativa: "Computar los plazos en días hábiles administrativos (art. 4) y contrastarlos con el art. 41.",
          },
        },
        {
          id: "posterior",
          text: "El comprobante se autorizó 4 minutos después del acta.",
          quality: 1,
          correct: true,
          refs: ["lpt-40"],
          feedback: {
            porQue: "Es el núcleo fáctico de la defensa de fondo: permite discutir la configuración de la conducta, aunque su eficacia depende de la prueba y del criterio del tribunal.",
            consecuencia: "Sin este hecho, la defensa queda reducida a lo formal.",
            alternativa: "Ofrecer el comprobante y la prueba técnica del sistema de facturación.",
          },
        },
        {
          id: "antecedentes",
          text: "La responsable no registra infracciones del art. 40 en los últimos dos años.",
          quality: 1,
          correct: true,
          refs: ["lpt-40"],
          feedback: {
            porQue: "No hay reincidencia (que duplicaría mínimos y máximos) y es un argumento para graduar en el mínimo.",
            consecuencia: "Sin este dato, se pierde el pedido subsidiario de graduación mínima.",
            alternativa: "Invocar la ausencia de antecedentes para la graduación.",
          },
        },
        {
          id: "encuadre",
          text: "El acta no consigna el encuadramiento legal de la conducta.",
          quality: 0,
          correct: false,
          refs: ["lpt-41"],
          feedback: {
            porQue: "Falso: el acta sí indica el encuadre (art. 40 inc. a). Plantear defectos inexistentes debilita el resto de la defensa.",
            consecuencia: "El juez administrativo rechaza el planteo y la defensa pierde seriedad.",
            alternativa: "Leer el acta: el encuadre está consignado.",
          },
        },
        {
          id: "juez",
          text: "El acta es nula porque no la firmó un juez.",
          quality: 0,
          correct: false,
          refs: ["lpt-41"],
          feedback: {
            porQue: "El acta de comprobación la labran y firman los funcionarios fiscales actuantes; el juez administrativo interviene después, en la audiencia y la resolución.",
            consecuencia: "Confunde la etapa de constatación con la de juzgamiento.",
            alternativa: "Distinguir funcionarios actuantes (acta) y juez administrativo (resolución).",
          },
        },
        {
          id: "pruebas",
          text: "No se le informó que podía concurrir con pruebas.",
          quality: 0,
          correct: false,
          refs: ["lpt-41"],
          feedback: {
            porQue: "Falso: la citación indica que debe comparecer \"munida de las pruebas de que intente valerse\".",
            consecuencia: "Planteo rechazable que resta credibilidad.",
            alternativa: "Verificar el contenido real de la citación.",
          },
        },
      ],
      weight: 1.5,
      next: () => "normas",
    },
    normas: {
      id: "normas",
      phase: 5,
      title: "Normas aplicables",
      authority: "Estudio jurídico",
      topic: "trib.clausura",
      refs: ["lpt-40", "lpt-41", "lpt-4", "lpt-77", "lpt-78", "cn-18", "lpt-76", "lpt-44", "rpt"],
      narrative: () => "Armá la carpeta normativa del caso. Consultá la BIBLIOTECA de normas si dudás.",
      prompt: "Marcá las normas que vas a necesitar en este procedimiento.",
      kind: "multi",
      choices: [
        { id: "40", text: "Art. 40 Ley 11.683 (infracción y sanción)", quality: 1, correct: true, refs: ["lpt-40"], feedback: { porQue: "Es la norma que tipifica la conducta y fija la sanción.", consecuencia: "Sin ella no se puede discutir encuadre ni graduación.", alternativa: "Incluirla." } },
        { id: "41", text: "Art. 41 Ley 11.683 (acta y audiencia)", quality: 1, correct: true, refs: ["lpt-41"], feedback: { porQue: "Regula el acta, la citación y la audiencia: base del planteo por el plazo.", consecuencia: "Se pierde el agravio procesal.", alternativa: "Incluirla." } },
        { id: "4", text: "Art. 4 Ley 11.683 (cómputo en días hábiles)", quality: 1, correct: true, refs: ["lpt-4"], feedback: { porQue: "Sin el cómputo en días hábiles no se demuestra que la audiencia se fijó antes de tiempo.", consecuencia: "El agravio queda sin sustento.", alternativa: "Incluirla." } },
        { id: "77", text: "Art. 77 Ley 11.683 (apelación administrativa)", quality: 1, correct: true, refs: ["lpt-77"], feedback: { porQue: "Es el recurso específico contra la resolución que impone la clausura.", consecuencia: "Riesgo de elegir una vía equivocada y que la sanción quede firme.", alternativa: "Incluirla." } },
        { id: "78", text: "Art. 78 Ley 11.683 (recurso judicial)", quality: 1, correct: true, refs: ["lpt-78"], feedback: { porQue: "Habilita la revisión judicial de la clausura.", consecuencia: "Se pierde el control judicial suficiente.", alternativa: "Incluirla." } },
        { id: "18", text: "Art. 18 Constitución Nacional (defensa en juicio)", quality: 1, correct: true, refs: ["cn-18"], feedback: { porQue: "Fundamenta el perjuicio al derecho de defensa por el plazo abreviado.", consecuencia: "El planteo de nulidad pierde su anclaje constitucional.", alternativa: "Incluirla." } },
        { id: "76", text: "Art. 76 Ley 11.683 (apelación ante el Tribunal Fiscal)", quality: 0, correct: false, refs: ["lpt-76"], feedback: { porQue: "La vía del art. 76 (reconsideración o Tribunal Fiscal) no es la de las sanciones de clausura, que tienen un régimen propio (arts. 77 y 78).", consecuencia: "Elegir esa vía haría que la clausura quede firme por no usar el recurso correcto.", alternativa: "Arts. 77 y 78." } },
        { id: "44", text: "Art. 44 Ley 11.683 (quebrantamiento de clausura)", quality: 0, correct: false, refs: ["lpt-44"], feedback: { porQue: "Sólo aplica si se viola una clausura ya dispuesta; no es el caso (por ahora).", consecuencia: "Norma irrelevante en la carpeta de defensa.", alternativa: "No incluirla, aunque conviene advertir a la clienta sobre sus consecuencias." } },
        { id: "rpt", text: "Régimen Penal Tributario (evasión)", quality: 0, correct: false, refs: ["rpt"], feedback: { porQue: "No hay imputación de delito: se trata de una infracción formal.", consecuencia: "Confusión de regímenes.", alternativa: "No incluirlo." } },
      ],
      weight: 1,
      next: () => "defensa",
    },
    defensa: {
      id: "defensa",
      phase: 6,
      title: "Estrategia de defensa",
      authority: "Estudio jurídico",
      topic: "const.defensa",
      refs: ["lpt-41", "lpt-41-plazos", "cn-18", "cn-43", "lpt-40"],
      narrative: () =>
        "Faltan pocos días para la audiencia. El proveedor del sistema de facturación tarda alrededor de una semana en emitir el registro técnico que probaría el congelamiento del punto de venta.",
      prompt: "¿Qué estrategia adoptás?",
      kind: "single",
      choices: [
        {
          id: "a",
          text: "Plantear la irregularidad del plazo de la audiencia acreditando el perjuicio concreto (no se pudo obtener a tiempo el registro técnico), y subsidiariamente defensa de fondo (emisión del comprobante, prueba testimonial) y graduación al mínimo por falta de antecedentes.",
          quality: 1,
          flags: ["nulidad-con-perjuicio", "fondo", "graduacion"],
          refs: ["lpt-41", "lpt-41-plazos", "cn-18"],
          feedback: { porQue: "", consecuencia: "", alternativa: "" },
        },
        {
          id: "b",
          text: "Plantear únicamente la nulidad por el plazo, sin más defensas.",
          quality: 0.4,
          flags: ["nulidad-sola"],
          refs: ["lpt-41-plazos"],
          feedback: {
            porQue: "Hay criterios jurisprudenciales que consideran ordenatorios los plazos del art. 41. Sin demostrar un perjuicio concreto y sin defensas subsidiarias, el planteo queda expuesto a un rechazo que deja a la clienta sin nada.",
            consecuencia: "Si se rechaza la nulidad, no hay defensa de fondo ni pedido de graduación.",
            alternativa: "Nulidad con perjuicio concreto + defensa de fondo + graduación, en forma subsidiaria.",
          },
        },
        {
          id: "c",
          text: "Reconocer la infracción y no presentar defensas para terminar rápido.",
          quality: 0.15,
          flags: ["allanamiento"],
          refs: ["lpt-40"],
          feedback: {
            porQue: "Se renuncia a defensas disponibles y razonables (plazo, prueba de la emisión, graduación) sin obtener nada a cambio.",
            consecuencia: "La sanción se impone sin discusión y sin pedido de graduación mínima.",
            alternativa: "Ejercer la defensa en la audiencia: es la oportunidad prevista por el art. 41.",
          },
        },
        {
          id: "d",
          text: "Promover de inmediato una acción de amparo.",
          quality: 0.1,
          refs: ["cn-43"],
          feedback: {
            porQue: "El amparo procede cuando no existe otro medio más idóneo. Aquí la ley prevé una vía específica: audiencia de descargo y recursos de los arts. 77 y 78.",
            consecuencia: "Probable rechazo in limine y pérdida de tiempo mientras corre el procedimiento.",
            alternativa: "Defenderse en la audiencia y luego usar los recursos específicos.",
          },
        },
      ],
      argument: {
        prompt: "Redactá el núcleo de tu descargo (entre 3 y 8 oraciones), como lo presentarías por escrito.",
        persona: "juez",
        weight: 0.4,
        keyPoints: [
          {
            id: "plazo",
            label: "Plazo mínimo de 5 días del art. 41 incumplido",
            groups: [["plazo", "dias", "antelacion"], ["(5|cinco)", "minimo", "art(iculo|\\.)? ?41"]],
            criterio: "fundamentacion",
            followUp: "¿Qué plazo fija la ley entre el acta y la audiencia, y cómo se computa?",
          },
          {
            id: "perjuicio",
            label: "Perjuicio concreto al derecho de defensa",
            groups: [["perjuicio", "agravio", "afecta", "imposibilit", "no (se )?pudo"], ["defensa", "prueba", "registro", "informe"]],
            criterio: "argumentacion",
            followUp: "¿Qué perjuicio concreto le causó a su clienta el plazo abreviado?",
          },
          {
            id: "emision",
            label: "Emisión del comprobante / inexistencia de la conducta",
            groups: [["factura", "comprobante", "ticket"], ["emiti", "autoriz", "11[:.]09", "minutos"]],
            criterio: "precision",
            followUp: "¿Qué prueba ofrece sobre la emisión del comprobante?",
          },
          {
            id: "prueba",
            label: "Ofrecimiento de prueba",
            groups: [["ofrec", "acompan", "testig", "testimon", "pericia", "informe tecnico", "registro"]],
            criterio: "argumentacion",
          },
          {
            id: "graduacion",
            label: "Subsidiariamente, graduación al mínimo por falta de antecedentes",
            groups: [["minimo", "graduac", "atenuant"], ["antecedente", "reincid", "primera vez"]],
            criterio: "relacion",
            followUp: "Si se rechazan sus defensas, ¿qué pide en subsidio?",
          },
          {
            id: "cn",
            label: "Fundamento constitucional (art. 18 CN)",
            groups: [["art(iculo|\\.)? ?18", "constituci", "debido proceso", "defensa en juicio"]],
            criterio: "fundamentacion",
          },
        ],
      },
      weight: 2,
      next: () => "audiencia",
    },
    audiencia: {
      id: "audiencia",
      phase: 7,
      title: "Audiencia de descargo",
      authority: "Juez administrativo de ARCA",
      topic: "trib.procedimiento-clausura",
      refs: ["lpt-41"],
      narrative: (c) =>
        has(c, "allanamiento")
          ? "Llega el miércoles 11. Aunque decidiste no defender el fondo, todavía tenés que resolver cómo actuar en la audiencia."
          : "Miércoles 11, 10:00 h, Agencia N° 9. El juez administrativo abre la audiencia.",
      prompt: "¿Cómo actuás en la audiencia?",
      kind: "single",
      choices: [
        {
          id: "a",
          text: "Concurrir con la clienta, presentar el descargo escrito, acompañar el comprobante, ofrecer la testimonial y el registro técnico (pidiendo plazo para producirlo) y reiterar la objeción al plazo.",
          quality: 1,
          flags: ["descargo"],
          refs: ["lpt-41"],
          feedback: { porQue: "", consecuencia: "", alternativa: "" },
        },
        {
          id: "b",
          text: "No concurrir: el plazo estuvo mal fijado, así que la audiencia no vale.",
          quality: 0,
          flags: ["incomparecencia"],
          refs: ["lpt-41", "lpt-41-plazos"],
          feedback: {
            porQue: "La irregularidad no se hace valer con la ausencia: se plantea en la audiencia. Si se consideran ordenatorios los plazos, el juez administrativo puede resolver sin descargo.",
            consecuencia: "Se resuelve sin la versión ni la prueba de la responsable.",
            alternativa: "Concurrir, objetar el plazo y ofrecer toda la prueba.",
          },
        },
        {
          id: "c",
          text: "Concurrir y explicar oralmente lo ocurrido, sin acompañar prueba.",
          quality: 0.4,
          flags: ["descargo-debil"],
          refs: ["lpt-41"],
          feedback: {
            porQue: "El art. 41 cita al responsable \"munido de las pruebas de que intente valerse\". El relato sin prueba difícilmente desvirtúe un acta labrada por funcionarios públicos.",
            consecuencia: "Descargo débil: alta probabilidad de sanción.",
            alternativa: "Acompañar el comprobante, ofrecer testimonial y pericia/informe técnico.",
          },
        },
      ],
      weight: 1,
      next: (c) => (has(c, "incomparecencia") ? "resolucionAdm" : "audienciaOral"),
    },
    audienciaOral: {
      id: "audienciaOral",
      phase: 7,
      title: "El juez administrativo pregunta",
      authority: "Juez administrativo de ARCA",
      topic: "const.defensa",
      refs: ["lpt-41", "lpt-41-plazos", "cn-18"],
      narrative: () =>
        "El juez administrativo te mira por encima de los anteojos: \"Doctor/a, su clienta está aquí, con su abogado y con pruebas. Si comparece igual, ¿qué importancia tiene que la audiencia se haya fijado con dos días menos?\"",
      prompt: "Respondé al juez administrativo.",
      kind: "argument",
      argument: {
        prompt: "Tu respuesta en la audiencia:",
        persona: "juez",
        weight: 1,
        keyPoints: [
          {
            id: "finalidad",
            label: "Finalidad del plazo: preparar la defensa y la prueba",
            groups: [["prepar", "reunir", "producir", "obtener", "recabar"], ["prueba", "defensa", "registro", "informe"]],
            criterio: "argumentacion",
          },
          {
            id: "concreto",
            label: "Perjuicio concreto: el registro técnico no llegó a tiempo",
            groups: [["registro", "informe", "proveedor", "sistema"], ["no (llego|esta|pudo|se pudo)", "tiempo", "semana", "demora", "todavia"]],
            criterio: "precision",
          },
          {
            id: "trascendencia",
            label: "Trascendencia de la nulidad / no es una nulidad por la nulidad misma",
            groups: [["perjuicio", "trascendencia", "afect", "agravio"]],
            criterio: "relacion",
          },
          {
            id: "subsidio",
            label: "Pedido subsidiario: plazo para producir la prueba",
            groups: [["solicit", "pido", "requier", "subsidi"], ["plazo", "nueva audiencia", "producir", "agregar", "incorporar"]],
            criterio: "argumentacion",
          },
          {
            id: "norma",
            label: "Cita del art. 41 y/o del art. 18 CN",
            groups: [["art(iculo|\\.)? ?41", "art(iculo|\\.)? ?18", "defensa en juicio", "debido proceso"]],
            criterio: "fundamentacion",
          },
        ],
      },
      weight: 1.5,
      next: () => "resolucionAdm",
    },
    resolucionAdm: {
      id: "resolucionAdm",
      phase: 8,
      title: "Resolución y recurso administrativo",
      authority: "Juez administrativo de ARCA",
      topic: "trib.recursos-clausura",
      refs: ["lpt-77", "lpt-76", "lpt-78", "lpt-4"],
      addsDocs: ["resolucion"],
      deadline: "5 días hábiles desde la notificación",
      narrative: (c) =>
        `El juez administrativo dictó resolución: impone multa y clausura por ${clausuraDias(c)} días. Te notifican el lunes 16. Leé la resolución en el expediente.`,
      prompt: "¿Qué hacés frente a la resolución?",
      kind: "single",
      choices: [
        {
          id: "a",
          text: "Apelación administrativa ante el funcionario superior de ARCA, dentro de los 5 días hábiles de notificada (art. 77).",
          quality: 1,
          flags: ["apel77"],
          refs: ["lpt-77", "lpt-4"],
          feedback: { porQue: "", consecuencia: "", alternativa: "" },
        },
        {
          id: "b",
          text: "Apelación ante el Tribunal Fiscal de la Nación dentro de los 15 días (art. 76).",
          quality: 0,
          flags: ["via-erronea"],
          refs: ["lpt-76", "lpt-77"],
          feedback: {
            porQue: "El Tribunal Fiscal no es la vía para las sanciones de clausura: la ley prevé la apelación administrativa del art. 77 y luego el recurso judicial del art. 78.",
            consecuencia: "El recurso es improcedente y, mientras tanto, vence el plazo del art. 77: la sanción queda firme.",
            alternativa: "Apelación administrativa del art. 77 dentro de los 5 días.",
          },
        },
        {
          id: "c",
          text: "Ir directo al juzgado en lo penal económico, salteando la instancia administrativa.",
          quality: 0.2,
          flags: ["via-erronea"],
          refs: ["lpt-77", "lpt-78"],
          feedback: {
            porQue: "El recurso judicial del art. 78 se dirige contra la resolución que resuelve la apelación administrativa: hay que agotar primero el art. 77.",
            consecuencia: "Riesgo de rechazo y de que venza el plazo del art. 77.",
            alternativa: "Primero art. 77; luego, si se confirma, art. 78.",
          },
        },
        {
          id: "d",
          text: "No recurrir: la clausura es corta y conviene cumplirla.",
          quality: 0.2,
          flags: ["consentida"],
          refs: ["lpt-77"],
          feedback: {
            porQue: "Es una decisión posible, pero renuncia a defensas razonables y deja firme un antecedente que, ante una nueva infracción dentro de dos años, duplicaría la escala (reincidencia).",
            consecuencia: "Sanción firme y antecedente computable para reincidencia.",
            alternativa: "Apelar en término (art. 77) y sostener las defensas.",
          },
        },
      ],
      weight: 1.5,
      next: (c) => (has(c, "apel77") ? "recursoJudicial" : null),
    },
    recursoJudicial: {
      id: "recursoJudicial",
      phase: 9,
      title: "Recurso judicial",
      authority: "Funcionario superior de ARCA → Poder Judicial",
      topic: "trib.recursos-clausura",
      refs: ["lpt-78"],
      deadline: "5 días hábiles desde la notificación",
      narrative: () =>
        "El funcionario superior confirmó la sanción. El establecimiento está en la Ciudad Autónoma de Buenos Aires. Queda abierta la revisión judicial.",
      prompt: "¿Ante quién y cómo interponés el recurso judicial?",
      kind: "single",
      choices: [
        {
          id: "a",
          text: "Recurso del art. 78, interpuesto y fundado por escrito ante ARCA dentro de los 5 días, para que eleve las actuaciones al Juzgado Nacional en lo Penal Económico.",
          quality: 1,
          flags: ["rec78"],
          refs: ["lpt-78"],
          feedback: { porQue: "", consecuencia: "", alternativa: "" },
        },
        {
          id: "b",
          text: "Demanda ante el fuero Contencioso Administrativo Federal.",
          quality: 0.2,
          refs: ["lpt-78"],
          feedback: {
            porQue: "La clausura tiene naturaleza penal y la ley asigna su revisión a los juzgados en lo penal económico (en CABA) o federales (en el resto del país).",
            consecuencia: "Planteo ante un tribunal incompetente: demoras y riesgo de que la sanción quede firme.",
            alternativa: "Art. 78: Juzgado Nacional en lo Penal Económico, interpuesto ante ARCA.",
          },
        },
        {
          id: "c",
          text: "Recurso extraordinario directo ante la Corte Suprema.",
          quality: 0,
          refs: ["lpt-78"],
          feedback: {
            porQue: "La Corte no es una instancia ordinaria de revisión de sanciones administrativas; antes debe transitarse la vía del art. 78.",
            consecuencia: "Recurso inadmisible.",
            alternativa: "Recurso del art. 78 ante el juzgado en lo penal económico.",
          },
        },
        {
          id: "d",
          text: "Juzgado federal de primera instancia de la provincia de Buenos Aires.",
          quality: 0.3,
          refs: ["lpt-78"],
          feedback: {
            porQue: "Los juzgados federales intervienen fuera de la Ciudad de Buenos Aires. El comercio está en CABA, donde la competencia es del fuero penal económico.",
            consecuencia: "Planteo de competencia que demora la causa.",
            alternativa: "Juzgado Nacional en lo Penal Económico.",
          },
        },
      ],
      weight: 1.5,
      next: (c) => (has(c, "rec78") ? "ejecucion" : null),
    },
    ejecucion: {
      id: "ejecucion",
      phase: 9,
      title: "¿Se ejecuta antes de la sentencia?",
      authority: "ARCA",
      topic: "trib.recursos-clausura",
      refs: ["csjn-lapiduz", "lpt-78", "lpt-44"],
      narrative: () =>
        "Mientras el recurso está en trámite, ARCA comunica que hará efectiva la clausura la semana próxima. Marta, desesperada, propone: \"Si la ponen, yo abro igual por la puerta de atrás\".",
      prompt: "¿Qué hacés?",
      kind: "single",
      choices: [
        {
          id: "a",
          text: "Plantear que la clausura no se ejecute hasta que el juez resuelva, invocando su naturaleza penal y el control judicial suficiente (doctrina de la CSJN en \"Lapiduz\"), y advertir a la clienta que no viole la clausura.",
          quality: 1,
          flags: ["lapiduz"],
          refs: ["csjn-lapiduz", "lpt-44"],
          feedback: { porQue: "", consecuencia: "", alternativa: "" },
        },
        {
          id: "b",
          text: "No plantear nada: la ejecución es automática.",
          quality: 0.3,
          refs: ["csjn-lapiduz"],
          feedback: {
            porQue: "Se omite un planteo con respaldo en jurisprudencia de la Corte sobre la necesidad de revisión judicial antes de ejecutar una sanción de naturaleza penal (verificar el texto vigente del art. 78 y su aplicación actual).",
            consecuencia: "El comercio puede cerrar antes de que un juez revise la sanción.",
            alternativa: "Pedir que no se ejecute hasta la resolución judicial.",
          },
        },
        {
          id: "c",
          text: "Aconsejarle que reabra igual si la clausuran.",
          quality: 0,
          flags: ["quebrantamiento"],
          refs: ["lpt-44"],
          feedback: {
            porQue: "Quebrantar la clausura es una conducta autónoma, castigada con arresto y una nueva clausura por el doble de tiempo (art. 44). Además, aconsejarlo es contrario a los deberes profesionales.",
            consecuencia: "La situación de la clienta empeora gravemente.",
            alternativa: "Defender por las vías legales y advertir sobre el art. 44.",
          },
        },
      ],
      weight: 1,
      next: () => null,
    },
  },
  ending(c, score) {
    if (has(c, "quebrantamiento"))
      return {
        title: "Quebrantamiento de clausura",
        tone: "mal",
        resolucion:
          "La clienta reabrió el local durante la clausura. Se inicia un procedimiento por quebrantamiento: arresto y nueva clausura por el doble del tiempo (art. 44).",
        fundamentos: ["Art. 44 Ley 11.683: el quebrantamiento es una infracción autónoma y más grave que la original."],
        nota: "Un buen defensor nunca aconseja violar una sanción: la discute por las vías legales.",
      };
    if (has(c, "consentida") || has(c, "via-erronea") || !has(c, "apel77"))
      return {
        title: "Sanción firme",
        tone: "mal",
        resolucion: `La resolución quedó firme: multa y clausura por ${clausuraDias(c)} días. ${has(c, "via-erronea") ? "La vía recursiva elegida no era la correcta y venció el plazo del art. 77." : "No se interpuso la apelación del art. 77 en término."}`,
        fundamentos: [
          "Arts. 77 y 78 Ley 11.683: la clausura tiene un régimen recursivo específico, con plazos breves (5 días hábiles).",
          "La sanción firme se computa como antecedente para la reincidencia (art. 40).",
        ],
        nota: "Los plazos recursivos de la clausura son muy breves: identificar la vía correcta es tan importante como el fondo.",
      };
    const fuerte = has(c, "nulidad-con-perjuicio") && has(c, "descargo") && has(c, "fondo");
    if (fuerte && has(c, "lapiduz") && score >= 0.75)
      return {
        title: "Recurso parcialmente admitido",
        tone: "ok",
        resolucion:
          "El Juzgado Nacional en lo Penal Económico hace lugar parcialmente al recurso: tiene por acreditado que la audiencia se fijó antes del mínimo legal y que ello impidió producir el registro técnico ofrecido; valorada esa prueba junto con la emisión del comprobante minutos después y la ausencia de antecedentes, reduce la clausura al mínimo legal, y la sanción no se ejecuta antes de quedar firme.",
        fundamentos: [
          "Art. 41 Ley 11.683 y art. 18 CN: el plazo mínimo protege la posibilidad de preparar la defensa; se acreditó un perjuicio concreto.",
          "Art. 40 Ley 11.683: falta de antecedentes y circunstancias del caso como pautas de graduación.",
          "Doctrina CSJN \"Lapiduz\": control judicial suficiente previo a la ejecución de una sanción de naturaleza penal.",
        ],
        nota: "Resolución ficticia con fines didácticos. En la práctica el resultado depende de la prueba y del tribunal: hay precedentes que consideran ordenatorios los plazos del art. 41 y criterios dispares sobre la emisión posterior del comprobante.",
      };
    return {
      title: "Sanción confirmada",
      tone: "parcial",
      resolucion: `El juzgado confirma la sanción (clausura por ${clausuraDias(c)} días). ${
        has(c, "nulidad-sola")
          ? "El planteo de nulidad sin perjuicio concreto fue rechazado y no había defensas subsidiarias."
          : "La defensa no logró desvirtuar el acta ni acreditar un perjuicio concreto."
      }`,
      fundamentos: [
        "Art. 41 Ley 11.683: el acta labrada por funcionarios con los recaudos legales hace fe mientras no se pruebe lo contrario.",
        "Criterio jurisprudencial: la irregularidad en los plazos exige demostrar un perjuicio concreto para invalidar lo actuado.",
      ],
      nota: "Revisá las decisiones marcadas para ver qué planteos faltaron.",
    };
  },
};

export function clausuraDias(c: Ctx): number {
  if (has(c, "graduacion") && (has(c, "descargo") || has(c, "descargo-debil"))) return 2;
  if (has(c, "incomparecencia") || has(c, "allanamiento")) return 4;
  return 3;
}
