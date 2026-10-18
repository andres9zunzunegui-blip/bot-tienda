#!/usr/bin/env python3
"""Paso 2 (opcional) — Planos con movimiento real usando Veo 3.1 (Gemini API).

La clave NUNCA va en el código ni en el repo: se lee de ~/.config/clausula/secretos.env
(línea GEMINI_API_KEY=...) o de la variable de entorno GEMINI_API_KEY.
Si no hay clave o la cuenta no tiene facturación, el script lo informa y el compositor (paso 5)
anima los planos fijos con cámara, luces y partículas — el reel sale igual.

Genera clips de 8 s en 9:16 a partir del plano fijo como imagen inicial. Los MP4 quedan en
episodios/<slug>/clips/<plano>.mp4 (para usarlos en edición en lugar del plano fijo).

Uso:
  pip install google-genai
  python pipeline/02_veo.py ep03_957_1015 k09_intercambio "the mate hands the bicycle to the book, gentle camera dolly in"
"""
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.comun import dir_episodio  # noqa: E402

SECRETOS = Path.home() / ".config" / "clausula" / "secretos.env"
MODELO = "veo-3.1-generate-preview"


def clave():
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    if SECRETOS.exists():
        for linea in SECRETOS.read_text().splitlines():
            if linea.startswith("GEMINI_API_KEY="):
                return linea.split("=", 1)[1].strip()
    return None


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    slug, plano, accion = sys.argv[1], sys.argv[2], sys.argv[3]
    k = clave()
    if not k:
        sys.exit(f"Sin GEMINI_API_KEY (ni en el entorno ni en {SECRETOS}). Se usa la animación por cámara del paso 5.")
    from google import genai
    from google.genai import types

    cliente = genai.Client(api_key=k)
    ruta = dir_episodio(slug) / "planos" / f"{plano}.png"
    imagen = types.Image(image_bytes=ruta.read_bytes(), mime_type="image/png")
    prompt = (f"Cinematic 3D animated film shot, Pixar quality, same characters and set as the image. {accion}. "
              "Warm window light, shallow depth of field. No text, no letters, no subtitles. No dialogue.")
    try:
        op = cliente.models.generate_videos(
            model=MODELO, prompt=prompt, image=imagen,
            config=types.GenerateVideosConfig(aspect_ratio="9:16", duration_seconds=8, number_of_videos=1))
    except Exception as e:  # p. ej. 403/429 por cuenta sin facturación
        sys.exit(f"Veo no disponible para esta clave ({e}). Se usa la animación por cámara del paso 5.")
    while not op.done:
        time.sleep(10)
        op = cliente.operations.get(op)
    video = op.response.generated_videos[0].video
    destino = dir_episodio(slug) / "clips" / f"{plano}.mp4"
    destino.parent.mkdir(exist_ok=True)
    cliente.files.download(file=video)
    video.save(str(destino))
    print(f"Clip guardado: {destino}")


if __name__ == "__main__":
    main()
