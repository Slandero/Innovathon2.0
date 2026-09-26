"""SOS: hospital más cercano por tiempo, ambulancia a 1.4× y ola verde (overrides a < 300 m adelante)."""
from __future__ import annotations

import math
import time
from datetime import datetime, timedelta, timezone

from .red import a_xy, de_xy

OLA_VERDE_M = 300
OVERRIDE_S = 45


class Ambulancia:
    def __init__(self, eid: int, ruta: list[int], hospital: dict) -> None:
        self.id, self.ruta, self.hospital = eid, ruta, hospital
        self.i, self.s, self.vel = 0, 0.0, 0.0
        self.x = self.y = self.rumbo = 0.0
        self.verdes: set[int] = set()
        self.llego = False
        self.ultimo_patch = 0.0


class GestorEmergencias:
    def __init__(self, ciudad) -> None:
        self.c = ciudad
        self.ambulancias: dict[int, Ambulancia] = {}
        self.procesadas: set[int] = set()
        self.infra_ids: dict[int, int] = {}

    def _hospital_id(self, osm_id: int) -> int | None:
        if osm_id not in self.infra_ids:
            filas = self.c.pub.select(f"infra?osm_id=eq.{osm_id}&tipo=eq.hospital&select=id")
            self.infra_ids[osm_id] = filas[0]["id"] if filas else None
        return self.infra_ids[osm_id]

    def sincronizar(self, filas: list[dict]) -> None:
        for f in filas:
            if f["estado"] == "solicitada" and f["id"] not in self.procesadas:
                self.procesadas.add(f["id"])
                self.despachar(f)
        vivas = {f["id"] for f in filas}
        for eid in list(self.ambulancias):
            if eid not in vivas and not self.ambulancias[eid].llego:
                del self.ambulancias[eid]  # cancelada desde la app

    def despachar(self, f: dict) -> None:
        red, pub = self.c.red, self.c.pub
        x, y = a_xy(f["lng"], f["lat"])
        destino = red.nodo_cercano(x, y)
        candidatos = sorted(red.hospitales, key=lambda h: math.dist((h["x"], h["y"]), (x, y)))[:4]
        mejor = None
        for h in candidatos:
            ruta = red.ruta(red.nodo_cercano(h["x"], h["y"]), destino)
            if not ruta:
                continue
            seg = sum(red.aristas[i].largo / (red.aristas[i].vlibre * 1.4) for i in ruta)
            if not mejor or seg < mejor[0]:
                mejor = (seg, ruta, h)
        if not mejor:
            print(f"[sos] #{f['id']} sin ruta disponible")
            return
        seg, ruta, h = mejor
        amb = Ambulancia(f["id"], ruta, h)
        a0 = red.aristas[ruta[0]]
        amb.x, amb.y, amb.rumbo = a0.punto(0)
        self.ambulancias[f["id"]] = amb
        coords = []
        for i in ruta:
            for px, py in red.aristas[i].xy[(1 if coords else 0):]:
                lng, lat = de_xy(px, py)
                coords.append([round(lng, 5), round(lat, 5)])
        pub.patch("emergencias", f"id=eq.{f['id']}", {
            "estado": "en_camino", "hospital_id": self._hospital_id(h["osm_id"]), "hospital_nombre": h["nombre"],
            "ruta": {"type": "LineString", "coordinates": coords}, "eta_seg": round(seg),
            "amb_lng": round(h["lng"], 5), "amb_lat": round(h["lat"], 5), "semaforos_verdes": 0,
        })
        print(f"[sos] #{f['id']} ambulancia desde {h['nombre']} · ETA {seg / 60:.1f} min")

    def avanzar(self, dt: float) -> None:
        red, pub = self.c.red, self.c.pub
        ahora = time.time()
        for amb in list(self.ambulancias.values()):
            if amb.llego:
                continue
            restante_dt = dt
            while restante_dt > 1e-3 and amb.i < len(amb.ruta):
                a = red.aristas[amb.ruta[amb.i]]
                amb.vel = a.vlibre * 1.4 * max(0.75, self.c.congestion.factor_vel(a.tramo))
                paso = amb.vel * restante_dt
                if amb.s + paso < a.largo:
                    amb.s += paso
                    break
                restante_dt -= (a.largo - amb.s) / amb.vel
                amb.i += 1
                amb.s = 0.0
            if amb.i >= len(amb.ruta):
                amb.llego = True
                pub.patch("emergencias", f"id=eq.{amb.id}", {"estado": "en_sitio", "eta_seg": 0})
                print(f"[sos] #{amb.id} ambulancia en sitio · {len(amb.verdes)} semáforos en verde")
                continue
            a = red.aristas[amb.ruta[amb.i]]
            amb.x, amb.y, amb.rumbo = a.punto(amb.s)

            # ola verde: semáforos a < 300 m adelante sobre la ruta
            nuevos, adelante = [], a.largo - amb.s
            j = amb.i
            while j < len(amb.ruta) and adelante < OLA_VERDE_M:
                b = red.aristas[amb.ruta[j]]
                osm = red.semaforo_nodo.get(b.v)
                if osm is not None and osm not in amb.verdes:
                    amb.verdes.add(osm)
                    nuevos.append(osm)
                j += 1
                if j < len(amb.ruta):
                    adelante += red.aristas[amb.ruta[j]].largo
            if nuevos:
                expira = (datetime.now(timezone.utc) + timedelta(seconds=OVERRIDE_S)).isoformat()
                pub.upsert("overrides_semaforo", [{"osm_id": o, "estado": "verde", "motivo": "ola verde ambulancia", "expira": expira} for o in nuevos], "osm_id")
                for o in nuevos:
                    self.c.overrides_locales[o] = ("verde", ahora + OVERRIDE_S)

            if ahora - amb.ultimo_patch > 2:
                amb.ultimo_patch = ahora
                resto = (a.largo - amb.s) / amb.vel + sum(red.aristas[i].largo / (red.aristas[i].vlibre * 1.4) for i in amb.ruta[amb.i + 1:])
                lng, lat = de_xy(amb.x, amb.y)
                pub.patch("emergencias", f"id=eq.{amb.id}", {
                    "amb_lng": round(lng, 5), "amb_lat": round(lat, 5), "eta_seg": round(resto), "semaforos_verdes": len(amb.verdes),
                })

    def payload(self) -> list[list]:
        out = []
        for amb in self.ambulancias.values():
            if not amb.llego:
                lng, lat = de_xy(amb.x, amb.y)
                out.append([amb.id, round(lat, 5), round(lng, 5)])
        return out
