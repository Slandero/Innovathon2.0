"""Motor de ciudad de ViveCUU.

    python -m sim.main                 # 150 autos, reloj x1
    python -m sim.main --n 300 --speed 5
    python -m sim.main --dry-run       # sin publicar (prueba local)
    python -m sim.main --exportar-tramos   # regenera public/data/tramos.geojson

Publica por Supabase Realtime Broadcast (canal city-live):
  tick     cada 1 s   {t, vehiculos:[[id,lat,lng,vel,heading]], ambulancias:[[id,lat,lng]]}
  trafico  cada 3 s   {t, n:[[tramo_id, nivel]]}     (geometría en public/data/tramos.geojson)
  celdas   cada 5 s   {t, o:[lng0,lat0,dlng,dlat], c:[[i,j,vel_kmh,n,anomalia]]}
"""
from __future__ import annotations

import argparse
import math
import time
from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from . import config as C
from .camiones import Transporte
from .congestion import Congestion
from .emergencias import GestorEmergencias
from .incidentes import GestorIncidentes
from .pronostico import Pronostico
from .publicar import Poller, Publicador
from .red import Red, a_xy, de_xy
from .semaforos import estado_semaforo
from .vehiculos import Flota

TZ = ZoneInfo("America/Chihuahua")
DLAT = C.CELDA_M / C.KY
DLNG = C.CELDA_M / C.KX
LNG0, LAT0 = -106.20, 28.55


def zona_activa(horarios: str, forzar: bool) -> bool:
    if forzar:
        return True
    ahora = datetime.now(TZ)
    if ahora.weekday() >= 5:
        return False
    m = ahora.hour * 60 + ahora.minute
    for rango in horarios.split(","):
        a, b = [int(t.split(":")[0]) * 60 + int(t.split(":")[1]) for t in rango.strip().split("-")]
        if a <= m <= b:
            return True
    return False


class Ciudad:
    def __init__(self, args) -> None:
        env = C.cargar_env()
        self.pub = Publicador(env, dry_run=args.dry_run)
        self.red = Red()
        self.velocidad = float(args.speed)
        self.n_objetivo = args.n
        self.congestion = Congestion(self.red.n_tramos, self.red.tramo_nombre, self.red.tramo_clase)
        self.overrides_locales: dict[int, tuple[str, float]] = {}
        self.overrides: dict[int, tuple[str, float]] = {}
        self.control: dict = {}
        self.demanda = C.curva_demanda(self.hora())
        self.zonas_activas: set[int] = set()
        self._actualizar_zonas()
        print(f"[motor] creando {args.n} autos…")
        self.flota = Flota(self, args.n)
        self.incidentes = GestorIncidentes(self)
        self.emergencias = GestorEmergencias(self)
        self.transporte = Transporte(self)
        self.transporte.publicar_rutas()
        self.pronostico = Pronostico(self)
        self.poller = Poller(self.pub, C.POLL_CADA_S)
        self.poller.start()
        self.celdas_lentas: dict[tuple[int, int], float] = {}
        self.anomalias_enviadas: dict[tuple[int, int], float] = {}
        self.celdas_excluidas = self._celdas_con_control()
        self.congelado: dict | None = None

    # ─────────── utilidades
    def hora(self) -> float:
        ahora = datetime.now(TZ)
        return ahora.hour + ahora.minute / 60

    def es_verde(self, osm_id: int, ahora: float) -> bool:
        ov = self.overrides_locales.get(osm_id) or self.overrides.get(osm_id)
        return estado_semaforo(osm_id, ahora, {osm_id: ov} if ov else None) == "verde"

    def _actualizar_zonas(self) -> None:
        forzar = bool(self.control.get("forzar_zonas"))
        self.zonas_activas = {i for i, z in enumerate(self.red.zonas) if zona_activa(z["horarios"], forzar)}

    def _celdas_con_control(self) -> set[tuple[int, int]]:
        """Celdas con semáforo o alto: ahí es normal que los autos estén parados."""
        out = set()
        for n in list(self.red.semaforo_nodo) + list(self.red.alto_nodo):
            lng, lat = de_xy(*self.red.nodos[n])
            i, j = int((lng - LNG0) / DLNG), int((lat - LAT0) / DLAT)
            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    out.add((i + di, j + dj))
        return out

    def vel_objetivo(self, a, v) -> float:
        vel = a.vlibre * self.congestion.factor_vel(a.tramo) * self.incidentes.factor_arista(a.idx)
        if a.clase not in C.CLASES_PRINCIPALES:
            vel *= 1 - 0.3 * self.demanda
        if a.escuela >= 0 and a.escuela in self.zonas_activas:
            vel = min(vel, 20 / 3.6)
        for s_tope in a.topes:
            if -8 < s_tope - v.s < 20:
                vel = min(vel, 10 / 3.6)
        if self.congelado and math.dist((v.x, v.y), self.congelado["xy"]) < self.congelado["radio"]:
            return 0.0
        return max(0.0, vel)

    # ─────────── control remoto (/demo, n8n, app)
    def sincronizar(self) -> None:
        with self.poller.lock:
            incidentes = list(self.poller.incidentes)
            self.overrides = dict(self.poller.overrides)
            emergencias = list(self.poller.emergencias)
            control = dict(self.poller.control)
        ahora = time.time()
        self.overrides_locales = {k: v for k, v in self.overrides_locales.items() if v[1] > ahora}
        self.incidentes.sincronizar(incidentes)
        self.emergencias.sincronizar(emergencias)
        if control != self.control:
            self.control = control
            self._actualizar_zonas()
            if control.get("velocidad"):
                self.velocidad = float(control["velocidad"])
            self._congelar(control.get("congelar"))

    def _congelar(self, cfg: dict | None) -> None:
        if not cfg or (cfg.get("hasta") and datetime.fromisoformat(cfg["hasta"].replace("Z", "+00:00")).timestamp() < time.time()):
            if self.congelado:
                print("[demo] congestión liberada")
                self.flota.lista = [v for v in self.flota.lista if not v.extra]
            self.congelado = None
            return
        x, y = a_xy(cfg["lng"], cfg["lat"])
        radio = float(cfg.get("radio_m", 120))
        self.congelado = {"xy": (x, y), "radio": radio, "lat": cfg["lat"], "lng": cfg["lng"]}
        # meter autos que van hacia ese punto para que se vea la fila
        r = self.red.arista_cercana(x, y, 300)
        if r:
            a = self.red.aristas[r[0]]
            for _ in range(10):
                v = self.flota.nuevo(origen=self.red.nodo_aleatorio(), destino=a.v, extra=True)
                if v:
                    # colócalo cerca del punto: busca en su ruta la arista más próxima
                    mejor = min(range(len(v.ruta)), key=lambda i: math.dist(self.red.aristas[v.ruta[i]].xy[-1], (x, y)))
                    v.i = max(0, mejor - 1)
                    v.s = self.red.aristas[v.ruta[v.i]].largo * (0.2 + 0.6 * (_ / 10))
        print(f"[demo] congestión total en {cfg['lat']:.5f},{cfg['lng']:.5f} (radio {radio:.0f} m)")

    # ─────────── celdas 50 × 50 m y anomalías
    def celdas(self, ahora: float) -> dict:
        agg: dict[tuple[int, int], list[float]] = defaultdict(list)
        for v in self.flota.lista:
            lng, lat = de_xy(v.x, v.y)
            agg[(int((lng - LNG0) / DLNG), int((lat - LAT0) / DLAT))].append(v.vel * 3.6)
        salida = []
        for k, vels in agg.items():
            vel = sum(vels) / len(vels)
            anom = False
            forzada = self.congelado is not None
            elegible = (k not in self.celdas_excluidas) or forzada
            if len(vels) >= 2 and vel < C.ANOMALIA_VEL_KMH and elegible:
                desde = self.celdas_lentas.setdefault(k, ahora)
                cx, cy = a_xy(LNG0 + (k[0] + 0.5) * DLNG, LAT0 + (k[1] + 0.5) * DLAT)
                if ahora - desde >= C.ANOMALIA_SEG / max(1.0, self.velocidad) and not self.incidentes.cerca(cx, cy, 200):
                    anom = True
                    self._reportar_anomalia(k, cx, cy, vel, len(vels), ahora)
            else:
                self.celdas_lentas.pop(k, None)
            salida.append([k[0], k[1], round(vel), len(vels), 1 if anom else 0])
        return {"t": round(ahora), "o": [LNG0, LAT0, round(DLNG, 8), round(DLAT, 8)], "c": salida}

    def _reportar_anomalia(self, k, x, y, vel, n, ahora) -> None:
        # una sola alerta por zona cada 5 min
        for k2, t in self.anomalias_enviadas.items():
            if abs(k2[0] - k[0]) <= 4 and abs(k2[1] - k[1]) <= 4 and ahora - t < 300:
                return
        self.anomalias_enviadas[k] = ahora
        lng, lat = de_xy(x, y)
        r = self.red.arista_cercana(x, y, 80)
        calle = self.red.aristas[r[0]].nombre if r else ""
        print(f"[anomalía] celda {k} · {n} autos a {vel:.1f} km/h en {calle or 'calle sin nombre'} → n8n")
        self.pub.incidente_n8n({
            "origen": "anomalia_celda", "texto": f"Tráfico detenido sin causa conocida en {calle or 'la zona'}: {n} autos a {vel:.0f} km/h por más de 20 s",
            "tipo": "congestion", "calle": calle, "carril": None, "carriles_totales": 3, "severidad": None,
            "lat": round(lat, 6), "lng": round(lng, 6),
        })

    # ─────────── loop
    def correr(self) -> None:
        ultimo = {"trafico": 0.0, "celdas": 0.0, "estado": 0.0, "sync": 0.0, "log": 0.0, "zonas": 0.0}
        t_prev = time.time()
        print("[motor] corriendo. Ctrl+C para salir.")
        while True:
            t0 = time.time()
            dt_real = t0 - t_prev
            t_prev = t0
            hora_pico = bool(self.control.get("hora_pico"))
            self.demanda = 1.0 if hora_pico else C.curva_demanda(self.hora())
            if t0 - ultimo["sync"] >= C.POLL_CADA_S:
                ultimo["sync"] = t0
                self.sincronizar()
                self.flota.ajustar(int(self.n_objetivo * (1.3 if hora_pico else 1.0)))
            if t0 - ultimo["zonas"] >= 60:
                ultimo["zonas"] = t0
                self._actualizar_zonas()

            dt = dt_real * self.velocidad
            self.flota.avanzar(dt, t0)
            self.emergencias.avanzar(dt)
            self.transporte.avanzar(dt, t0)

            self.pub.broadcast("tick", {"t": round(t0, 1), "vehiculos": self.flota.tick_payload(), "ambulancias": self.emergencias.payload()})

            if t0 - ultimo["trafico"] >= C.TRAFICO_CADA_S:
                ultimo["trafico"] = t0
                self.congestion.actualizar(self.demanda, t0, self.flota.vel_por_tramo())
                niveles = [[i, n] for i, n in enumerate(self.congestion.nivel)]
                self.pub.broadcast("trafico", {"t": round(t0), "n": niveles})
                self.pronostico.muestrear()
            if t0 - ultimo["celdas"] >= C.CELDAS_CADA_S:
                ultimo["celdas"] = t0
                self.pub.broadcast("celdas", self.celdas(t0))
            if t0 - ultimo["estado"] >= C.ESTADO_CADA_S:
                ultimo["estado"] = t0
                self.pub.upsert("estado_ciudad", [{
                    "id": 1, "corredores": self.pronostico.corredores(), "n_vehiculos": len(self.flota.lista),
                    "demanda": round(self.demanda, 2), "updated_at": datetime.now(TZ).isoformat(),
                }], "id")
            if t0 - ultimo["log"] >= 15:
                ultimo["log"] = t0
                niv = self.congestion.nivel
                print(f"[motor] {len(self.flota.lista)} autos · demanda {self.demanda:.2f} · tramos "
                      f"fluido {niv.count(0)} / mod {niv.count(1)} / pesado {niv.count(2)} / detenido {niv.count(3)} · "
                      f"tick {self.pub.bytes_tick / 1024:.1f} KB · {len(self.incidentes.activos)} incidentes · errores {self.pub.errores}")

            espera = C.TICK_S - (time.time() - t0)
            if espera > 0:
                time.sleep(espera)


def main() -> None:
    ap = argparse.ArgumentParser(description="Motor de ciudad ViveCUU")
    ap.add_argument("--n", type=int, default=C.N_VEHICULOS, help="número de autos")
    ap.add_argument("--speed", type=float, default=1.0, help="multiplicador del reloj de simulación")
    ap.add_argument("--dry-run", action="store_true", help="no publica a Supabase")
    ap.add_argument("--exportar-tramos", action="store_true", help="regenera la geometría de tramos y sale")
    args = ap.parse_args()
    if args.exportar_tramos:
        if C.TRAMOS_JSON.exists():
            C.TRAMOS_JSON.unlink()
        Red()
        return
    try:
        Ciudad(args).correr()
    except KeyboardInterrupt:
        print("\n[motor] listo, hasta luego.")


if __name__ == "__main__":
    main()
