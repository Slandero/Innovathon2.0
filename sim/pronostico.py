"""Pronóstico a 30 min por corredor: tendencia lineal de 10 min + curva horaria (modelo de tendencia)."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from .config import curva_demanda

NIVELES = ["fluido", "moderado", "pesado", "detenido"]


def nivel_de(c: float) -> int:
    return 0 if c < 0.35 else 1 if c < 0.55 else 2 if c < 0.75 else 3


class Pronostico:
    def __init__(self, ciudad) -> None:
        self.c = ciudad
        self.hist: dict[str, deque] = defaultdict(lambda: deque(maxlen=20))  # 20 × 30 s = 10 min
        self.por_corredor: dict[str, list[int]] = defaultdict(list)
        for t, nombre in enumerate(ciudad.red.tramo_nombre):
            if nombre:
                self.por_corredor[nombre].append(t)
        self.ultimo = 0.0

    def muestrear(self) -> None:
        ahora = time.time()
        if ahora - self.ultimo < 30:
            return
        self.ultimo = ahora
        cong = self.c.congestion
        for nombre, tramos in self.por_corredor.items():
            self.hist[nombre].append((ahora, sum(cong.c[t] for t in tramos) / len(tramos)))

    def corredores(self, top: int = 25) -> list[dict]:
        cong, hora = self.c.congestion, self.c.hora()
        out = []
        for nombre, tramos in self.por_corredor.items():
            if len(tramos) < 3:
                continue
            c_act = sum(cong.c[t] for t in tramos) / len(tramos)
            c_max = max(cong.c[t] for t in tramos)
            h = list(self.hist[nombre])
            pend = 0.0
            if len(h) >= 3:
                t0 = h[0][0]
                xs, ys = [x - t0 for x, _ in h], [y for _, y in h]
                mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
                den = sum((x - mx) ** 2 for x in xs) or 1
                pend = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den  # por segundo
            demanda_delta = curva_demanda((hora + 0.5) % 24) - curva_demanda(hora)
            c30 = max(0.0, min(1.0, c_act + pend * 1800 * 0.5 + demanda_delta * 0.7))
            vel_kmh = round(55 * max(0.1, 1 - 0.85 * c_act))
            tendencia = "empeora" if c30 - c_act > 0.06 else "mejora" if c_act - c30 > 0.06 else "igual"
            out.append({
                "nombre": nombre, "nivel": NIVELES[nivel_de(max(c_act, c_max * 0.8))], "c": round(c_act, 2),
                "vel_kmh": vel_kmh, "pronostico_30min": tendencia, "nivel_30min": NIVELES[nivel_de(c30)],
                "incidentes": sum(1 for t in tramos if cong.c_inc[t] > 0.5) > 0,
            })
        out.sort(key=lambda d: -d["c"])
        return out[:top]
