# ⚖️ LEGAL LIFE

Videojuego universitario para aprender Derecho argentino. Recorrés una ciudad universitaria isométrica en 3D, entrás a la Facultad y a Tribunales, defendés clientes ficticios en simulaciones de procedimientos reales, rendís exámenes orales con repreguntas, armás redes conceptuales y entrenás la memoria con repetición espaciada. **La ciudad crece sólo cuando demostrás dominio de los contenidos.**

> Primera versión jugable (MVP). Arquitectura y módulos: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Cómo ejecutarlo

Requisitos: Node 20 o superior.

```bash
npm install
cp .env.example .env          # opcional: agregá ANTHROPIC_API_KEY para activar la IA
npm run dev                   # cliente en http://localhost:5173 + API en :8787
```

Producción: `npm run build && npm start`, y luego abrí `http://localhost:8787`.
Pruebas: `npm test`. Verificación de tipos: `npm run typecheck`.

Sin `ANTHROPIC_API_KEY` el juego funciona igual con un **evaluador local** (reconoce conceptos equivalentes, no palabras exactas), y la interfaz lo indica siempre.

## Controles

* **PC:** WASD o flechas para caminar, **E** para entrar a un edificio, rueda del mouse para hacer zoom y clic en el suelo o en un edificio para ir hasta ahí.
* **Móvil:** tocá el suelo para caminar o un edificio para entrar, y pellizcá para hacer zoom.

## Qué incluye el MVP

| Función | Estado |
|---|---|
| Ciudad isométrica 3D con 9 edificios, NPCs y marcadores de misión | ✅ |
| Personaje controlable y personalizable (piel, pelo, trajes, accesorios) | ✅ |
| Facultad y Tribunales con interiores interactivos | ✅ |
| **Simulador completo de clausura (Ley 11.683)**: 10 fases, ramificaciones, expediente con documentos, normas por etapa, argumentación escrita, explicación de cada error en 5 puntos (qué decidiste, por qué es incorrecto, qué norma aplica, qué consecuencia tiene y cuál era la alternativa correcta) y 4 desenlaces posibles | ✅ |
| Profesor (examen oral) y jueza (audiencia) con evaluación por criterios y repreguntas, modo exigente y voz opcional | ✅ (con IA o evaluador local) |
| Red conceptual de Derecho Tributario: exploración, construcción (con explicación de las relaciones incorrectas) y evaluación de memoria | ✅ |
| Carga de material: PDF, DOCX, PPTX, TXT/MD o texto pegado, que se convierte en unidades, conceptos, red, preguntas y normas citadas | ✅ |
| Entrenador de memoria: recuperación activa por escrito + SM-2 y tarjetas generadas a partir de los errores | ✅ |
| XP y monedas según la calidad, niveles, rangos, insignias, misiones diarias personalizadas, tienda y desbloqueo de edificios por dominio | ✅ |
| Registro del progreso: dominio por tema, errores frecuentes, artículos que confundís, retención, historial y exportación/importación | ✅ |
| Biblioteca de normas con jurisdicción, fecha de referencia y advertencias de vigencia | ✅ |

### Todavía NO implementado

* **OCR** de fotografías de textos: la app lo informa al intentar subir una imagen.
* **Laboratorio de casos** generados por IA: hay una pantalla informativa. El motor de simulaciones ya está listo para nuevos casos.
* **Otros simuladores** (determinación de oficio, ejecución fiscal, amparo, etc.): figuran como "no implementado".
* **Contenido de referencia** para materias distintas de Tributario: por ahora se cargan con material propio.
* **Normas provinciales**: el selector existe, pero sólo hay normas nacionales cargadas.
* **Cuentas en servidor**: el progreso se guarda en el navegador, con exportación a JSON.
* **Verificación en línea** contra InfoLEG o el Boletín Oficial: todas las referencias están marcadas "verificar" (ver más abajo).

## ⚠️ Fuentes jurídicas

Las referencias normativas son **paráfrasis didácticas**, no texto literal, y **no fueron cotejadas en línea** contra InfoLEG porque el entorno de desarrollo no tenía acceso a los sitios oficiales. Cada una enlaza a su fuente oficial y la app muestra su estado de verificación. Antes de usar la app con estudiantes, conviene que un docente revise `src/legal/sources.ts` y `src/content/clausura.ts`. Personas, comercios y expedientes son ficticios.
