# Cláusula Legal OS — taller de mejoras

App publicada: https://claude.ai/artifact/HZ1rgi4pFytoRfGNk8qNfM (privada, solo Andrés).

- `base_v12.html`: versión publicada antes de la tanda 6 (no se edita).
- `modulos/`: tanda 6 (5 agentes): 10 sin Pro, 20 producción de la serie, 30 calendario, 40 resultados, 50 experiencia.
- `CONTRATO.md`: reglas para cualquier agente que agregue un módulo (prefijos, datos, diseño, reglas de marca).
- `build.py` arma `dist.html` = base + módulos; `node probar.mjs dist.html sinpro completo solo` prueba todas las vistas
  (escritorio y 390 px) con una cuenta simulada (`mock.js`). Requiere Playwright (Chromium en /opt/pw-browsers).

Para una tanda nueva: leer la versión publicada con la herramienta Artifact (action read) y guardarla como base nueva,
escribir `modulos/NN_nombre.html`, probar, y publicar `dist.html` en la misma URL. Nunca publicar ni programar nada en Instagram.
