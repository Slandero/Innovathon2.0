"""Camiones: rutas en circuito, paradas cada ~400 m y sensores virtuales APC → POST /api/iot/ingest."""
from __future__ import annotations

import math
import random
from datetime import datetime, timezone

from .red import a_xy, de_xy
from .rutas import RUTAS

UNIDADES_POR_RUTA = 2
CAPACIDAD = 80
PARADA_CADA_M = 400
ESPERA_PARADA_S = 18


def poisson(lam: float) -> int:
    l, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= random.random()
        if p < l:
            return k
        k += 1


class RutaCamion:
    def __init__(self, red, datos: dict) -> None:
        self.id, self.nombre, self.color = datos["id"], datos["nombre"], datos["color"]
        nodos = [red.nodo_cercano(*a_xy(lng, lat)) for lng, lat in datos["puntos"]]
        circuito = nodos + nodos[-2::-1]  # ida y vuelta
        self.aristas: list[int] = []
        for o, d in zip(circuito[:-1], circuito[1:]):
            tramo = red.ruta(o, d) or []
            self.aristas.extend(tramo)
        # geometría y distancias acumuladas
        self.xy: list[tuple[float, float]] = []
        self.cum: list[float] = []
        self.arista_en: list[int] = []  # índice de arista por punto
        for idx in self.aristas:
            a = red.aristas[idx]
            for p in a.xy[(1 if self.xy else 0):]:
                if self.xy:
                    self.cum.append(self.cum[-1] + math.dist(self.xy[-1], p))
                else:
                    self.cum.append(0.0)
                self.xy.append(p)
                self.arista_en.append(idx)
        self.largo = self.cum[-1] if self.cum else 1.0
        self.paradas = self._paradas(red)

    def _paradas(self, red) -> list[dict]:
        paradas, siguiente = [], 150.0
        for i, s in enumerate(self.cum):
            if s < siguiente:
                continue
            siguiente = s + PARADA_CADA_M
            x, y = self.xy[i]
            nombre = ""
            for n, px, py in red.paradas_osm:
                if n and math.dist((x, y), (px, py)) < 80:
                    nombre = n
                    break
            if not nombre:
                a = red.aristas[self.arista_en[i]]
                cruce = next((red.aristas[j].nombre for j in red.salientes.get(a.v, [])
                              if red.aristas[j].nombre and red.aristas[j].nombre != a.nombre), "")
                calle = a.nombre or "Calle"
                nombre = f"{calle} y {cruce}" if cruce else f"{calle} #{len(paradas) + 1}"
            lng, lat = de_xy(x, y)
            paradas.append({"nombre": nombre, "lng": round(lng, 5), "lat": round(lat, 5), "km": round(s / 1000, 3), "s": s})
        return paradas

    def punto(self, s: float) -> tuple[float, float, float, int]:
        s %= self.largo
        lo, hi = 0, len(self.cum) - 1
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if self.cum[mid] <= s:
                lo = mid
            else:
                hi = mid
        a, b = self.xy[lo], self.xy[hi]
        seg = (self.cum[hi] - self.cum[lo]) or 1e-6
        t = (s - self.cum[lo]) / seg
        rumbo = (math.degrees(math.atan2(b[0] - a[0], b[1] - a[1])) + 360) % 360
        return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, rumbo, self.arista_en[lo]

    def registro(self) -> dict:
        coords = []
        for i, (x, y) in enumerate(self.xy):
            if i % 2 == 0 or i == len(self.xy) - 1:
                lng, lat = de_xy(x, y)
                coords.append([round(lng, 5), round(lat, 5)])
        return {"id": self.id, "nombre": self.nombre, "color": self.color,
                "trazo": {"type": "LineString", "coordinates": coords},
                "paradas": [{k: p[k] for k in ("nombre", "lng", "lat", "km")} for p in self.paradas]}


class Unidad:
    def __init__(self, ruta: RutaCamion, n: int, s0: float) -> None:
        self.ruta = ruta
        self.id = f"{ruta.id}-{n:02d}"
        self.s = s0
        self.ocupacion = random.randint(10, 45)
        self.suben = self.bajan = 0
        self.espera_hasta = 0.0
        self.parada_idx = self._proxima()
        self.falta = (ruta.paradas[self.parada_idx]["s"] - self.s % ruta.largo) % ruta.largo
        self.vel = 0.0

    def _proxima(self) -> int:
        s = self.s % self.ruta.largo
        for i, p in enumerate(self.ruta.paradas):
            if p["s"] > s + 5:
                return i
        return 0


class Transporte:
    def __init__(self, ciudad) -> None:
        self.c = ciudad
        self.rutas = [RutaCamion(ciudad.red, d) for d in RUTAS]
        self.rutas = [r for r in self.rutas if len(r.paradas) >= 2]
        self.unidades: list[Unidad] = []
        for r in self.rutas:
            for n in range(UNIDADES_POR_RUTA):
                self.unidades.append(Unidad(r, n + 1, r.largo * n / UNIDADES_POR_RUTA + random.random() * 200))
        self.ultimo_envio = 0.0
        print(f"[bus] {len(self.rutas)} rutas, {len(self.unidades)} unidades, "
              f"{sum(len(r.paradas) for r in self.rutas)} paradas")

    def publicar_rutas(self) -> None:
        pub = self.c.pub
        pub.upsert("rutas_camion", [r.registro() for r in self.rutas], "id", fondo=False)
        pub.upsert("camiones", [{"id": u.id, "ruta_id": u.ruta.id, "capacidad": CAPACIDAD, "ocupacion": u.ocupacion, "fuente": "sim"}
                                for u in self.unidades], "id", fondo=False)

    def avanzar(self, dt: float, ahora: float) -> None:
        red, cong = self.c.red, self.c.congestion
        demanda = self.c.demanda
        for u in self.unidades:
            if ahora < u.espera_hasta:
                u.vel = 0.0
                continue
            _, _, _, idx = u.ruta.punto(u.s)
            a = red.aristas[idx]
            u.vel = a.vlibre * 0.78 * cong.factor_vel(a.tramo) * self.c.incidentes.factor_arista(idx)
            paso = u.vel * dt
            if paso >= u.falta:
                u.s += u.falta
                bajan = min(u.ocupacion, sum(1 for _ in range(u.ocupacion) if random.random() < 0.12 + 0.08 * random.random()))
                suben = min(CAPACIDAD - (u.ocupacion - bajan), poisson(1.5 + 6 * demanda))
                u.ocupacion += suben - bajan
                u.suben += suben
                u.bajan += bajan
                u.espera_hasta = ahora + ESPERA_PARADA_S / max(1.0, self.c.velocidad)
                ant = u.ruta.paradas[u.parada_idx]["s"]
                u.parada_idx = (u.parada_idx + 1) % len(u.ruta.paradas)
                u.falta = (u.ruta.paradas[u.parada_idx]["s"] - ant) % u.ruta.largo or u.ruta.largo
            else:
                u.s += paso
                u.falta -= paso

        if ahora - self.ultimo_envio >= 3.0:
            self.ultimo_envio = ahora
            self.enviar()

    def eta_min(self, u: Unidad) -> int:
        return max(1, round(u.falta / max(u.vel, 4.0) / 60))

    def enviar(self) -> None:
        ts = datetime.now(timezone.utc).isoformat()
        for u in self.unidades:
            x, y, rumbo, _ = u.ruta.punto(u.s)
            lng, lat = de_xy(x, y)
            self.c.pub.iot({
                "device_id": f"apc-{u.id}", "camion_id": u.id, "ruta_id": u.ruta.id,
                "suben": u.suben, "bajan": u.bajan, "ocupacion": u.ocupacion, "capacidad": CAPACIDAD,
                "lat": round(lat, 5), "lng": round(lng, 5), "heading": round(rumbo),
                "proxima_parada": u.ruta.paradas[u.parada_idx]["nombre"], "eta_min": self.eta_min(u), "ts": ts,
            })
            u.suben = u.bajan = 0

