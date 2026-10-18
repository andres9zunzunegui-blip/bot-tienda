#!/usr/bin/env python3
"""Paso 1 — Planos clave en estilo cine 3D (Floot generate_image con imágenes de referencia).

Floot se usa desde Claude (conector MCP), no desde Python. Este script:
  1) arma, a partir de planos.json del episodio, el pedido exacto para generate_image
     (prompt con el estilo de la serie + referencias fijas del elenco), y
  2) controla que estén todos los PNG en episodios/<slug>/planos/ antes de componer.

Uso:
  python pipeline/01_planos_floot.py ep03_957_1015 --pedido     # imprime los lotes para Floot
  python pipeline/01_planos_floot.py ep03_957_1015 --control    # verifica planos y tamaños
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.comun import ELENCO, cargar_guion, dir_episodio  # noqa: E402


def planos_usados(guion):
    usados = set()
    for s in guion["segmentos"]:
        for p in s.get("planos", []):
            usados.add(p["img"])
        for f in s.get("frases", []):
            for p in f["planos"]:
                usados.add(p["img"])
    return sorted(u for u in usados if not u.startswith("@"))


def pedido(slug):
    elenco = json.loads((ELENCO / "elenco.json").read_text(encoding="utf-8"))
    guion = cargar_guion(slug)
    var = guion.get("clausulo_variante", "anteojos")
    ref_cl = elenco["personajes"]["clausulo"]["variantes"][var]["floot"]
    ref = {"clausulo": ref_cl, "codiguito": elenco["personajes"]["codiguito"]["floot"],
           "inciso": elenco["personajes"]["inciso"]["floot"], "resaltato": elenco["personajes"]["resaltato"]["floot"]}
    planos = json.loads((dir_episodio(slug) / "planos.json").read_text(encoding="utf-8"))
    imagenes = []
    for p in planos:
        prompt = (f"{elenco['set']['estilo']}. Same law office set. {p['accion']} "
                  + " ".join(f"The {k} is EXACTLY the character from the reference: {elenco['personajes'][k]['descripcion_prompt']}."
                             for k in p["personajes"])
                  + " Characters well separated, fully in frame, faces uncovered. " + elenco["set"]["sin_texto"])
        imagenes.append({"name": f"{slug}-{p['id']}", "size": "tall", "prompt": prompt,
                         "reference_images": [ref[k] for k in p["personajes"]][:4]})
    lotes = [imagenes[i:i + 4] for i in range(0, len(imagenes), 4)]   # generate_image acepta hasta 4 por llamada
    print(json.dumps({"projectId": elenco["proyecto_floot"], "lotes": lotes}, ensure_ascii=False, indent=1))


def control(slug):
    faltan = []
    for nombre in planos_usados(cargar_guion(slug)):
        ruta = dir_episodio(slug) / "planos" / f"{nombre}.png"
        if not ruta.exists():
            faltan.append(nombre)
            continue
        w, h = Image.open(ruta).size
        aviso = "" if h / w > 1.6 else "  ← no es vertical"
        print(f"OK  {nombre}  {w}x{h}{aviso}")
    if faltan:
        sys.exit("Faltan planos: " + ", ".join(faltan))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--pedido", action="store_true")
    ap.add_argument("--control", action="store_true")
    a = ap.parse_args()
    pedido(a.slug) if a.pedido else control(a.slug)
