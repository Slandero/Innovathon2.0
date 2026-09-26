"""Autos simulados que avanzan por aristas reales, se detienen en rojo y 2 s en altos."""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field


@dataclass
class Vehiculo:
    id: int
    ruta: list[int]
    i: int = 0
    s: float = 0.0
    vel: float = 0.0
    alto_hasta: float = 0.0
    alto_hecho: int = -1
    x: float = 0.0
    y: float = 0.0
    rumbo: float = 0.0
    reruteo: bool = False
    extra: bool = False  # autos agregados por /demo para la congestión en un punto
    vida: float = field(default=0.0)


class Flota:
    def __init__(self, ciudad, n: int) -> None:
        self.c = ciudad
        self.lista: list[Vehiculo] = []
        self.siguiente_id = 1
        for _ in range(n):
            self.nuevo()

    def nuevo(self, origen: int | None = None, destino: int | None = None, extra: bool = False) -> Vehiculo | None:
        red = self.c.red
        for _ in range(6):
            o = origen if origen is not None else red.nodo_aleatorio()
            d = destino if destino is not None else red.nodo_aleatorio()
            if o == d:
                continue
            ruta = red.ruta(o, d)
            if ruta and len(ruta) >= 3:
                v = Vehiculo(id=self.siguiente_id, ruta=ruta, extra=extra)
                # arranca en un punto aleatorio del primer tramo para no amontonarse
                v.s = random.random() * red.aristas[ruta[0]].largo
                self.siguiente_id += 1
                self._pos(v)
                self.lista.append(v)
                return v
        return None

    def _pos(self, v: Vehiculo) -> None:
        a = self.c.red.aristas[v.ruta[v.i]]
        v.x, v.y, v.rumbo = a.punto(v.s)

    def rerutear(self, v: Vehiculo) -> None:
        a = self.c.red.aristas[v.ruta[v.i]]
        destino = self.c.red.aristas[v.ruta[-1]].v
        nueva = self.c.red.ruta(a.v, destino)
        if nueva:
            v.ruta = v.ruta[: v.i + 1] + nueva
        v.reruteo = False

    def avanzar(self, dt: float, ahora: float) -> None:
        red, c = self.c.red, self.c
        terminados = []
        for v in self.lista:
            if v.reruteo:
                self.rerutear(v)
            presupuesto = dt
            while presupuesto > 1e-3:
                a = red.aristas[v.ruta[v.i]]
                objetivo = c.vel_objetivo(a, v)
                v.vel += max(-6.0, min(2.5, (objetivo - v.vel))) * min(1.0, presupuesto)
                v.vel = max(0.0, v.vel)
                restante = a.largo - v.s
                paso = v.vel * presupuesto
                nodo = a.v
                # ¿debe parar al final de la arista?
                parar = False
                if nodo in red.semaforo_nodo and not c.es_verde(red.semaforo_nodo[nodo], ahora):
                    parar = True
                elif nodo in red.alto_nodo and v.alto_hecho != nodo:
                    parar = True
                if parar and paso >= restante - 2.0:
                    v.s = max(v.s, a.largo - 2.0)
                    v.vel = 0.0
                    if nodo in red.alto_nodo and nodo not in red.semaforo_nodo:
                        if not v.alto_hasta:
                            v.alto_hasta = ahora + 2.0 / max(1.0, c.velocidad)
                        elif ahora >= v.alto_hasta:
                            v.alto_hecho, v.alto_hasta = nodo, 0.0
                    break
                if paso < restante:
                    v.s += paso
                    break
                # pasa a la siguiente arista
                presupuesto -= restante / max(v.vel, 0.1)
                v.i += 1
                v.s = 0.0
                if v.i >= len(v.ruta):
                    terminados.append(v)
                    break
            if v.i < len(v.ruta):
                self._pos(v)
        for v in terminados:
            # nuevo destino desde donde quedó (los autos extra de /demo desaparecen)
            self.lista.remove(v)
            if not v.extra:
                ultimo = red.aristas[v.ruta[-1]].v
                self.nuevo(origen=ultimo)

    def ajustar(self, n: int) -> None:
        normales = [v for v in self.lista if not v.extra]
        while len(normales) < n:
            nv = self.nuevo()
            if not nv:
                break
            normales.append(nv)
        if len(normales) > n:
            for v in normales[n:]:
                self.lista.remove(v)

    def tick_payload(self) -> list[list]:
        from .red import de_xy
        out = []
        for v in self.lista:
            lng, lat = de_xy(v.x, v.y)
            out.append([v.id, round(lat, 5), round(lng, 5), round(v.vel * 3.6, 1), round(v.rumbo)])
        return out

    def vel_por_tramo(self) -> dict[int, list[float]]:
        out: dict[int, list[float]] = {}
        for v in self.lista:
            t = self.c.red.aristas[v.ruta[min(v.i, len(v.ruta) - 1)]].tramo
            if t >= 0:
                out.setdefault(t, []).append(v.vel)
        return out


def dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])
