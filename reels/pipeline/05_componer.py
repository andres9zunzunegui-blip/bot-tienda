#!/usr/bin/env python3
"""Paso 5 — Compone el reel: cámara sobre planos, efectos, tarjetas, apertura del Código, sonido y loop.

Uso:
  python pipeline/05_componer.py ep03_957_1015                 # render completo
  python pipeline/05_componer.py ep03_957_1015 --cuadros 0.5,12,40   # solo cuadros sueltos (PNG) para revisar
"""
import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import render as R  # noqa: E402
from lib.audio import mezclar  # noqa: E402
from lib.comun import (ALTO, ANCHO, FPS, INICIO_VOZ, cargar_guion, dir_episodio,  # noqa: E402
                       linea_de_tiempo, verificar_literalidad)

PASO_PROGRESO = 8


class Compositor:
    def __init__(self, slug):
        self.slug = slug
        self.guion = cargar_guion(slug)
        self.dir = dir_episodio(slug)
        self.voces = self.dir / "salida" / "voces"
        self.tramos, self.total = linea_de_tiempo(self.guion, self.voces)
        self.arts = {a["numero"]: a for a in self.guion["articulos"]}
        self.planos = [(tr, p) for tr in self.tramos for p in tr["planos"]]
        self.cache_tarjetas = {}
        self.ultimo = None
        self.previas = {}
        self.particulas = {}

    # ------------------------------------------------------------ cámara
    def _ruta(self, img):
        return str(self.dir / "planos" / f"{img}.png")

    def _parametros(self, p, t):
        u = (t - p["_t0"]) / max(p["_dur"], 1e-3)
        s = 0.5 * min(max(u, 0), 1) + 0.5 * R.ease(u)
        z0, z1 = p.get("z", [1.05, 1.15])
        (fx0, fy0), (fx1, fy1) = p.get("foco", [[0.5, 0.5], [0.5, 0.5]])
        z = z0 + (z1 - z0) * s
        z *= 1 + 0.035 * (1 - R.ease_out((t - p["_t0"]) / 0.25))      # pequeño "punch-in" al corte
        cx = fx0 + (fx1 - fx0) * s + (0.0025 * math.sin(2 * math.pi * 0.5 * t) + 0.0015 * math.sin(2 * math.pi * 1.1 * t + 2)) / z
        cy = fy0 + (fy1 - fy0) * s + 0.002 * math.sin(2 * math.pi * 0.4 * t + 1) / z
        if p.get("tambaleo"):
            cx += 0.008 * p["tambaleo"] * math.sin(2 * math.pi * 2.2 * (t - p["_t0"])) / z
        return z, cx, cy

    def _plano(self, tr, p, t, con_fx=True):
        if p["img"] == "@pagina":
            return R.cuadro_pagina(self.arts[tr["articulo"]], t - p["_t0"], p["_dur"], previa=self._previa(p))
        fuente = R.plano(self._ruta(p["img"]))
        z, cx, cy = self._parametros(p, t)
        bx = R.caja(fuente, z, cx, cy)
        im = fuente.resize((ANCHO, ALTO), Image.BILINEAR, box=bx)
        if not con_fx:
            return im
        luz = Image.new("RGB", (ANCHO, ALTO), (0, 0, 0))
        clave = id(p)
        if clave not in self.particulas:
            self.particulas[clave] = R.Particulas(len(self.particulas) + 5)
        self.particulas[clave].dibujar(luz, t, despl_x=(cx - 0.5) * -300)
        R.pegar_luz(luz, R.sprite_glow(), 880 + 60 * math.sin(0.3 * t), 230, 720, (255, 170, 90), 0.16)
        tl = t - p["_t0"]
        for fx in p.get("fx", []):
            px, py, esc = R.a_cuadro(bx, fx["pos"][0], fx["pos"][1], fuente)
            if fx["tipo"] == "brillo_zona":
                R.pegar_luz(luz, R.sprite_glow(), px, py, fx["radio"] * esc, fx["color"], 0.32 + 0.14 * math.sin(tl * 5))
            elif fx["tipo"] == "destello" and fx["t"] <= tl <= fx["t"] + 0.6:
                v = math.sin(math.pi * (tl - fx["t"]) / 0.6)
                R.pegar_luz(luz, R.sprite_estrella(), px, py, 190 * v, (255, 246, 225), v)
                R.pegar_luz(luz, R.sprite_glow(), px, py, 120 * v, (255, 220, 150), 0.6 * v)
        im = ImageChops.screen(im, luz)
        return ImageChops.multiply(im, R.mascara_vineta())

    def _previa(self, p):
        if id(p) not in self.previas:
            self.previas[id(p)] = self.ultimo   # último cuadro antes de que empiece la página
        return self.previas[id(p)]

    # ------------------------------------------------------------ transiciones
    def _whoosh_en(self, tr, p):
        return any(e["s"] == "whoosh" and abs(tr["t0"] + e["t"] - p["_t0"]) < 0.06 for e in tr["sfx"])

    def _barrido(self, im, k):
        if k <= 1.05:
            return im
        return im.resize((max(8, int(ANCHO / k)), ALTO), Image.BILINEAR).resize((ANCHO, ALTO), Image.BILINEAR)

    # ------------------------------------------------------------ texto
    def _inicio_frase(self, tr, frase):
        if tr.get("palabras"):
            objetivo = R.re.sub(r"[^\wáéíóúñü]", "", frase.split()[0].lower())
            for w in tr["palabras"]:
                if R.re.sub(r"[^\wáéíóúñü]", "", w["palabra"].lower()) == objetivo:
                    return tr["t0"] + tr.get("voz_off", INICIO_VOZ) + w["inicio"]
        pos = max(0, tr["texto"].lower().find(frase.lower()))
        return tr["t0"] + INICIO_VOZ + pos / max(len(tr["texto"]), 1) * tr["voz_dur"]

    def _tarjeta(self, tr, t, es_primero, plano=None):
        if tr["tipo"] == "final":
            estilo, resaltar = "final", [tr["texto"]]
            prog = [min(1.0, max(0.0, (t - tr["t0"] - 0.35) / 0.55))]
        else:
            estilo = "ley" if tr["tipo"] == "ley" else ("gancho" if es_primero else "dialogo")
            resaltar = tr["resaltar"]
            prog = [min(1.0, max(0.0, (t - self._inicio_frase(tr, f)) / 0.35)) for f in resaltar]
        prog = tuple(round(v * PASO_PROGRESO) / PASO_PROGRESO for v in prog)
        clave = (tr["id"], prog)
        if clave not in self.cache_tarjetas:
            self.cache_tarjetas[clave] = R.tarjeta(estilo, tr["texto"], resaltar, prog,
                                                   personaje=tr.get("personaje"), articulo=tr.get("articulo"))
        if estilo == "final":
            cy = 560
        elif plano is not None and plano.get("tarjeta") == "arriba":
            cy = R.Y_TARJETA_ARRIBA
        else:
            cy = R.Y_TARJETA
        return self.cache_tarjetas[clave], cy

    # ------------------------------------------------------------ cuadro
    def cuadro(self, t):
        idx = max(i for i, tr in enumerate(self.tramos) if tr["t0"] <= t + 1e-6)
        tr = self.tramos[idx]
        tl = t - tr["t0"]
        if tr["tipo"] == "apertura":
            im = R.cuadro_apertura(self.arts[tr["articulo"]], tl, tr["dur"])
        elif tr["tipo"] == "loop":
            tr_prev, p_prev = self.planos[-1]
            tr0, p0 = self.planos[0]
            u = R.ease(tl / tr["dur"])
            a = self._plano(tr_prev, p_prev, t)
            b = self._plano(tr0, p0, p0["_t0"])  # mismo encuadre que el primer cuadro del reel
            k = 1 + 9 * math.sin(math.pi * u)
            im = Image.blend(self._barrido(a, k), self._barrido(b, k), u)
            if u > 0.55:
                tj, cy = self._tarjeta(tr0, 0.0, True)
                R.pegar_tarjeta(im, tj, cy, aparicion=(u - 0.55) / 0.45)
            return im
        else:
            p = next(p for p in reversed(tr["planos"]) if p["_t0"] <= t + 1e-6)
            im = self._plano(tr, p, t)
            dt_ini = t - p["_t0"]
            dt_fin = p["_t0"] + p["_dur"] - t
            sig = self._siguiente(tr, p)
            if self._whoosh_en(tr, p) and dt_ini < 0.12 and t > 0.1:
                im = self._barrido(im, 1 + 8 * (1 - dt_ini / 0.12))
            elif dt_ini < 0.1 and t > 0.1 and p["img"] != "@pagina":
                im = im.filter(ImageFilter.GaussianBlur(5 * (1 - dt_ini / 0.1)))   # ajuste de foco al corte
            if sig and self._whoosh_en(*sig) and dt_fin < 0.1:
                im = self._barrido(im, 1 + 8 * (1 - dt_fin / 0.1))
            hay_texto = tr.get("texto") and p["img"] != "@pagina"
            if hay_texto:
                tj, cy = self._tarjeta(tr, t, idx == 0, p)
                ap = 1.0 if idx == 0 else (t - tr["t0"]) / 0.15
                sal = (tr["t0"] + tr["dur"] - t) / 0.1 if tr["tipo"] != "final" else 1.0
                R.pegar_tarjeta(im, tj, cy, aparicion=ap, salida=sal)
        self.ultimo = im
        return im

    def _siguiente(self, tr, p):
        for i, (a, b) in enumerate(self.planos):
            if b is p and i + 1 < len(self.planos):
                return self.planos[i + 1]
        return None

    # ------------------------------------------------------------ salida
    def render(self, salida_mp4):
        tmp_video = salida_mp4.with_suffix(".video.mp4")
        tmp_audio = salida_mp4.with_suffix(".mezcla.wav")
        n = int(round(self.total * FPS))
        ff = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{ANCHO}x{ALTO}",
             "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
             str(tmp_video)], stdin=subprocess.PIPE)
        for i in range(n):
            ff.stdin.write(self.cuadro(i / FPS).tobytes())
            if i % (FPS * 5) == 0:
                print(f"  cuadro {i}/{n}", flush=True)
        ff.stdin.close()
        ff.wait()
        mezclar(self.tramos, self.total, tmp_audio)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp_video), "-i", str(tmp_audio),
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
                        str(salida_mp4)], check=True)
        tmp_video.unlink()
        tmp_audio.unlink()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--cuadros", help="tiempos en segundos separados por coma para exportar PNG sueltos")
    args = ap.parse_args()
    c = Compositor(args.slug)
    errores = verificar_literalidad(c.guion)
    if errores:
        sys.exit("FRENO (regla de oro 1):\n" + "\n".join(errores))
    salida = c.dir / "salida"
    salida.mkdir(exist_ok=True)
    faltan = [tr["id"] for tr in c.tramos if tr.get("estimada")]
    estado = {"duracion_s": round(c.total, 2), "voces_faltantes": faltan,
              "tramos": [{k: (str(v) if k == "voz" else v) for k, v in tr.items() if k not in ("planos", "palabras")}
                         for tr in c.tramos]}
    (salida / "linea_de_tiempo.json").write_text(json.dumps(estado, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Duración: {c.total:.1f} s · tramos: {len(c.tramos)} · voces faltantes: {len(faltan)}")
    if not 45 <= c.total <= 60:
        print("AVISO: la duración queda fuera de 45–60 s; ajustar guion o pausas.")
    if args.cuadros:
        for ts in args.cuadros.split(","):
            t = float(ts)
            c.cuadro(t).save(salida / f"cuadro_{t:05.2f}.png")
        return
    destino = salida / f"{args.slug}_reel.mp4"
    c.render(destino)
    print(f"Listo: {destino}")


if __name__ == "__main__":
    main()
