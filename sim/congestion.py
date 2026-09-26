"""Nivel de tráfico por tramo: modelo por hora + ruido suave + autos simulados + incidentes."""
from __future__ import annotations

import math
import random

from . import config as C

CORREDORES_PESADOS = ("juventud", "tecnol", "universidad", "teófilo borunda", "tecnológico", "vallarta", "división del norte", "pacheco")


class Congestion:
    def __init__(self, n_tramos: int, nombres: list[str], clases: list[str]) -> None:
        self.n = n_tramos
        rnd = random.Random(42)
        self.fase = [rnd.random() * 2 * math.pi for _ in range(n_tramos)]
        self.freq = [0.6 + rnd.random() * 1.4 for _ in range(n_tramos)]
        self.peso = []
        for nom, cl in zip(nombres, clases):
            w = C.CONGESTION_CLASE.get(cl, 0.5)
            if any(k in nom.lower() for k in CORREDORES_PESADOS):
                w *= 1.18
            self.peso.append(w)
        self.c = [0.0] * n_tramos          # congestión 0–1 combinada
        self.c_inc = [0.0] * n_tramos      # por incidentes (la pone incidentes.py)
        self.c_veh = [0.0] * n_tramos      # por autos detenidos/lentos
        self.c_base = [0.0] * n_tramos     # modelo por hora
        self.nivel = [0] * n_tramos

    def actualizar(self, demanda: float, t: float, vel_por_tramo: dict[int, list[float]]) -> None:
        for i in range(self.n):
            ruido = 0.5 + 0.5 * math.sin(t / 900 * self.freq[i] + self.fase[i]) * math.cos(t / 2300 + self.fase[i] * 0.7)
            base = self.peso[i] * (0.25 + 0.75 * demanda) * (0.3 + 0.8 * ruido ** 1.5)
            vs = vel_por_tramo.get(i)
            veh = 0.0
            if vs and len(vs) >= 2:
                veh = max(0.0, 1 - (sum(vs) / len(vs)) / 12.0)  # 12 m/s ≈ 43 km/h = fluido
                veh *= min(1.0, len(vs) / 4)
            self.c_veh[i] = veh
            self.c_base[i] = base
            c = max(base, veh * 0.9, self.c_inc[i])
            self.c[i] = c
            self.nivel[i] = 0 if c < 0.35 else 1 if c < 0.55 else 2 if c < 0.75 else 3

    def factor_vel(self, tramo: int) -> float:
        if tramo < 0:
            return 1.0
        # los autos en rojo no frenan al resto: solo cuentan el modelo por hora y los incidentes
        return max(0.1, 1 - 0.85 * max(self.c_base[tramo], self.c_inc[tramo]))
