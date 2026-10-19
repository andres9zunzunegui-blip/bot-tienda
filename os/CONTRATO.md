# Cláusula Legal OS — contrato para los agentes de mejora

## Qué es
`base.html` es la app publicada (artefacto de claude.ai) de Andrés, estudiante avanzado de Derecho SIN matrícula, que maneja
@clausuladigitall (Instagram) y la serie animada de reels del Código Civil y Comercial (Clausulo, Codiguito, Inciso, Resaltato,
La Voz de la ley). La app es un único HTML con varios bloques `<script>` que se fueron agregando por "tandas": cada tanda
envuelve funciones existentes (`const _vPanelC=vPanel; vPanel=()=>{...}`) y agrega listeners con `data-*` propios.
Lee `base.html` COMPLETO antes de escribir.

## Objetivo general (pedido de Andrés)
"Mejorarla 1000 veces, que sea altamente funcional, y que me sirva hasta que no tenga la versión pro."
=> La app tiene que ser plenamente útil SIN las capacidades pagas/opcionales: sin `sample` (agentes de Claude), sin `mcp`
(Metricool), sin `assets`/`downloads`. Todo lo que hoy depende de eso necesita un camino que funcione igual (plantillas,
reglas, carga manual, copiar al portapapeles), y cuando la capacidad SÍ está, se aprovecha.

## Reglas de trabajo (obligatorias)
1. NO edites `base.html`. Tu entrega es UN archivo `modulos/NN_nombre.html` con un `<style>` (opcional) y un `<script>"use strict";…</script>`,
   en el mismo estilo de las tandas existentes: envolvé funciones (`vPanel`, `vReels`, `vConfig`, `salaSteps`, `renderNav`, etc.)
   en vez de reemplazarlas; agregá vistas con `VIEWS.push([...])`/`splice` + `SHORT[k]=…` + envolviendo `render` para mapear tu vista.
   Terminá tu script con `render();`.
2. Prefijo propio para TODO lo nuevo: funciones, variables globales, clases CSS, ids, atributos `data-` y colecciones de db.
   Prefijos asignados: agente 1 `sp_`/`data-sp*` · agente 2 `pr_`/`data-pr*` · agente 3 `ca_`/`data-ca*` · agente 4 `me_`/`data-me*` · agente 5 `ux_`/`data-ux*`.
   (CSS: `.sp-…`, `.pr-…`, etc.). Nada de nombres genéricos sin prefijo.
3. Datos: usá el `db` existente (`dbSet/dbUpdate/dbDelete`, `S.*`, `S.settings` vía `saveSettings`). Colecciones nuevas solo con tu prefijo
   (ej. `pr_checklists`) y suscribite con `db.collection(...).onSnapshot` UNA vez cuando `db` exista (esperá a que `db` se resuelva: poll corto o envolver `boot`).
   Las reglas de la db solo dejan escribir al dueño (admin); está bien. Nada de secretos. `localStorage` solo para comodidades (siempre try/catch).
4. Capacidades: no agregues capacidades nuevas. Disponibles: db, sample, mcp (Metricool: getBrandSettings, getScheduledPosts,
   getAnalyticsDataByMetrics, getBestTimeToPostByNetwork, createScheduledPost), assets, downloads, user. Siempre ramificá por `null`.
   Las descargas solo vía `downloads.save` (los `<a download>` no funcionan para el visitante). Nada de alert/confirm/prompt/window.print.
   Sin librerías externas nuevas (jszip ya está). Solo fuentes ya cargadas (Cormorant Garamond, Manrope, JetBrains Mono).
5. Diseño: usá los tokens existentes (`--noche --marfil --oro --oro-ink --bg --surface --ink --muted --line --soft --ok --warn --bad --info`,
   `--f-display --f-body --f-mono`) y las clases existentes (`.panel .ph .btn .btn.primary .btn.sm .chip .row .list .fields .grid .empty .kv`).
   Tiene que verse bien en claro y oscuro, en escritorio y a 390 px sin scroll horizontal. Textos en español rioplatense, claros, sin emojis decorativos.
6. Reglas de marca no negociables: nunca afirmar matrícula ni llamar "Doctor"/"Dr." a nadie; nada se publica ni se programa sin confirmación
   explícita en la app; nunca inventar métricas (lo que no viene de Metricool o de una carga manual de Andrés, no se muestra como dato);
   la Voz de la ley lee SOLO el texto literal del artículo; descripción de reels termina con
   "Contenido informativo: no reemplaza el asesoramiento de un abogado matriculado."
7. Probá antes de entregar: `python3 build.py NN` (arma `dist-NN.html` con base + tu módulo) y `node probar.mjs dist-NN.html sinpro completo solo`.
   Tiene que dar 0 errores y 0 overflow. Mirá algunas capturas en `out/` (Read de la imagen) de tu vista en celular y escritorio.
   Si tocás flujos con db, probá también interacciones con un script propio de Playwright basado en `probar.mjs` (mock en `mock.js`).
8. Al terminar, respondé con: archivo entregado, qué agrega (lista corta), qué funciones envuelve, colecciones/campos nuevos, y qué no pudiste probar.
