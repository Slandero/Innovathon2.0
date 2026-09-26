"""Parámetros del motor de ciudad (sección 11 de docs/VIVECUU_MASTER.md)."""
import math
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PUBLIC_DATA = ROOT / "public" / "data"

GRAPHML = DATA / "cuu_drive.graphml"
OSM_INFRA = DATA / "osm_infra.json"
ZONAS = PUBLIC_DATA / "zonas_escolares.geojson"
TRAMOS_JSON = DATA / "tramos.json"          # membresía arista → tramo (lo usa el motor)
TRAMOS_GEOJSON = PUBLIC_DATA / "tramos.geojson"  # geometría para la app

CENTRO = (-106.089, 28.635)  # lng, lat
RADIO_VIAJES_M = 7000         # origen/destino dentro de este radio del centro

TICK_S = 1.0          # reloj real entre ticks
N_VEHICULOS = 150
TRAFICO_CADA_S = 3
CELDAS_CADA_S = 5
ESTADO_CADA_S = 10
POLL_CADA_S = 2
CAMION_CADA_S = 3

CELDA_M = 50
ANOMALIA_VEL_KMH = 5
ANOMALIA_SEG = 20

CLASES_PRINCIPALES = {"trunk", "primary", "secondary"}
PESO_CLASE = {"trunk": 5, "primary": 4, "secondary": 3, "tertiary": 1.5}
CONGESTION_CLASE = {"trunk": 0.85, "primary": 0.8, "secondary": 0.65}

# Semáforos: MISMA función que src/lib/map/semaforos.ts
CICLO, VERDE, AMBAR = 90, 45, 4

# Metros por grado alrededor de Chihuahua
KY = 110_540.0
KX = 111_320.0 * math.cos(math.radians(28.65))


def curva_demanda(hora: float) -> float:
    """Demanda relativa 0–1 por hora del día (picos 7–9, 13–15, 18–20)."""
    picos = [(8.0, 1.0, 1.1), (14.0, 0.8, 1.0), (19.0, 1.0, 1.2)]
    base = 0.18 + 0.32 * max(0.0, math.sin(math.pi * (hora - 6) / 17)) if 6 <= hora <= 23 else 0.1
    for centro, alto, ancho in picos:
        base = max(base, alto * math.exp(-((hora - centro) ** 2) / (2 * ancho ** 2)))
    return min(1.0, base)


def cargar_env() -> dict:
    env = dict(os.environ)
    for nombre in (".env.local", ".env"):
        p = ROOT / nombre
        if p.exists():
            for linea in p.read_text(encoding="utf-8").splitlines():
                if "=" in linea and not linea.strip().startswith("#"):
                    k, v = linea.split("=", 1)
                    env.setdefault(k.strip(), v.strip())
    return env
