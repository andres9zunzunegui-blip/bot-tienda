"""Render de cuadros: cámara sobre planos fijos, efectos de luz, tarjetas de texto y apertura del Código."""
import math
import re
from functools import lru_cache

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

from .comun import (ALTO, AMARILLO, ANCHO, AZUL_NOCHE, DORADO, FUENTES, MARFIL, PERSONAJES,
                    ROJO_CODIGO)

ESCALA_FUENTE = 2.0          # los planos se suben a 2x una sola vez (Lanczos + nitidez)
RATIO = ANCHO / ALTO
Y_TARJETA = 1330             # centro vertical (abajo)
Y_TARJETA_ARRIBA = 360      # para planos con las caras abajo; centro vertical de los subtítulos (zona libre de caras y de la UI de Instagram)
ANCHO_TARJETA = 900


# ---------------------------------------------------------------- fuentes
@lru_cache(None)
def fuente(familia, tam, peso):
    f = ImageFont.truetype(str(FUENTES / f"{familia}.ttf"), tam)
    try:
        f.set_variation_by_name(peso)
    except Exception:
        pass
    return f


def sans(tam, peso="ExtraBold"):
    return fuente("Manrope", tam, peso)


def serif(tam, peso="SemiBold"):
    return fuente("CormorantGaramond", tam, peso)


# ---------------------------------------------------------------- utilidades
def ease(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def ease_out(u):
    u = min(1.0, max(0.0, u))
    return 1 - (1 - u) ** 3


@lru_cache(None)
def plano(ruta):
    im = Image.open(ruta).convert("RGB")
    w, h = im.size
    im = im.resize((int(w * ESCALA_FUENTE), int(h * ESCALA_FUENTE)), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=55, threshold=2))


def caja(im, z, cx, cy):
    """Caja de recorte (en px del plano) para zoom z y foco normalizado (cx, cy)."""
    W, H = im.size
    vh = H / z
    vw = vh * RATIO
    if vw > W:
        vw = W
        vh = vw / RATIO
    x0 = min(max(cx * W - vw / 2, 0), W - vw)
    y0 = min(max(cy * H - vh / 2, 0), H - vh)
    return (x0, y0, x0 + vw, y0 + vh)


def a_cuadro(bx, px, py, im):
    """Convierte coordenadas normalizadas del plano a píxeles del cuadro final."""
    W, H = im.size
    x0, y0, x1, y1 = bx
    return ((px * W - x0) / (x1 - x0) * ANCHO, (py * H - y0) / (y1 - y0) * ALTO, ANCHO / (x1 - x0) * W)


@lru_cache(None)
def sprite_glow(tam=512):
    y, x = np.mgrid[-1:1:tam * 1j, -1:1:tam * 1j]
    r = np.sqrt(x * x + y * y)
    a = np.clip(1 - r, 0, 1) ** 2.2
    return Image.fromarray((a * 255).astype(np.uint8), "L")


@lru_cache(None)
def sprite_estrella(tam=512):
    y, x = np.mgrid[-1:1:tam * 1j, -1:1:tam * 1j]
    r = np.sqrt(x * x + y * y) + 1e-6
    rayos = np.exp(-np.abs(x) * 60) * np.exp(-np.abs(y) * 2.5) + np.exp(-np.abs(y) * 60) * np.exp(-np.abs(x) * 2.5)
    diag = (np.exp(-np.abs(x - y) * 80) + np.exp(-np.abs(x + y) * 80)) * np.exp(-r * 5) * 0.5
    nucleo = np.exp(-r * 14) + 0.35 * np.exp(-r * 4)
    a = np.clip(rayos + diag + nucleo, 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8), "L")


@lru_cache(None)
def mascara_vineta():
    y, x = np.mgrid[-1:1:ALTO * 1j, -1:1:ANCHO * 1j]
    r = np.sqrt((x * 0.9) ** 2 + (y * 0.75) ** 2)
    m = 1 - np.clip((r - 0.65) / 0.75, 0, 1) ** 1.6 * 0.42
    return Image.fromarray((m * 255).astype(np.uint8), "L").convert("RGB")


def pegar_luz(luz, sprite, cx, cy, radio, color, intensidad):
    if intensidad <= 0.01 or radio < 2:
        return
    d = int(radio * 2)
    s = sprite.resize((d, d), Image.BILINEAR)
    s = s.point(lambda v: int(v * min(1.0, intensidad)))
    capa = Image.new("RGB", (d, d), tuple(int(c) for c in color))
    luz.paste(capa, (int(cx - radio), int(cy - radio)), s)


class Particulas:
    """Polvo en suspensión iluminado por la ventana (da profundidad sobre el plano fijo)."""

    def __init__(self, semilla, n=46):
        r = np.random.default_rng(semilla)
        self.x = r.uniform(0, ANCHO, n)
        self.y = r.uniform(0, ALTO * 0.85, n)
        self.v = r.uniform(8, 26, n)
        self.tam = r.uniform(2.5, 9, n)
        self.fase = r.uniform(0, 6.28, n)
        self.prof = r.uniform(0.4, 1.6, n)

    def dibujar(self, luz, t, despl_x=0.0):
        for i in range(len(self.x)):
            x = (self.x[i] + math.sin(t * 0.6 + self.fase[i]) * 18 + despl_x * self.prof[i]) % ANCHO
            y = (self.y[i] - t * self.v[i]) % (ALTO * 0.85)
            a = 0.25 + 0.25 * math.sin(t * 2.2 + self.fase[i])
            pegar_luz(luz, sprite_glow(), x, y, self.tam[i] * self.prof[i], (255, 236, 200), a)


# ---------------------------------------------------------------- tarjetas de texto
def _palabras_resaltadas(palabras, resaltar):
    """Índices de palabras que forman cada frase a resaltar (comparando sin signos)."""
    limpio = [re.sub(r"[^\wáéíóúñü]", "", p.lower()) for p in palabras]
    grupos = []
    for frase in resaltar:
        objetivo = [re.sub(r"[^\wáéíóúñü]", "", p.lower()) for p in frase.split()]
        for i in range(len(limpio) - len(objetivo) + 1):
            if limpio[i:i + len(objetivo)] == objetivo:
                grupos.append(list(range(i, i + len(objetivo))))
                break
    return grupos


def _maquetar(palabras, f, ancho_max):
    esp = f.getlength(" ")
    lineas, actual, x = [], [], 0.0
    for i, p in enumerate(palabras):
        w = f.getlength(p)
        if actual and x + esp + w > ancho_max:
            lineas.append(actual)
            actual, x = [], 0.0
        if actual:
            x += esp
        actual.append((i, x, w))
        x += w
    if actual:
        lineas.append(actual)
    return lineas, esp


def tarjeta(estilo, texto, resaltar, progresos, personaje=None, articulo=None):
    """Devuelve una imagen RGBA. progresos: avance (0..1) del marcador amarillo por cada frase resaltada."""
    palabras = texto.split()
    if estilo == "ley":
        f = serif(70, "SemiBold")
        fondo, tinta, alto_linea = MARFIL + (244,), AZUL_NOCHE, 80
        etiqueta = f"LA VOZ DE LA LEY  ·  ART. {articulo} CCyC"
    elif estilo == "final":
        f = serif(124, "Bold")
        fondo, tinta, alto_linea = MARFIL + (240,), AZUL_NOCHE, 130
        etiqueta = None
    else:
        f = sans(66 if estilo == "gancho" else 58, "ExtraBold")
        fondo, tinta, alto_linea = AZUL_NOCHE + (222,), (255, 255, 255), 80 if estilo == "gancho" else 72
        etiqueta = PERSONAJES[personaje]["nombre"] if personaje else None
    pad_x, pad_y = 46, 34
    lineas, _ = _maquetar(palabras, f, ANCHO_TARJETA - 2 * pad_x)
    alto_txt = alto_linea * len(lineas)
    extra = 54 if (etiqueta and estilo == "ley") else 0
    W = ANCHO_TARJETA if estilo != "final" else min(ANCHO - 80, int(max(sum(w for _, _, w in l) for l in lineas) + 2 * pad_x + 40))
    H = alto_txt + 2 * pad_y + extra
    margen_tag = 40 if (etiqueta and estilo != "ley") else 0
    im = Image.new("RGBA", (W, H + margen_tag), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # sombra suave
    sombra = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle((8, margen_tag + 12, W - 8, H + margen_tag - 2), 26, fill=(0, 0, 0, 90))
    im.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(14)))
    d.rounded_rectangle((0, margen_tag, W - 1, H + margen_tag - 1), 26, fill=fondo)
    if estilo == "ley":
        d.rectangle((36, margen_tag + 22, W - 36, margen_tag + 25), fill=DORADO)
        d.text((W / 2, margen_tag + 46), etiqueta, font=sans(26, "Bold"), fill=DORADO, anchor="mm")
    elif etiqueta:
        col = PERSONAJES[personaje]["color"]
        tf = sans(28, "ExtraBold")
        tw = tf.getlength(etiqueta) + 40
        d.rounded_rectangle((34, 0, 34 + tw, 56), 28, fill=col)
        d.text((34 + tw / 2, 28), etiqueta, font=tf, fill=AZUL_NOCHE if col in (AMARILLO, DORADO) else (255, 255, 255), anchor="mm")
    grupos = _palabras_resaltadas(palabras, resaltar)
    en_grupo = {}
    for gi, g in enumerate(grupos):
        for i in g:
            en_grupo[i] = gi
    ancho_pal = {i: w for l in lineas for i, _, w in l}
    masc = Image.new("L", im.size, 0)
    dm = ImageDraw.Draw(masc)
    capa_tinta = Image.new("RGBA", im.size, (0, 0, 0, 0))
    dt = ImageDraw.Draw(capa_tinta)
    y = margen_tag + pad_y + extra
    for linea in lineas:
        ancho_linea = linea[-1][1] + linea[-1][2]
        x0 = (W - ancho_linea) / 2
        # marcador amarillo: barre de izquierda a derecha según el progreso del grupo
        for gi, g in enumerate(grupos):
            en_l = [(i, x, w) for i, x, w in linea if i in g]
            p = progresos[gi] if gi < len(progresos) else 0
            if not en_l or p <= 0:
                continue
            ini = x0 + en_l[0][1] - 7
            fin = x0 + en_l[-1][1] + en_l[-1][2] + 7
            total_g = sum(ancho_pal[i] for i in g)
            antes = sum(ancho_pal[i] for i in g if i < en_l[0][0])
            en_linea = sum(w for _, _, w in en_l)
            frac = min(1.0, max(0.0, (p * total_g - antes) / max(en_linea, 1)))
            if frac > 0:
                caja_m = (ini, y + alto_linea * 0.12, ini + (fin - ini) * frac, y + alto_linea * 0.92)
                d.rounded_rectangle(caja_m, 10, fill=AMARILLO + (255,))
                dm.rounded_rectangle(caja_m, 10, fill=255)
        for i, x, w in linea:
            d.text((x0 + x, y + alto_linea / 2), palabras[i], font=f, fill=tinta, anchor="lm")
            dt.text((x0 + x, y + alto_linea / 2), palabras[i], font=f, fill=AZUL_NOCHE, anchor="lm")
        y += alto_linea
    # sobre el marcador amarillo el texto va siempre en azul noche (legible a mitad del barrido)
    im.paste(capa_tinta, (0, 0), ImageChops.multiply(masc, capa_tinta.getchannel("A")))
    return im


def pegar_tarjeta(cuadro, tj, cy, aparicion=1.0, salida=1.0):
    a = min(aparicion, salida)
    if a <= 0:
        return
    s = 0.92 + 0.08 * ease_out(aparicion)
    if s < 0.999:
        tj = tj.resize((max(1, int(tj.width * s)), max(1, int(tj.height * s))), Image.BILINEAR)
    if a < 0.999:
        alfa = tj.getchannel("A").point(lambda v: int(v * a))
        tj = tj.copy()
        tj.putalpha(alfa)
    cuadro.paste(tj, (int((ANCHO - tj.width) / 2), int(cy - tj.height / 2)), tj)


# ---------------------------------------------------------------- Código Civil y Comercial (apertura y páginas)
@lru_cache(None)
def textura_cuero():
    r = np.random.default_rng(3)
    ruido = r.standard_normal((ALTO // 4, ANCHO // 4))
    im = Image.fromarray(np.uint8(np.clip(128 + ruido * 40, 0, 255)), "L").resize((ANCHO, ALTO), Image.BICUBIC)
    im = im.filter(ImageFilter.GaussianBlur(1.2))
    base = Image.new("RGB", (ANCHO, ALTO), ROJO_CODIGO)
    osc = Image.new("RGB", (ANCHO, ALTO), (120, 14, 18))
    return Image.composite(base, osc, im)


@lru_cache(None)
def tapa_codigo():
    im = textura_cuero().copy()
    d = ImageDraw.Draw(im)
    for m, g in ((60, 4), (78, 2)):
        d.rectangle((m, m, ANCHO - m, ALTO - m), outline=(255, 255, 255), width=g)
    blanco = (250, 248, 244)
    for i, (txt, tam) in enumerate((("CÓDIGO CIVIL", 112), ("Y COMERCIAL", 112), ("DE LA NACIÓN", 92))):
        f = serif(tam, "Bold")
        d.text((ANCHO / 2, 700 + i * 150), txt, font=f, fill=blanco, anchor="mm")
    d.rectangle((ANCHO / 2 - 140, 1060, ANCHO / 2 + 140, 1063), fill=blanco)
    d.text((ANCHO / 2, 1130), "REPÚBLICA ARGENTINA", font=sans(34, "SemiBold"), fill=blanco, anchor="mm")
    return im


@lru_cache(None)
def fondo_escritorio():
    y = np.linspace(0, 1, ALTO)[:, None]
    x = np.linspace(0, 1, ANCHO)[None, :]
    vetas = 0.5 + 0.5 * np.sin(x * 40 + np.sin(y * 9) * 2.0)
    base = np.stack([60 + 30 * vetas, 34 + 18 * vetas, 22 + 10 * vetas], -1) * (0.7 + 0.3 * (1 - y))[..., None]
    return Image.fromarray(np.uint8(base), "RGB")


@lru_cache(None)
def pagina(articulo, epigrafe, cuerpo):
    """Página marfil del Código abierta en el artículo (texto literal, superpuesto en edición)."""
    im = fondo_escritorio().copy()
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = 70, 150, ANCHO - 50, ALTO - 170
    sombra = Image.new("L", im.size, 0)
    ImageDraw.Draw(sombra).rectangle((x0 + 14, y0 + 20, x1 + 14, y1 + 24), fill=170)
    im.paste((0, 0, 0), (0, 0), sombra.filter(ImageFilter.GaussianBlur(22)))
    d.rectangle((x0, y0, x1, y1), fill=MARFIL)
    # sombreado del lomo (curvatura de la hoja)
    g = np.linspace(0, 1, 160)[None, :] ** 0.6
    lomo = Image.fromarray(np.uint8(np.repeat(255 * (0.72 + 0.28 * g), y1 - y0, 0)), "L").convert("RGB")
    zona = im.crop((x0, y0, x0 + 160, y1))
    im.paste(ImageChops.multiply(zona, lomo), (x0, y0))
    d = ImageDraw.Draw(im)
    d.text((ANCHO / 2 + 30, y0 + 70), "CÓDIGO CIVIL Y COMERCIAL DE LA NACIÓN", font=sans(26, "Bold"), fill=DORADO, anchor="mm")
    d.rectangle((ANCHO / 2 - 150, y0 + 100, ANCHO / 2 + 210, y0 + 102), fill=DORADO)
    d.text((ANCHO / 2 + 30, y0 + 470), f"ARTÍCULO {articulo}", font=serif(124, "Bold"), fill=AZUL_NOCHE, anchor="mm")
    d.text((ANCHO / 2 + 30, y0 + 600), epigrafe, font=fuente("CormorantGaramond", 78, "Medium"), fill=ROJO_CODIGO, anchor="mm")
    f = serif(56, "Medium")
    pal = cuerpo.split()
    lineas, _ = _maquetar(pal, f, x1 - x0 - 210)
    yy = y0 + 760
    for l in lineas:
        d.text((x0 + 125, yy), " ".join(pal[i] for i, _, _ in l), font=f, fill=(60, 64, 76), anchor="lm")
        yy += 76
    # ornamento inferior
    yy += 70
    d.rectangle((ANCHO / 2 - 120, yy, ANCHO / 2 + 180, yy + 2), fill=DORADO)
    d.ellipse((ANCHO / 2 + 30 - 16, yy - 15, ANCHO / 2 + 30 + 16, yy + 17), outline=DORADO, width=3)
    return im


def cuadro_pagina(art, t_local, dur, previa=None):
    """Página del artículo con empuje de cámara, brillo dorado y (opcional) vuelta de hoja desde 'previa'."""
    base = pagina(art["numero"], art["epigrafe"], art["texto"])
    z = 1.0 + 0.10 * ease(t_local / max(dur, 0.01))
    bx = caja(base, z, 0.53, 0.42)
    im = base.resize((ANCHO, ALTO), Image.BILINEAR, box=bx)
    luz = Image.new("RGB", (ANCHO, ALTO), (0, 0, 0))
    pegar_luz(luz, sprite_glow(), ANCHO / 2 + 30, 560, 520, (255, 210, 120), 0.35 + 0.15 * math.sin(t_local * 3))
    Particulas(11, 30).dibujar(luz, t_local)
    im = ImageChops.screen(im, luz)
    if previa is not None and t_local < 0.45:
        u = ease(t_local / 0.45)
        ancho = int(ANCHO * (1 - u))
        if ancho > 4:
            hoja = previa.resize((ancho, ALTO), Image.BILINEAR)
            sombra = Image.new("RGB", (min(ANCHO - ancho, 120) or 1, ALTO), (0, 0, 0))
            im.paste(hoja, (0, 0))
            if ancho < ANCHO:
                im.paste(ImageChops.blend(im.crop((ancho, 0, ancho + sombra.width, ALTO)), sombra, 0.35 * (1 - u)), (ancho, 0))
    return im


def cuadro_apertura(art, t_local, dur):
    """La tapa roja del Código (letras blancas) se abre y muestra el artículo."""
    t_abre0, t_abre1 = 0.55, 1.35
    if t_local < t_abre0:
        z = 1.0 + 0.04 * t_local
        im = tapa_codigo().resize((ANCHO, ALTO), Image.BILINEAR, box=caja(tapa_codigo(), z, 0.5, 0.45))
        # barrido especular sobre el cuero
        luz = Image.new("RGB", (ANCHO, ALTO), (0, 0, 0))
        u = t_local / t_abre0
        pegar_luz(luz, sprite_glow(), -200 + u * 1500, 300 + u * 1200, 700, (255, 190, 170), 0.35)
        return ImageChops.screen(im, luz)
    pag = cuadro_pagina(art, t_local - t_abre0, dur - t_abre0)
    if t_local < t_abre1:
        u = ease((t_local - t_abre0) / (t_abre1 - t_abre0))
        ang = u * math.pi * 0.62
        ancho = ANCHO * math.cos(ang)
        if ancho > 6:
            tapa = tapa_codigo()
            crece = 1 + 0.32 * math.sin(ang)
            # perspectiva: borde derecho más alto a medida que la tapa viene hacia la cámara
            coef = _coef_perspectiva(
                [(0, 0), (ancho, -ALTO * (crece - 1) / 2), (ancho, ALTO + ALTO * (crece - 1) / 2), (0, ALTO)],
                [(0, 0), (ANCHO, 0), (ANCHO, ALTO), (0, ALTO)])
            capa = tapa.transform((ANCHO, ALTO), Image.PERSPECTIVE, coef, Image.BILINEAR)
            masc = Image.new("L", (ANCHO, ALTO), 255).transform((ANCHO, ALTO), Image.PERSPECTIVE, coef, Image.BILINEAR)
            sombra = Image.new("L", (ANCHO, ALTO), 0)
            ImageDraw.Draw(sombra).rectangle((0, 0, int(ancho) + 90, ALTO), fill=int(150 * (1 - u)))
            pag.paste((0, 0, 0), (0, 0), sombra.filter(ImageFilter.GaussianBlur(40)))
            oscuro = ImageChops.multiply(capa, Image.new("RGB", (ANCHO, ALTO), (int(255 - 90 * u),) * 3))
            pag.paste(oscuro, (0, 0), masc)
    if t_local > dur - 0.14:
        pag = Image.blend(pag, Image.new("RGB", (ANCHO, ALTO), (255, 250, 235)), (t_local - (dur - 0.14)) / 0.14 * 0.8)
    return pag


def _coef_perspectiva(destino, origen):
    m = []
    for (x, y), (X, Y) in zip(destino, origen):
        m.append([x, y, 1, 0, 0, 0, -X * x, -X * y])
        m.append([0, 0, 0, x, y, 1, -Y * x, -Y * y])
    A = np.array(m, float)
    B = np.array(origen, float).reshape(8)
    return np.linalg.solve(A, B).tolist()
