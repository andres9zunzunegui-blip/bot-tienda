#!/usr/bin/env python3
"""Paso 7 — Descripción del reel y primer comentario con fuentes (para revisión; NO se publica nada).

Los artículos se copian del guion, que el paso 0 ya verificó palabra por palabra contra InfoLEG.

Uso:
  python pipeline/07_textos.py ep03_957_1015
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.comun import cargar_guion, dir_episodio  # noqa: E402

AVISO = "Contenido informativo: no reemplaza el asesoramiento de un abogado matriculado."
URL_INFOLEG = "https://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/235975/norma.htm"


def literal(a):
    return f"ARTÍCULO {a['numero']}.- {a['epigrafe']}. {a['texto']}"


def main():
    slug = sys.argv[1]
    g = cargar_guion(slug)
    pub = g["publicacion"]
    todos = {a["numero"]: a for a in g["articulos"] + g.get("concordancias", [])}
    partes = [pub["mini_historia"], "", "📕 Lo que dice la ley (Código Civil y Comercial de la Nación):", ""]
    partes += [literal(a) for a in g["articulos"]]
    partes += ["", f"➕ {pub['dato_extra']['texto']}", literal(todos[pub["dato_extra"]["articulo"]])]
    if pub.get("excepcion"):
        partes += ["", f"⚠️ {pub['excepcion']['texto']}", literal(todos[pub["excepcion"]["articulo"]])]
    partes += ["", AVISO, "", " ".join(pub["hashtags"])]
    usados = [a["numero"] for a in g["articulos"]] + [pub["dato_extra"]["articulo"]]
    if pub.get("excepcion"):
        usados.append(pub["excepcion"]["articulo"])
    comentario = ["📚 Fuentes", "",
                  f"Código Civil y Comercial de la Nación (Ley 26.994), arts. {', '.join(map(str, usados))} — texto vigente según InfoLEG:",
                  URL_INFOLEG, "", "Texto copiado tal cual de la fuente oficial."]
    sal = dir_episodio(slug) / "salida"
    sal.mkdir(exist_ok=True)
    (sal / "descripcion.txt").write_text("\n".join(partes) + "\n", encoding="utf-8")
    (sal / "primer_comentario.txt").write_text("\n".join(comentario) + "\n", encoding="utf-8")
    print("\n".join(partes))
    print("\n-----\n" + "\n".join(comentario))
    print(f"\n({len(chr(10).join(partes))} caracteres; límite de Instagram: 2200)")


if __name__ == "__main__":
    main()
