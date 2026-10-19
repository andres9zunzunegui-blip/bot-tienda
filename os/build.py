#!/usr/bin/env python3
"""Arma dist.html = base.html + modulos/*.html (en orden) antes de </body></html>."""
import glob, sys
from pathlib import Path
d = Path(__file__).parent
base = (d / "base.html").read_text(encoding="utf-8")
cola = "</body></html>"
assert base.rstrip().endswith(cola)
mods = sorted(glob.glob(str(d / "modulos" / "*.html")))
solo = sys.argv[1:]  # opcional: nombres de módulos a incluir
partes = [Path(m).read_text(encoding="utf-8") for m in mods if not solo or any(s in m for s in solo)]
out = base.rstrip()[:-len(cola)] + "\n".join(partes) + "\n" + cola
nombre = "dist.html" if not solo else "dist-" + "-".join(solo) + ".html"
(d / nombre).write_text(out, encoding="utf-8")
print(f"{nombre}: {len(out)/1024:.0f} KB, módulos: {[Path(m).name for m in mods if not solo or any(s in m for s in solo)]}")
