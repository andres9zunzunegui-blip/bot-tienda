# LEGAL LIFE — Arquitectura

## Decisiones técnicas

| Necesidad | Tecnología | Motivo |
|---|---|---|
| Mundo isométrico 3D en PC y móvil | **Three.js** (WebGL) con cámara ortográfica | Corre en cualquier navegador moderno, sin instalación; geometría procedural liviana. |
| Interfaz y lógica | **TypeScript** + Vite, sin framework de UI | Bundle chico, módulos desacoplados y tipados. |
| Servidor | **Node + Express** | Protege la clave de IA y procesa documentos. |
| IA | **Claude** vía SDK oficial `@anthropic-ai/sdk`, salidas estructuradas (Zod) | Evaluaciones con formato validado; *fallback* de servidor ante rechazos. |
| Documentos | `pdf-parse`, `mammoth` (DOCX), `jszip` (PPTX) | Extracción de texto en el servidor. |
| Persistencia | `localStorage` (estado) + IndexedDB (textos de material) | Funciona sin cuenta ni base de datos; exportable/importable a JSON. |
| Pruebas | Vitest (lógica) + Playwright (recorridos E2E manuales) | |

## Módulos

```
server/
  index.ts          API HTTP: /api/health, /api/extract, /api/ai/{oral,material,decision}
  ai.ts             Inteligencia artificial (prompts con reglas de no inventar normas)
  extract.ts        Procesamiento documental (PDF/DOCX/PPTX/TXT; OCR no implementado)
src/
  engine/           MOTOR DE JUEGO: mundo isométrico, edificios, avatar, entrada
  core/state.ts     GESTIÓN DE USUARIO y PERSISTENCIA (estado versionado + bus de eventos)
  core/api.ts       Cliente del servidor
  legal/sources.ts  GESTIÓN DE FUENTES JURÍDICAS (referencias, vigencia, advertencias)
  content/          Contenido de referencia: caso de clausura, red tributaria, banco oral, objetos
  modules/
    simulator/      MOTOR DE SIMULACIONES (genérico: etapas, banderas, consecuencias, finales)
    conceptmap/     REDES CONCEPTUALES (diseño radial, validación de relaciones, huecos)
    oral/           EVALUACIONES (evaluador local por conceptos)
    materials/      PROCESAMIENTO DE MATERIAL (IA o local) e IndexedDB
  systems/
    gamification.ts GAMIFICACIÓN (XP por calidad, niveles, rangos, insignias, desbloqueos, misiones)
    memory.ts       ENTRENADOR DE MEMORIA (SM-2, retención estimada)
    topics.ts       SISTEMA DE MATERIAS
  ui/               Interfaz: menú, HUD, interiores, pantallas
```

## Cómo se conectan los sistemas

Toda actividad académica termina en `recordActivity()` (`src/systems/gamification.ts`), que:

1. calcula XP y monedas según la **calidad** (sin calidad ≥ 40 % no hay XP; sin aprobar no hay monedas);
2. registra evidencia de dominio por tema (con decaimiento por olvido);
3. guarda cada error y lo convierte en **tarjeta de repaso** (repetición espaciada);
4. avanza misiones (sólo con actividades aprobadas);
5. evalúa los requisitos de desbloqueo de edificios, que **la ciudad 3D construye en vivo**.

## Motor jurídico: política de fuentes

* Cada referencia (`LegalRef`) lleva norma, artículo, jurisdicción, reformas, fuente oficial y **estado de verificación**.
* El contenido es una **paráfrasis didáctica**, nunca se presenta como texto literal.
* En esta versión **ninguna** referencia fue cotejada en línea contra InfoLEG (el entorno de desarrollo no tenía acceso a `infoleg.gob.ar`, `argentina.gob.ar` ni `afip.gob.ar`). Por eso todas figuran como *pendiente* o *discrepancia*, y la interfaz lo advierte.
* Los **montos** actualizables (multas, umbrales) no se usan como dato cierto. Se detectó discrepancia entre fuentes secundarias sobre el umbral del art. 40 ($10 vs. $20.000).
* Las cuestiones discutidas (p. ej. si los plazos del art. 41 son perentorios u ordenatorios) se marcan como `debatido`.
* El selector de **jurisdicción** y **fecha de referencia** genera advertencias de vigencia.

## Cómo agregar un nuevo procedimiento

1. Crear `src/content/<caso>.ts` exportando un `Scenario` (ver `clausura.ts`).
2. Cargar sus referencias en `src/legal/sources.ts` con su estado de verificación.
3. Registrarlo en la lista de `src/ui/screens/simulator.ts`.
4. Agregar pruebas del camino óptimo y de los desenlaces en `tests/`.
