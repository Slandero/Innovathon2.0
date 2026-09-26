"""Incidentes activos (tabla incidentes): bloqueo de carril, cierre, cola aguas arriba, reruteo y retraso."""
from __future__ import annotations

import math
from collections import defaultdict

from .red import a_xy


class GestorIncidentes:
    def __init__(self, ciudad) -> None:
        self.c = ciudad
        self.activos: dict[int, dict] = {}  # id → {arista, fraccion, cola: [idx], retraso}
        red = ciudad.red
        self.entrantes: dict[int, list[int]] = defaultdict(list)
        for a in red.aristas:
            self.entrantes[a.v].append(a.idx)

    def sincronizar(self, filas: list[dict]) -> None:
        ids = {f["id"] for f in filas}
        for iid in list(self.activos):
            if iid not in ids:
                self._quitar(iid)
        for f in filas:
            if f["id"] not in self.activos:
                self._agregar(f)

    def _agregar(self, f: dict) -> None:
        red, pub = self.c.red, self.c.pub
        x, y = a_xy(f["lng"], f["lat"])
        r = red.arista_cercana(x, y, 120)
        if not r:
            self.activos[f["id"]] = {"arista": -1, "cola": [], "fraccion": 0}
            return
        idx, _ = r
        a = red.aristas[idx]
        # preferir la arista principal más cercana si la hay
        if not a.principal:
            r2 = min(((i, math.dist((x, y), red.aristas[i].xy[len(red.aristas[i].xy) // 2])) for i in red.rejilla_aristas.cerca(x, y, 1)
                      if red.aristas[i].principal), key=lambda t: t[1], default=None)
            if r2 and r2[1] < 150:
                idx, a = r2[0], red.aristas[r2[0]]
        total = max(1, int(f.get("carriles_totales") or a.carriles or 3))
        bloqueados = len(f.get("carril_bloqueado") or [])
        tipo = f.get("tipo", "accidente")
        if tipo == "cierre":
            frac = 1.0
        elif tipo == "congestion":
            frac = 0.85
        else:
            frac = min(1.0, bloqueados / total) if bloqueados else 0.34
        sev = int(f.get("severidad") or 3)

        # peso de ruteo: cerrado = prohibitivo; parcial = más lento
        for i in (idx, a.rev) if frac >= 1 and a.rev >= 0 and tipo == "cierre" else (idx,):
            red.set_peso(i, 1000.0 if frac >= 1 else 1 + 4 * frac)

        # cola aguas arriba (BFS hacia atrás)
        largo_cola = 250 + 900 * frac + 60 * sev
        cola, frontera, acumulado = [idx], [(a.u, 0.0)], {idx: 0.0}
        while frontera:
            nodo, dist = frontera.pop(0)
            for j in self.entrantes[nodo]:
                b = red.aristas[j]
                if j in acumulado or b.idx == a.rev or dist + b.largo > largo_cola:
                    continue
                if not (b.principal or b.clase == "tertiary"):
                    continue
                acumulado[j] = dist + b.largo
                cola.append(j)
                frontera.append((b.u, dist + b.largo))
        for j in cola:
            t = red.aristas[j].tramo
            if t >= 0:
                cerca = 1 - acumulado[j] / largo_cola
                self.c.congestion.c_inc[t] = max(self.c.congestion.c_inc[t], 0.55 + 0.45 * cerca * max(frac, 0.6))
        # autos que pasarían por aquí se rerutean
        if frac >= 0.6:
            for v in self.c.flota.lista:
                if idx in v.ruta[v.i + 1:]:
                    v.reruteo = True
        vlibre = a.vlibre
        retraso = max(2, round(largo_cola * (1 / (vlibre * max(0.12, 1 - frac * 0.85)) - 1 / vlibre) / 60 * 1.6 + sev * 0.8))
        self.activos[f["id"]] = {"arista": idx, "cola": cola, "fraccion": frac, "retraso": retraso}
        pub.patch("incidentes", f"id=eq.{f['id']}", {"retraso_min": retraso, "edge_ref": f"{a.u}-{a.v}-{a.k}"})
        print(f"[inc] #{f['id']} {tipo} en {a.nombre or 'calle sin nombre'} · {frac:.0%} bloqueado · cola {largo_cola:.0f} m · +{retraso} min")

    def _quitar(self, iid: int) -> None:
        info = self.activos.pop(iid)
        red = self.c.red
        idx = info["arista"]
        if idx < 0:
            return
        a = red.aristas[idx]
        for i in (idx, a.rev):
            if i >= 0:
                red.set_peso(i, 1.0)
        for j in info["cola"]:
            t = red.aristas[j].tramo
            if t >= 0:
                self.c.congestion.c_inc[t] = 0.0
        # re-aplicar colas de otros incidentes que compartan tramos
        for otro in self.activos.values():
            for j in otro["cola"]:
                t = red.aristas[j].tramo
                if t >= 0:
                    self.c.congestion.c_inc[t] = max(self.c.congestion.c_inc[t], 0.7)
        print(f"[inc] #{iid} resuelto")

    def factor_arista(self, idx: int) -> float:
        for info in self.activos.values():
            if info["arista"] == idx:
                return max(0.0, 1 - info["fraccion"]) * 0.5
        return 1.0

    def cerca(self, x: float, y: float, radio: float = 200) -> bool:
        red = self.c.red
        for info in self.activos.values():
            if info["arista"] >= 0:
                a = red.aristas[info["arista"]]
                if math.dist(a.xy[len(a.xy) // 2], (x, y)) < radio:
                    return True
        return False
