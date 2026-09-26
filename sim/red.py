"""Red vial: carga el graphml de OSMnx, marca semáforos/altos/topes/zonas escolares y arma tramos."""
from __future__ import annotations

import json
import math
import random
import time
from collections import defaultdict

import networkx as nx
import osmnx as ox

from . import config as C


def a_xy(lng: float, lat: float) -> tuple[float, float]:
    return (lng - C.CENTRO[0]) * C.KX, (lat - C.CENTRO[1]) * C.KY


def de_xy(x: float, y: float) -> tuple[float, float]:
    return C.CENTRO[0] + x / C.KX, C.CENTRO[1] + y / C.KY


def rumbo(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Rumbo en grados (0 = norte) de a → b en coords xy."""
    return (math.degrees(math.atan2(b[0] - a[0], b[1] - a[1])) + 360) % 360


class Arista:
    __slots__ = ("idx", "u", "v", "k", "xy", "cum", "largo", "vlibre", "clase", "nombre", "carriles",
                 "principal", "tramo", "escuela", "topes", "rev")

    def punto(self, s: float) -> tuple[float, float, float]:
        """(x, y, rumbo) a s metros del inicio."""
        s = max(0.0, min(self.largo, s))
        cum = self.cum
        i = 1
        while i < len(cum) - 1 and cum[i] < s:
            i += 1
        a, b = self.xy[i - 1], self.xy[i]
        seg = cum[i] - cum[i - 1] or 1e-6
        t = (s - cum[i - 1]) / seg
        return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, rumbo(a, b)


class Rejilla:
    """Índice espacial simple (celdas de `tam` m) para búsquedas por cercanía."""

    def __init__(self, tam: float = 150):
        self.tam = tam
        self.celdas: dict[tuple[int, int], list] = defaultdict(list)

    def clave(self, x: float, y: float) -> tuple[int, int]:
        return int(math.floor(x / self.tam)), int(math.floor(y / self.tam))

    def meter(self, x: float, y: float, item) -> None:
        self.celdas[self.clave(x, y)].append(item)

    def cerca(self, x: float, y: float, r: int = 1):
        cx, cy = self.clave(x, y)
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                yield from self.celdas.get((cx + dx, cy + dy), ())


def dist_seg(px, py, ax, ay, bx, by) -> tuple[float, float]:
    """Distancia de p al segmento ab y fracción t de la proyección."""
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
    qx, qy = ax + t * dx, ay + t * dy
    return math.hypot(px - qx, py - qy), t


def primero(v, defecto=None):
    if isinstance(v, list):
        return v[0] if v else defecto
    return defecto if v is None or (isinstance(v, float) and math.isnan(v)) else v


class Red:
    def __init__(self) -> None:
        t0 = time.time()
        G = ox.load_graphml(C.GRAPHML)
        G = ox.truncate.largest_component(G, strongly=True)
        self.G = G
        self.nodos: dict[int, tuple[float, float]] = {n: a_xy(d["x"], d["y"]) for n, d in G.nodes(data=True)}
        self.aristas: list[Arista] = []
        self.por_uvk: dict[tuple[int, int, int], int] = {}
        self.salientes: dict[int, list[int]] = defaultdict(list)
        self.rejilla_aristas = Rejilla(120)

        for u, v, k, d in G.edges(keys=True, data=True):
            a = Arista()
            a.idx, a.u, a.v, a.k = len(self.aristas), u, v, k
            geom = d.get("geometry")
            if geom is not None:
                a.xy = [a_xy(x, y) for x, y in geom.coords]
            else:
                a.xy = [self.nodos[u], self.nodos[v]]
            cum = [0.0]
            for i in range(1, len(a.xy)):
                cum.append(cum[-1] + math.dist(a.xy[i - 1], a.xy[i]))
            a.cum, a.largo = cum, max(cum[-1], 0.5)
            a.vlibre = float(primero(d.get("speed_kph"), 30.0)) / 3.6
            a.clase = str(primero(d.get("highway"), "residential")).replace("_link", "")
            a.nombre = str(primero(d.get("name"), "") or "")
            try:
                a.carriles = max(1, min(4, int(float(str(primero(d.get("lanes"), 0)).split(";")[0]))))
            except ValueError:
                a.carriles = 0
            if not a.carriles:
                a.carriles = 3 if a.clase in ("trunk", "primary") else 2 if a.clase == "secondary" else 1
            a.principal = a.clase in C.CLASES_PRINCIPALES
            a.tramo, a.escuela, a.topes, a.rev = -1, -1, [], -1
            d["peso"] = a.largo / a.vlibre
            d["idx"] = a.idx
            self.por_uvk[(u, v, k)] = a.idx
            self.salientes[u].append(a.idx)
            self.aristas.append(a)
            for i in range(len(a.xy) - 1):
                mx, my = (a.xy[i][0] + a.xy[i + 1][0]) / 2, (a.xy[i][1] + a.xy[i + 1][1]) / 2
                self.rejilla_aristas.meter(mx, my, a.idx)

        for a in self.aristas:
            for k in (0, 1, 2):
                r = self.por_uvk.get((a.v, a.u, k))
                if r is not None:
                    a.rev = r
                    break

        self._marcar_infra()
        self._marcar_zonas()
        self._tramos()
        self.nodos_viaje = self._nodos_viaje()
        print(f"[red] {len(self.nodos)} nodos, {len(self.aristas)} aristas, {len(self.semaforo_nodo)} nodos con semáforo, "
              f"{len(self.alto_nodo)} con alto, {self.n_tramos} tramos ({time.time() - t0:.1f} s)")

    # ─────────────────────────── infraestructura
    def arista_cercana(self, x: float, y: float, max_m: float = 60) -> tuple[int, float] | None:
        """(idx de arista, s en metros) más cercana a un punto."""
        mejor, md = None, max_m
        for idx in set(self.rejilla_aristas.cerca(x, y, 1)):
            a = self.aristas[idx]
            for i in range(len(a.xy) - 1):
                d, t = dist_seg(x, y, *a.xy[i], *a.xy[i + 1])
                if d < md:
                    md, mejor = d, (idx, a.cum[i] + t * (a.cum[i + 1] - a.cum[i]))
        return mejor

    def _marcar_infra(self) -> None:
        raw = json.loads(C.OSM_INFRA.read_text(encoding="utf-8"))
        rej_nodos = Rejilla(60)
        for n, (x, y) in self.nodos.items():
            rej_nodos.meter(x, y, n)
        self.semaforo_nodo: dict[int, int] = {}  # nodo del grafo → osm_id del semáforo
        self.alto_nodo: dict[int, int] = {}
        self.semaforos_xy: list[tuple[int, float, float]] = []
        self.hospitales: list[dict] = []
        self.paradas_osm: list[tuple[str, float, float]] = []

        def nodo_cercano(x, y, max_m):
            mejor, md = None, max_m
            for n in rej_nodos.cerca(x, y, 1):
                d = math.dist((x, y), self.nodos[n])
                if d < md:
                    md, mejor = d, n
            return mejor

        for el in raw.get("elements", []):
            tags = el.get("tags") or {}
            lat = el.get("lat") or (el.get("center") or {}).get("lat")
            lng = el.get("lon") or (el.get("center") or {}).get("lon")
            if lat is None:
                continue
            x, y = a_xy(lng, lat)
            osm_id = el["id"] if el["type"] == "node" else 10_000_000_000 + el["id"]
            hw = tags.get("highway")
            if hw == "traffic_signals":
                self.semaforos_xy.append((osm_id, x, y))
                n = nodo_cercano(x, y, 30)
                if n is not None and n not in self.semaforo_nodo:
                    self.semaforo_nodo[n] = osm_id
            elif hw == "stop":
                n = nodo_cercano(x, y, 25)
                if n is not None:
                    self.alto_nodo[n] = osm_id
            elif "traffic_calming" in tags and el["type"] == "node":
                r = self.arista_cercana(x, y, 15)
                if r:
                    self.aristas[r[0]].topes.append(r[1])
            elif tags.get("amenity") == "hospital":
                self.hospitales.append({"osm_id": osm_id, "nombre": tags.get("name") or "Hospital", "x": x, "y": y, "lng": lng, "lat": lat})
            elif hw == "bus_stop":
                self.paradas_osm.append((tags.get("name") or "", x, y))

    def _marcar_zonas(self) -> None:
        self.zonas: list[dict] = []
        if not C.ZONAS.exists():
            return
        fc = json.loads(C.ZONAS.read_text(encoding="utf-8"))
        for i, f in enumerate(fc["features"]):
            pts = f["geometry"]["coordinates"][0]
            lng = sum(p[0] for p in pts[:-1]) / (len(pts) - 1)
            lat = sum(p[1] for p in pts[:-1]) / (len(pts) - 1)
            x, y = a_xy(lng, lat)
            self.zonas.append({"horarios": f["properties"].get("horarios", "07:00-08:30,12:30-14:30"), "x": x, "y": y})
            for idx in set(self.rejilla_aristas.cerca(x, y, 2)):
                a = self.aristas[idx]
                mx, my = a.xy[len(a.xy) // 2]
                if math.dist((mx, my), (x, y)) < 150:
                    a.escuela = i

    # ─────────────────────────── tramos (geometría fija para la app)
    def _tramos(self) -> None:
        if C.TRAMOS_JSON.exists():
            datos = json.loads(C.TRAMOS_JSON.read_text(encoding="utf-8"))
            for clave, t in datos["aristas"].items():
                u, v, k = map(int, clave.split("-"))
                idx = self.por_uvk.get((u, v, k))
                if idx is not None:
                    self.aristas[idx].tramo = t
            self.n_tramos = datos["n"]
            self.tramo_nombre = datos.get("nombres", [""] * self.n_tramos)
            self.tramo_clase = datos.get("clases", ["primary"] * self.n_tramos)
            return
        self.exportar_tramos()

    def exportar_tramos(self, max_m: float = 600) -> None:
        """Agrupa aristas principales en tramos de ~600 m de la misma calle (ambos sentidos juntos)."""
        principales = [a for a in self.aristas if a.principal]
        por_nodo: dict[int, list[Arista]] = defaultdict(list)
        for a in principales:
            por_nodo[a.u].append(a)
        asignado: set[int] = set()
        tramos: list[list[Arista]] = []
        # arrancar por aristas cuya calle "empieza" en su nodo u
        orden = sorted(principales, key=lambda a: (a.nombre, a.u))
        for a0 in orden:
            if a0.idx in asignado:
                continue
            cadena, largo, a = [], 0.0, a0
            while a is not None and a.idx not in asignado and largo < max_m:
                cadena.append(a)
                asignado.add(a.idx)
                if a.rev >= 0:
                    asignado.add(a.rev)
                largo += a.largo
                sig = [b for b in por_nodo[a.v] if b.idx not in asignado and b.nombre == a.nombre and b.clase == a.clase and b.v != a.u]
                a = sig[0] if sig else None
            tramos.append(cadena)

        miembros: dict[str, int] = {}
        feats, nombres, clases = [], [], []
        for t, cadena in enumerate(tramos):
            coords: list[list[float]] = []
            for a in cadena:
                for idx in (a.idx, a.rev):
                    if idx >= 0:
                        b = self.aristas[idx]
                        b.tramo = t
                        miembros[f"{b.u}-{b.v}-{b.k}"] = t
                pts = [de_xy(x, y) for x, y in a.xy]
                if coords:
                    pts = pts[1:]
                coords.extend([[round(p[0], 5), round(p[1], 5)] for p in pts])
            # simplificación ligera: quita puntos casi colineales
            simp = [coords[0]] + [c for i, c in enumerate(coords[1:-1], 1) if i % 2 == 0 or len(coords) < 6] + [coords[-1]]
            feats.append({"type": "Feature", "id": t, "geometry": {"type": "LineString", "coordinates": simp},
                          "properties": {"id": t, "nombre": cadena[0].nombre, "clase": cadena[0].clase}})
            nombres.append(cadena[0].nombre)
            clases.append(cadena[0].clase)
        self.n_tramos = len(tramos)
        self.tramo_nombre, self.tramo_clase = nombres, clases
        C.TRAMOS_JSON.write_text(json.dumps({"n": len(tramos), "aristas": miembros, "nombres": nombres, "clases": clases}), encoding="utf-8")
        C.TRAMOS_GEOJSON.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"[red] exporté {len(tramos)} tramos → {C.TRAMOS_GEOJSON.relative_to(C.ROOT)}")

    # ─────────────────────────── ruteo
    def _nodos_viaje(self) -> tuple[list[int], list[float]]:
        nodos, pesos = [], []
        for a in self.aristas:
            w = C.PESO_CLASE.get(a.clase)
            if not w:
                continue
            x, y = self.nodos[a.u]
            if math.hypot(x, y) > C.RADIO_VIAJES_M:
                continue
            nodos.append(a.u)
            pesos.append(w)
        return nodos, pesos

    def nodo_aleatorio(self) -> int:
        return random.choices(*self.nodos_viaje)[0]

    def ruta(self, origen: int, destino: int) -> list[int] | None:
        """Lista de índices de arista del camino más rápido (peso = tiempo, con cierres)."""
        try:
            _, nodos = nx.bidirectional_dijkstra(self.G, origen, destino, weight=self._peso)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None
        out = []
        for u, v in zip(nodos[:-1], nodos[1:]):
            datos = self.G[u][v]
            k = min(datos, key=lambda kk: datos[kk]["peso"])
            out.append(datos[k]["idx"])
        return out

    @staticmethod
    def _peso(u, v, datos):
        return min(d["peso"] for d in datos.values())

    def set_peso(self, idx: int, factor: float) -> None:
        a = self.aristas[idx]
        self.G[a.u][a.v][a.k]["peso"] = a.largo / a.vlibre * factor

    def nodo_cercano(self, x: float, y: float) -> int:
        r = self.arista_cercana(x, y, 400)
        if r:
            return self.aristas[r[0]].v
        return min(self.nodos, key=lambda n: math.dist(self.nodos[n], (x, y)))
