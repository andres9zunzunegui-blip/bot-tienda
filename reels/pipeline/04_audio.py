#!/usr/bin/env python3
"""Paso 4 — Escucha previa de efectos y música (todo sintetizado, sin samples de terceros).

El compositor (paso 5) ya mezcla todo solo: voces + un efecto por acción + música que baja cuando hablan.
Este script sirve para escuchar/ajustar la librería antes de renderizar.

Uso:
  python pipeline/04_audio.py                  # escribe reels/assets/sonido/*.wav
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.audio import escribir_wav, musica, sfx  # noqa: E402
from lib.comun import RAIZ  # noqa: E402

EFECTOS = ["whoosh", "pop", "brillo", "ding", "apreton", "golpe_libro", "pagina", "papeles", "boing", "freno",
           "timbre_bici", "holograma", "reflector", "sello", "marcador"]

if __name__ == "__main__":
    destino = RAIZ / "assets" / "sonido"
    destino.mkdir(parents=True, exist_ok=True)
    for e in EFECTOS:
        escribir_wav(destino / f"{e}.wav", sfx(e))
    escribir_wav(destino / "musica_loop_20s.wav", musica(20.0))
    print(f"Efectos y música en {destino}")
