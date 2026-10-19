"""Utilidades compartidas del pipeline de reels de Cláusula Legal."""
import json
import re
import unicodedata
import wave
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]          # reels/
ELENCO = RAIZ / "elenco"
EPISODIOS = RAIZ / "episodios"
FUENTES = RAIZ / "assets" / "fuentes"

ANCHO, ALTO, FPS = 1080, 1920, 30
SR = 48000

# Identidad visual
AZUL_NOCHE = (23, 38, 59)
MARFIL = (244, 240, 231)
DORADO = (201, 160, 74)
AMARILLO = (242, 210, 27)
ROJO_CODIGO = (178, 28, 32)

PERSONAJES = {
    "clausulo": {"nombre": "CLAUSULO", "color": DORADO},
    "codiguito": {"nombre": "CODIGUITO", "color": (200, 48, 46)},
    "inciso": {"nombre": "INCISO", "color": (96, 140, 52)},
    "resaltato": {"nombre": "RESALTATO", "color": AMARILLO},
    "voz_ley": {"nombre": "LA VOZ DE LA LEY", "color": AZUL_NOCHE},
}

# Velocidad estimada de habla (caracteres por segundo) cuando todavía no hay audio.
CPS = {"dialogo": 14.0, "final": 12.0, "ley": 13.0}
PAUSA_FIN = 0.28
INICIO_VOZ = 0.08


def dir_episodio(slug):
    return EPISODIOS / slug


def cargar_guion(slug):
    return json.loads((dir_episodio(slug) / "guion.json").read_text(encoding="utf-8"))


def normalizar(texto):
    """Normaliza para comparar texto dicho vs guion: minúsculas, sin signos ni tildes."""
    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9ñ ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def duracion_wav(ruta):
    with wave.open(str(ruta), "rb") as w:
        return w.getnframes() / w.getframerate()


def lineas_de_voz(guion):
    """Todas las líneas a grabar: (id, personaje, tts)."""
    out = []
    for s in guion["segmentos"]:
        if s["tipo"] in ("dialogo", "final"):
            out.append((s["id"], s["personaje"], s["tts"]))
        elif s["tipo"] == "ley":
            for i, f in enumerate(s["frases"], 1):
                out.append((f"{s['id']}_f{i}", "voz_ley", f["tts"]))
    return out


def verificar_literalidad(guion):
    """Regla de oro 1: las frases de la Voz de la ley, unidas, son el artículo palabra por palabra."""
    arts = {a["numero"]: a for a in guion["articulos"]}
    errores = []
    for s in guion["segmentos"]:
        if s["tipo"] != "ley":
            continue
        a = arts[s["articulo"]]
        esperado = f"ARTÍCULO {a['numero']}.- {a['epigrafe']}. {a['texto']}"
        leido = " ".join(f["texto"] for f in s["frases"])
        if re.sub(r"\s+", " ", leido).strip() != esperado:
            errores.append(f"Art. {a['numero']}: subtítulos ≠ texto literal\n  leído:    {leido}\n  esperado: {esperado}")
        # Lo que se locuta debe ser el mismo texto (solo cambia el número escrito en letras).
        dicho = normalizar(" ".join(f["tts"] for f in s["frases"]))
        cuerpo = normalizar(f"{a['epigrafe']}. {a['texto']}")
        if not dicho.endswith(cuerpo):
            errores.append(f"Art. {a['numero']}: la locución no coincide con el texto literal\n  tts: {dicho}\n  ley: {cuerpo}")
    return errores


def _voz(dir_voces, vid, tipo, tts):
    ruta = dir_voces / f"{vid}.wav"
    palabras = None
    pj = dir_voces / f"{vid}.palabras.json"
    if pj.exists():
        palabras = json.loads(pj.read_text(encoding="utf-8"))
    if ruta.exists():
        return ruta, duracion_wav(ruta), palabras, False
    return None, max(0.9, len(tts) / CPS[tipo]), None, True


def linea_de_tiempo(guion, dir_voces):
    """Calcula tiempos absolutos de cada tramo (con voz real si existe, si no estimada)."""
    t = 0.0
    tramos = []
    for s in guion["segmentos"]:
        tipo = s["tipo"]
        if tipo in ("dialogo", "final"):
            ruta, dv, pal, est = _voz(dir_voces, s["id"], tipo, s["tts"])
            dur = max(1.5, INICIO_VOZ + dv + PAUSA_FIN + s.get("cola", 0.0))
            tramos.append(dict(id=s["id"], tipo=tipo, t0=t, dur=dur, personaje=s["personaje"],
                               texto=s["texto"], resaltar=s.get("resaltar", []), planos=s["planos"],
                               sfx=s.get("sfx", []), voz=ruta, voz_dur=dv, palabras=pal, estimada=est))
            t += dur
        elif tipo == "ley":
            n = len(s["frases"])
            for i, f in enumerate(s["frases"], 1):
                vid = f"{s['id']}_f{i}"
                ruta, dv, pal, est = _voz(dir_voces, vid, "ley", f["tts"])
                if s.get("continuo") and ruta:
                    # lectura de corrido cortada en frases: se pegan sin huecos, como se grabó
                    off = INICIO_VOZ if i == 1 else 0.0
                    dur = off + dv + (0.3 if i == n else 0.0)
                else:
                    off = INICIO_VOZ
                    dur = max(1.3, INICIO_VOZ + dv + 0.18)
                tramos.append(dict(id=vid, tipo="ley", t0=t, dur=dur, personaje="voz_ley", voz_off=off,
                                   articulo=s["articulo"], texto=f["texto"], resaltar=f.get("resaltar", []),
                                   planos=f["planos"], sfx=f.get("sfx", []), voz=ruta, voz_dur=dv,
                                   palabras=pal, estimada=est))
                t += dur
        else:
            tramos.append(dict(id=s["id"], tipo=tipo, t0=t, dur=s["dur"], articulo=s.get("articulo"),
                               planos=s.get("planos", []), sfx=s.get("sfx", []), voz=None, texto=""))
            t += s["dur"]
    # Planos con tiempos absolutos
    for tr in tramos:
        acc = tr["t0"]
        for p in tr["planos"]:
            p["_t0"] = acc
            p["_dur"] = tr["dur"] * p.get("parte", 1.0)
            acc += p["_dur"]
    return tramos, t
