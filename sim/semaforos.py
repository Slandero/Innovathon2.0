"""Semáforos deterministas (18.4) + overrides (ola verde, rojo forzado por n8n)."""
import time

from .config import AMBAR, CICLO, VERDE


def estado_semaforo(osm_id: int, ahora: float | None = None, overrides: dict | None = None) -> str:
    ahora = time.time() if ahora is None else ahora
    if overrides:
        o = overrides.get(osm_id)
        if o and o[1] > ahora:
            return o[0]
    t = (int(ahora) + (osm_id % CICLO)) % CICLO
    return "verde" if t < VERDE else "ambar" if t < VERDE + AMBAR else "rojo"
