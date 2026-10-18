#!/usr/bin/env python3
"""Paso 3 — Voces con motor propio (Chatterbox multilingüe + moldes de cada personaje) y control con faster-whisper.

Para cada línea del guion: 2 tomas → se transcriben con faster-whisper → se queda la que dice EXACTAMENTE
el guion (si las dos, la de duración más natural). Si ninguna coincide, se reintenta hasta 3 veces más y,
si sigue sin coincidir, FRENA: nunca entra al reel una voz que no diga el texto literal.

Moldes (grabaciones propias, NUNCA voces de biblioteca de terceros):
  reels/voces/moldes/clausulo.wav, codiguito_grave.wav, inciso.wav, resaltato.wav, voz_ley.wav

Salida: episodios/<slug>/salida/voces/<id>.wav + <id>.palabras.json (tiempos por palabra para el marcador).

Uso (requiere GPU o paciencia en CPU):
  pip install chatterbox-tts faster-whisper
  python pipeline/03_voces.py ep03_957_1015 [--dispositivo cuda]
"""
import argparse
import difflib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.comun import RAIZ, cargar_guion, dir_episodio, lineas_de_voz, normalizar  # noqa: E402

MOLDES = {
    "clausulo": "clausulo.wav",
    "codiguito": "codiguito_grave.wav",   # Codiguito usa el molde grave
    "inciso": "inciso.wav",
    "resaltato": "resaltato.wav",
    "voz_ley": "voz_ley.wav",
}
# Ajustes por personaje: exageración (expresividad) y cfg (ritmo). La Voz de la ley, sobria y pausada.
ESTILO = {
    "clausulo": dict(exaggeration=0.55, cfg_weight=0.5),
    "codiguito": dict(exaggeration=0.6, cfg_weight=0.45),
    "inciso": dict(exaggeration=0.75, cfg_weight=0.4),
    "resaltato": dict(exaggeration=0.8, cfg_weight=0.4),
    "voz_ley": dict(exaggeration=0.35, cfg_weight=0.6),
}
TOMAS = 2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--dispositivo", default="cpu")
    ap.add_argument("--whisper", default="large-v3")
    ap.add_argument("--solo", help="id de una línea para regrabar")
    args = ap.parse_args()

    import torchaudio
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    from faster_whisper import WhisperModel

    dir_moldes = RAIZ / "voces" / "moldes"
    faltan = [m for m in MOLDES.values() if not (dir_moldes / m).exists()]
    if faltan:
        sys.exit(f"Faltan moldes de voz en {dir_moldes}: {', '.join(faltan)}")

    tts = ChatterboxMultilingualTTS.from_pretrained(device=args.dispositivo)
    stt = WhisperModel(args.whisper, device=args.dispositivo, compute_type="int8" if args.dispositivo == "cpu" else "float16")
    salida = dir_episodio(args.slug) / "salida" / "voces"
    tomas_dir = salida / "tomas"
    tomas_dir.mkdir(parents=True, exist_ok=True)
    informe = []

    for vid, personaje, texto in lineas_de_voz(cargar_guion(args.slug)):
        if args.solo and vid != args.solo:
            continue
        objetivo = normalizar(texto)
        candidatas = []
        for intento in range(TOMAS + 3):
            ruta = tomas_dir / f"{vid}_t{intento + 1}.wav"
            wav = tts.generate(texto, language_id="es", audio_prompt_path=str(dir_moldes / MOLDES[personaje]),
                               **ESTILO[personaje])
            torchaudio.save(str(ruta), wav, tts.sr)
            segmentos, _ = stt.transcribe(str(ruta), language="es", word_timestamps=True, beam_size=5)
            palabras = [dict(palabra=w.word.strip(), inicio=round(w.start, 3), fin=round(w.end, 3))
                        for s in segmentos for w in s.words]
            dicho = normalizar(" ".join(p["palabra"] for p in palabras))
            parecido = difflib.SequenceMatcher(None, dicho, objetivo).ratio()
            dur = wav.shape[-1] / tts.sr
            candidatas.append(dict(ruta=ruta, exacta=dicho == objetivo, parecido=parecido, dur=dur, palabras=palabras, dicho=dicho))
            if intento + 1 >= TOMAS and any(c["exacta"] for c in candidatas):
                break
        exactas = [c for c in candidatas if c["exacta"]]
        if not exactas:
            mejor = max(candidatas, key=lambda c: c["parecido"])
            sys.exit(f"FRENO: ninguna toma de {vid} dice el guion.\n  guion: {objetivo}\n  mejor: {mejor['dicho']}")
        esperado = len(texto) / 14.0
        elegida = min(exactas, key=lambda c: abs(c["dur"] - esperado))
        (salida / f"{vid}.wav").write_bytes(elegida["ruta"].read_bytes())
        (salida / f"{vid}.palabras.json").write_text(json.dumps(elegida["palabras"], ensure_ascii=False), encoding="utf-8")
        informe.append(f"{vid}: {len(candidatas)} tomas, elegida {elegida['ruta'].name} ({elegida['dur']:.2f} s) ✓ texto exacto")
        print(informe[-1], flush=True)
    (salida / "informe_voces.txt").write_text("\n".join(informe), encoding="utf-8")


if __name__ == "__main__":
    main()
