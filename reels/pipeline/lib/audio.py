"""Efectos de sonido y música sintetizados (sin samples de terceros) y mezcla final con ducking."""
import wave
from functools import lru_cache

import numpy as np

from .comun import SR

rng = np.random.default_rng(7)


def _t(d):
    return np.arange(int(d * SR)) / SR


def _env(n, a=0.005, r=0.2, curva=4.0):
    t = np.arange(n) / SR
    att = np.clip(t / max(a, 1e-4), 0, 1)
    rel = np.exp(-curva * t / max(r, 1e-4))
    return att * rel


def _bandpass(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))


def _norm(x, pico=0.8):
    m = np.max(np.abs(x)) or 1.0
    return x / m * pico


def _reverb(x, seg=0.9, mezcla=0.25):
    n = int(seg * SR)
    ir = rng.standard_normal(n) * np.exp(-6 * np.arange(n) / n)
    ir = _bandpass(ir, 200, 7000)
    ir /= np.sqrt(np.sum(ir ** 2))
    largo = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, largo) * np.fft.rfft(ir, largo), largo)
    seco = np.concatenate([x, np.zeros(n)])
    return seco * (1 - mezcla) + y * mezcla * 0.6


@lru_cache(None)
def sfx(nombre):
    """Devuelve el efecto como array mono float32."""
    if nombre == "whoosh":
        t = _t(0.45)
        ruido = rng.standard_normal(len(t))
        x = np.zeros_like(ruido)
        # barrido de banda: varios tramos con filtro distinto
        for i, (lo, hi) in enumerate([(300, 900), (500, 1600), (800, 2600), (1200, 4000)]):
            seg = _bandpass(ruido, lo, hi)
            w = np.exp(-((t - 0.1 - i * 0.07) / 0.09) ** 2)
            x += seg * w
        return _norm(x, 0.5).astype(np.float32)
    if nombre == "pop":
        t = _t(0.18)
        f = 900 * np.exp(-t * 18) + 250
        return _norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(len(t), 0.002, 0.06), 0.6).astype(np.float32)
    if nombre == "brillo":
        t = _t(1.1)
        x = np.zeros_like(t)
        for i, f in enumerate([2093, 2637, 3136, 4186, 3520]):
            d = int(i * 0.06 * SR)
            seg = np.sin(2 * np.pi * f * t[: len(t) - d]) * _env(len(t) - d, 0.002, 0.35)
            x[d:] += seg * (0.7 ** i)
        return _norm(_reverb(x, 0.8, 0.35), 0.35).astype(np.float32)
    if nombre == "ding":
        t = _t(1.3)
        x = sum(np.sin(2 * np.pi * f * t) * a for f, a in [(1318, 1), (2637, 0.35), (3951, 0.15)])
        return _norm(_reverb(x * _env(len(t), 0.002, 0.6), 0.8, 0.25), 0.45).astype(np.float32)
    if nombre == "apreton":
        t = _t(0.25)
        x = _bandpass(rng.standard_normal(len(t)), 300, 2500) * _env(len(t), 0.001, 0.05, 6)
        x += np.sin(2 * np.pi * 140 * t) * _env(len(t), 0.001, 0.08) * 0.6
        return _norm(x, 0.6).astype(np.float32)
    if nombre == "golpe_libro":
        t = _t(0.5)
        x = np.sin(2 * np.pi * (70 + 60 * np.exp(-t * 30)) * t) * _env(len(t), 0.001, 0.18)
        x += _bandpass(rng.standard_normal(len(t)), 150, 1200) * _env(len(t), 0.001, 0.05) * 0.5
        return _norm(_reverb(x, 0.5, 0.2), 0.8).astype(np.float32)
    if nombre == "pagina":
        t = _t(0.55)
        r = _bandpass(rng.standard_normal(len(t)), 1500, 9000)
        mod = 0.5 + 0.5 * np.sin(2 * np.pi * 23 * t) ** 2
        w = np.exp(-((t - 0.2) / 0.12) ** 2)
        return _norm(r * mod * w, 0.4).astype(np.float32)
    if nombre == "papeles":
        t = _t(0.9)
        r = _bandpass(rng.standard_normal(len(t)), 1200, 8000)
        gr = (rng.random(len(t)) < 0.002).astype(float)
        gr = np.convolve(gr, np.exp(-np.arange(400) / 60), "same")
        return _norm(r * (0.15 + gr) * _env(len(t), 0.05, 0.6, 2), 0.35).astype(np.float32)
    if nombre == "boing":
        t = _t(0.6)
        f = 180 + 70 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 4)
        return _norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(len(t), 0.005, 0.35), 0.5).astype(np.float32)
    if nombre == "freno":
        t = _t(0.4)
        f = 1400 * np.exp(-t * 5) + 300
        x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.3 + _bandpass(rng.standard_normal(len(t)), 2000, 6000) * 0.4
        return _norm(_bandpass(x, 200, 6000) * _env(len(t), 0.005, 0.25), 0.35).astype(np.float32)
    if nombre == "timbre_bici":
        t = _t(0.9)
        x = np.zeros_like(t)
        for d in (0.0, 0.16):
            k = int(d * SR)
            tt = t[: len(t) - k]
            x[k:] += (np.sin(2 * np.pi * 2350 * tt) + 0.6 * np.sin(2 * np.pi * 3350 * tt)) * _env(len(tt), 0.001, 0.25)
        return _norm(_reverb(x, 0.4, 0.2), 0.4).astype(np.float32)
    if nombre == "holograma":
        t = _t(1.0)
        car = 520 + 40 * np.sin(2 * np.pi * 6 * t)
        x = np.sin(2 * np.pi * np.cumsum(car) / SR + 2.5 * np.sin(2 * np.pi * 1040 * t))
        x *= np.clip(t / 0.15, 0, 1) * np.exp(-t * 2.2)
        return _norm(_reverb(x, 0.9, 0.4), 0.3).astype(np.float32)
    if nombre == "reflector":
        t = _t(0.35)
        x = _bandpass(rng.standard_normal(len(t)), 80, 900) * _env(len(t), 0.001, 0.05, 5)
        x += np.sin(2 * np.pi * 60 * t) * _env(len(t), 0.001, 0.12) * 0.8
        return _norm(_reverb(x, 0.7, 0.35), 0.6).astype(np.float32)
    if nombre == "sello":
        t = _t(0.45)
        x = np.sin(2 * np.pi * (90 + 120 * np.exp(-t * 40)) * t) * _env(len(t), 0.001, 0.1)
        x += _bandpass(rng.standard_normal(len(t)), 300, 3000) * _env(len(t), 0.001, 0.03) * 0.7
        return _norm(x, 0.75).astype(np.float32)
    if nombre == "marcador":
        t = _t(0.7)
        r = _bandpass(rng.standard_normal(len(t)), 2500, 7000)
        chirrido = np.sin(2 * np.pi * (1800 + 500 * t) * t) * 0.25
        w = np.clip(t / 0.05, 0, 1) * np.clip((0.7 - t) / 0.15, 0, 1)
        return _norm((r * 0.5 + chirrido) * w, 0.4).astype(np.float32)
    raise KeyError(f"efecto desconocido: {nombre}")


def musica(duracion, bpm=92):
    """Loop suave (pad + arpegio + pulso). Termina en la misma armonía que empieza para el loop."""
    beat = 60 / bpm
    compas = 4 * beat
    acordes = [  # I – vi – IV – V en Re mayor (frecuencias en Hz)
        [146.83, 220.00, 293.66, 369.99],
        [123.47, 246.94, 293.66, 369.99],
        [98.00, 196.00, 293.66, 392.00],
        [110.00, 220.00, 277.18, 329.63],
    ]
    n = int(duracion * SR)
    x = np.zeros(n + SR * 2)
    t_compas = _t(compas)
    for c in range(int(np.ceil(duracion / compas)) + 1):
        ac = acordes[c % 4]
        ini = int(c * compas * SR)
        pad = sum(np.sin(2 * np.pi * f * t_compas) + 0.3 * np.sin(2 * np.pi * 2 * f * t_compas) for f in ac)
        env = np.clip(t_compas / 0.4, 0, 1) * np.clip((compas - t_compas) / 0.5, 0, 1)
        seg = pad * env * 0.05
        # arpegio en corcheas
        for k in range(8):
            f = ac[(k * 3) % 4] * 2
            tt = _t(beat / 2 * 1.6)
            nota = (np.sin(2 * np.pi * f * tt) + 0.2 * np.sin(2 * np.pi * 3 * f * tt)) * _env(len(tt), 0.003, 0.25) * 0.06
            i0 = int(k * beat / 2 * SR)
            fin = min(len(seg), i0 + len(nota))
            seg[i0:fin] += nota[: fin - i0]
        # pulso suave en negras
        for k in range(4):
            tt = _t(0.25)
            bombo = np.sin(2 * np.pi * (55 + 50 * np.exp(-tt * 30)) * tt) * _env(len(tt), 0.002, 0.08) * 0.12
            i0 = int(k * beat * SR)
            seg[i0:i0 + len(bombo)] += bombo[: len(seg) - i0]
        fin = min(len(x), ini + len(seg))
        x[ini:fin] += seg[: fin - ini]
    x = _reverb(x, 1.6, 0.3)[:n]
    # crossfade cola→inicio para que el loop no salte
    cf = int(0.4 * SR)
    rampa = np.linspace(0, 1, cf)
    x[:cf] = x[:cf] * rampa + x[-cf:] * (1 - rampa)
    return _norm(x, 0.5).astype(np.float32)


def leer_wav(ruta):
    with wave.open(str(ruta), "rb") as w:
        sr, ch, ancho = w.getframerate(), w.getnchannels(), w.getsampwidth()
        datos = w.readframes(w.getnframes())
    dt = {2: np.int16, 4: np.int32}[ancho]
    x = np.frombuffer(datos, dt).astype(np.float32) / np.iinfo(dt).max
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    if sr != SR:
        idx = np.arange(0, len(x), sr / SR)
        x = np.interp(idx, np.arange(len(x)), x).astype(np.float32)
    return x


def escribir_wav(ruta, x):
    x = np.clip(x, -1, 1)
    est = np.stack([x, x], axis=1) if x.ndim == 1 else x
    with wave.open(str(ruta), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((est * 32767).astype(np.int16).tobytes())


def mezclar(tramos, total, ruta_salida, vol_musica=0.55, vol_musica_voz=0.16):
    n = int(total * SR) + 1
    voz = np.zeros(n, np.float32)
    efx = np.zeros(n, np.float32)
    activo = np.zeros(n, np.float32)

    def poner(buf, x, t, g=1.0):
        i = int(t * SR)
        if i >= n:
            return
        fin = min(n, i + len(x))
        buf[i:fin] += x[: fin - i] * g

    for tr in tramos:
        for e in tr.get("sfx", []):
            poner(efx, sfx(e["s"]), tr["t0"] + e["t"], e.get("g", 0.8))
        if tr.get("voz"):
            v = leer_wav(tr["voz"])
            poner(voz, v, tr["t0"] + 0.08)
            i = int((tr["t0"] + 0.08) * SR)
            activo[i:min(n, i + len(v))] = 1.0
        elif tr.get("texto"):  # sin audio todavía: igual se baja la música en la ventana prevista
            i = int(tr["t0"] * SR)
            activo[i:min(n, i + int(tr["voz_dur"] * SR))] = 1.0
    # ducking suave (ataque 80 ms, release 300 ms)
    k = int(0.3 * SR)
    suave = np.convolve(activo, np.ones(k) / k, "same")
    gan = vol_musica - (vol_musica - vol_musica_voz) * np.clip(suave * 1.6, 0, 1)
    mus = musica(total)[:n]
    mus = np.pad(mus, (0, n - len(mus)))
    mezcla = voz * 1.0 + efx * 0.7 + mus * gan
    # limitador simple
    pico = np.max(np.abs(mezcla))
    if pico > 0.95:
        mezcla *= 0.95 / pico
    escribir_wav(ruta_salida, mezcla)
