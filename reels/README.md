# Cláusula Legal · pipeline de reels HD

Serie animada de @clausuladigitall que explica artículos del Código Civil y Comercial (CCyC).
Responsable: Andrés, estudiante avanzado de Derecho (sin matrícula).

Este pipeline produce un reel vertical 1080×1920 de 45 a 60 s con estética de cine animado 3D:
- planos clave generados en Floot con las imágenes base del elenco como referencia,
- cámara en movimiento (acercamientos, paneos, ajuste de foco al corte, barridos),
- luz de ventana, polvo en suspensión, hologramas y destellos,
- la apertura del Código (tapa roja, letras blancas) que se abre en el artículo,
- la Voz de la ley con el texto literal y subtítulos con palabras clave marcadas en amarillo,
- un efecto de sonido por acción, música suave que baja cuando hablan, y un final que empalma en loop.

## Reglas de oro (el pipeline las controla)

| Regla | Dónde se controla |
|---|---|
| La Voz de la ley lee **solo** el texto literal (número y epígrafe incluidos) | `00_verificar_ley.py` y `05_componer.py`: si las frases unidas no dan el artículo exacto, el render frena |
| Texto vigente verificado en InfoLEG, con concordancias y excepciones | `00_verificar_ley.py` → `verificacion/informe.md` |
| Ningún texto generado por IA dentro de la imagen | los prompts piden "no text"; todo el texto se superpone en `05_componer.py` |
| Una sola tarjeta de texto por vez, sin tapar caras | `05_componer.py` (tarjeta abajo o `"tarjeta": "arriba"` por plano) |
| Voces propias: Chatterbox + moldes, 2 tomas, verificadas con faster-whisper | `03_voces.py`: si ninguna toma dice el guion exacto, frena |
| Nada se publica ni se programa sin aprobación de Andrés | ningún script publica; `07_textos.py` solo escribe archivos |

## Estructura

```
reels/
  elenco/            imágenes base de cada personaje + elenco.json (rutas Floot, descripciones, rotación de anteojos)
  assets/fuentes/    Cormorant Garamond y Manrope (licencia OFL)
  pipeline/          un script por paso (00 a 07) + lib/
  episodios/<slug>/
    guion.json       segmentos, artículos literales, concordancias, planos y efectos por acción
    planos.json      lista de planos clave (acción + personajes) para pedirlos a Floot
    planos/          PNG de cada plano clave
    verificacion/    extracto de InfoLEG + informe del agente jurídico
    salida/          reel MP4, hoja de contacto, descripción, primer comentario, voces
```

## Pasos

```bash
pip install -r requirements.txt

python pipeline/00_verificar_ley.py <slug>          # agente jurídico: texto vigente + literalidad (frena si algo no coincide)
python pipeline/01_planos_floot.py <slug> --pedido  # lotes para Floot generate_image (con referencias del elenco)
python pipeline/01_planos_floot.py <slug> --control # verifica que estén todos los planos
python pipeline/02_veo.py <slug> <plano> "<acción>" # opcional: clip de 8 s con Veo 3.1 si la clave tiene facturación
python pipeline/03_voces.py <slug>                  # voces con moldes propios + control de transcripción
python pipeline/05_componer.py <slug>               # render final (o --cuadros 1.0,12.5 para cuadros sueltos)
python pipeline/06_hoja_contacto.py <slug>          # hoja de contacto para revisar
python pipeline/07_textos.py <slug>                 # descripción + primer comentario con fuentes
```

O todo junto: `./producir.sh <slug>`.

### Planos (paso 1)
Floot se usa desde Claude (conector MCP, proyecto `4600fe11-bf61-482a-ae81-7ca795857e94`). Cada plano se pide
con `generate_image`, tamaño `tall`, y como `reference_images` **siempre** las imágenes base de `elenco.json`.
Los resultados se guardan como `episodios/<slug>/planos/<id>.png`.
Clausulo tiene dos variantes (anteojos dorados / lentes oscuros) y `elenco.json → rotacion_clausulo`
dice cuál va en cada episodio, para que no salga siempre igual.

### Voces (paso 3)
Los moldes van en `reels/voces/moldes/` (clausulo, codiguito_grave, inciso, resaltato, voz_ley) y tienen que ser
grabaciones propias. **Nunca** voces de biblioteca de terceros. Si una línea todavía no tiene audio, el compositor
estima su duración, pone los subtítulos y baja la música en ese tramo, así la imagen se puede revisar igual.
Cuando estén las voces, se vuelve a correr el paso 5 y los tiempos se ajustan solos a los audios reales
(y el marcador amarillo sigue el tiempo de cada palabra, gracias a faster-whisper).

### Gemini / Veo (paso 2)
La clave va en `~/.config/clausula/secretos.env` (`GEMINI_API_KEY=...`), **nunca** en el repo.
Sin clave o sin facturación, el paso 5 anima los planos fijos con cámara, luces y partículas.

## Episodio nuevo (959, 985, 988, 984, 1061, 1088, 332)
1. Copiar `episodios/ep03_957_1015/` como plantilla (`guion.json` + `planos.json`), sin `planos/` ni `salida/`.
2. Cargar en `guion.json` los artículos y concordancias (texto literal), el caso, los segmentos y la variante de Clausulo.
3. Correr el paso 0 hasta que dé todo OK. Después pedir los planos (paso 1), las voces (paso 3) y renderizar.
4. Revisar la hoja de contacto y los textos. Publicar solo con aprobación de Andrés.
