#!/usr/bin/env python3
"""Paso 6 — Hoja de contacto: un cuadro por plano, sacado del MP4 final, con tiempo y texto en pantalla.

Uso:
  python pipeline/06_hoja_contacto.py ep03_957_1015
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.comun import AZUL_NOCHE, DORADO, MARFIL, dir_episodio  # noqa: E402
from lib.render import sans  # noqa: E402

COLS, W, H = 5, 324, 576


def main():
    slug = sys.argv[1]
    sal = dir_episodio(slug) / "salida"
    video = sal / f"{slug}_reel.mp4"
    tl = json.loads((sal / "linea_de_tiempo.json").read_text(encoding="utf-8"))
    tomas = []
    for tr in tl["tramos"]:
        partes = [0.5] if tr["tipo"] in ("apertura", "loop", "accion") else [0.7]
        for u in partes:
            tomas.append((tr["t0"] + tr["dur"] * u, tr["id"], tr.get("texto", "") or tr["tipo"].upper()))
    filas = (len(tomas) + COLS - 1) // COLS
    hoja = Image.new("RGB", (COLS * (W + 16) + 16, 110 + filas * (H + 96)), MARFIL)
    d = ImageDraw.Draw(hoja)
    d.text((16, 30), f"Cláusula Legal · {slug} · hoja de contacto ({tl['duracion_s']} s)", font=sans(34, "ExtraBold"), fill=AZUL_NOCHE)
    with tempfile.TemporaryDirectory() as tmp:
        for i, (t, tid, txt) in enumerate(tomas):
            png = Path(tmp) / f"{i}.png"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1",
                            str(png)], check=True)
            im = Image.open(png).convert("RGB").resize((W, H), Image.LANCZOS)
            x, y = 16 + (i % COLS) * (W + 16), 100 + (i // COLS) * (H + 96)
            hoja.paste(im, (x, y))
            d.text((x, y + H + 8), f"{int(t // 60)}:{t % 60:05.2f} · {tid}", font=sans(20, "Bold"), fill=DORADO)
            d.text((x, y + H + 36), txt[:38] + ("…" if len(txt) > 38 else ""), font=sans(19, "Medium"), fill=AZUL_NOCHE)
    destino = sal / f"{slug}_hoja_contacto.jpg"
    hoja.save(destino, quality=90)
    print(f"Hoja de contacto: {destino}")


if __name__ == "__main__":
    main()
