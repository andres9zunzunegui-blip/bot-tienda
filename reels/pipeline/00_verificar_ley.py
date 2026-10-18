#!/usr/bin/env python3
"""Paso 0 — Agente jurídico: verifica contra InfoLEG el texto vigente de cada artículo del guion.

Compara palabra por palabra (epígrafe + texto) los artículos y concordancias del guion con el texto
oficial. Si algo no coincide, FRENA la producción (exit 1). También corre el control de literalidad
de la Voz de la ley (las frases unidas = el artículo completo).

Uso:
  python pipeline/00_verificar_ley.py ep03_957_1015                    # descarga InfoLEG
  python pipeline/00_verificar_ley.py ep03_957_1015 --texto archivo.txt  # usa un texto ya descargado
"""
import argparse
import datetime
import html
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.comun import cargar_guion, dir_episodio, verificar_literalidad  # noqa: E402

URL_INFOLEG = "https://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/235975/norma.htm"


def descargar():
    with urllib.request.urlopen(URL_INFOLEG, timeout=60) as r:
        crudo = r.read().decode("latin-1", errors="replace")
    crudo = re.sub(r"<[^>]+>", " ", crudo)
    return html.unescape(crudo)


def articulo(texto, numero):
    m = re.search(rf"ART[IÍ]CULO\s+{numero}\s*\.?-\s*(.*?)(?=ART[IÍ]CULO\s+\d+\s*\.?-|$)", texto, re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--texto", help="texto de InfoLEG ya descargado (si no hay acceso directo)")
    args = ap.parse_args()
    guion = cargar_guion(args.slug)
    fuente = Path(args.texto).read_text(encoding="utf-8") if args.texto else descargar()
    filas, ok = [], True
    for a in guion["articulos"] + guion.get("concordancias", []):
        oficial = articulo(fuente, a["numero"])
        propio = f"{a['epigrafe']}. {a['texto']}"
        coincide = oficial is not None and oficial == propio
        ok &= coincide
        filas.append(f"- Art. {a['numero']} ({a['epigrafe']}): {'OK, coincide palabra por palabra' if coincide else 'NO COINCIDE'}")
        if not coincide:
            filas.append(f"  - InfoLEG: {oficial}\n  - Guion:   {propio}")
    errores = verificar_literalidad(guion)
    ok &= not errores
    informe = [f"# Verificación jurídica — {guion['slug']}", "",
               f"Fuente: InfoLEG, Ley 26.994 (texto actualizado) — {URL_INFOLEG}",
               f"Fecha: {datetime.date.today().isoformat()}", "", "## Texto de los artículos", *filas, "",
               "## Literalidad de la Voz de la ley",
               *(errores or ["- OK: las frases leídas forman el artículo completo, sin cambios."]), ""]
    destino = dir_episodio(args.slug) / "verificacion" / "informe.md"
    destino.parent.mkdir(exist_ok=True)
    destino.write_text("\n".join(informe), encoding="utf-8")
    print("\n".join(informe))
    if not ok:
        sys.exit("FRENO: corregir el guion antes de producir.")


if __name__ == "__main__":
    main()
