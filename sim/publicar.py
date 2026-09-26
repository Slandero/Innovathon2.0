"""Publicación a Supabase (Realtime Broadcast vía REST + PostgREST) y llamadas a n8n / la app.

Las escrituras van a un pool de hilos para que la red nunca frene el tick.
"""
from __future__ import annotations

import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import httpx


class Publicador:
    def __init__(self, env: dict, dry_run: bool = False) -> None:
        self.url = (env.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
        self.key = env.get("SUPABASE_SERVICE_ROLE_KEY") or ""
        self.n8n = (env.get("N8N_WEBHOOK_BASE") or "").rstrip("/")
        self.app = (env.get("APP_URL") or "http://localhost:3000").rstrip("/")
        self.iot_token = env.get("IOT_INGEST_TOKEN") or ""
        self.dry = dry_run
        self.activo = bool(self.url and self.key) and not dry_run
        self.http = httpx.Client(timeout=4.0)
        self.pool = ThreadPoolExecutor(max_workers=8)
        self.errores = 0
        self._ultimo_error = 0.0
        self.bytes_tick = 0
        if not self.activo:
            print("[pub] Sin Supabase (o --dry-run): el motor corre pero no publica.")

    # ─────────── utilidades
    def _headers(self, prefer: str | None = None) -> dict:
        h = {"apikey": self.key, "Authorization": f"Bearer {self.key}", "Content-Type": "application/json"}
        if prefer:
            h["Prefer"] = prefer
        return h

    def _log_error(self, donde: str, e: Exception | str) -> None:
        self.errores += 1
        if time.time() - self._ultimo_error > 10:
            self._ultimo_error = time.time()
            print(f"[pub] error en {donde}: {e}")

    def _fondo(self, fn, *args) -> None:
        self.pool.submit(self._seguro, fn, *args)

    def _seguro(self, fn, *args):
        try:
            return fn(*args)
        except Exception as e:  # noqa: BLE001
            self._log_error(getattr(fn, "__name__", "?"), e)

    # ─────────── Realtime Broadcast
    def broadcast(self, evento: str, payload: dict) -> None:
        if not self.activo:
            return
        cuerpo = json.dumps({"messages": [{"topic": "city-live", "event": evento, "payload": payload}]}, separators=(",", ":"))
        if evento == "tick":
            self.bytes_tick = len(cuerpo)
        self._fondo(self._post_broadcast, cuerpo)

    def _post_broadcast(self, cuerpo: str) -> None:
        r = self.http.post(f"{self.url}/realtime/v1/api/broadcast", content=cuerpo, headers=self._headers())
        if r.status_code >= 300:
            self._log_error("broadcast", f"{r.status_code} {r.text[:200]}")

    # ─────────── PostgREST
    def select(self, ruta: str) -> list[dict]:
        if not self.activo:
            return []
        try:
            r = self.http.get(f"{self.url}/rest/v1/{ruta}", headers=self._headers(), timeout=3.0)
            if r.status_code < 300:
                return r.json()
            self._log_error(f"select {ruta.split('?')[0]}", f"{r.status_code} {r.text[:160]}")
        except Exception as e:  # noqa: BLE001
            self._log_error(f"select {ruta.split('?')[0]}", e)
        return []

    def upsert(self, tabla: str, filas, on_conflict: str | None = None, fondo: bool = True):
        if not self.activo:
            return None
        ruta = f"{tabla}?on_conflict={on_conflict}" if on_conflict else tabla

        def hacer():
            r = self.http.post(f"{self.url}/rest/v1/{ruta}", json=filas, headers=self._headers("resolution=merge-duplicates,return=representation"))
            if r.status_code >= 300:
                self._log_error(f"upsert {tabla}", f"{r.status_code} {r.text[:200]}")
                return None
            return r.json()
        if fondo:
            self._fondo(hacer)
            return None
        return self._seguro(hacer)

    def insert(self, tabla: str, fila: dict, fondo: bool = True):
        if not self.activo:
            return None

        def hacer():
            r = self.http.post(f"{self.url}/rest/v1/{tabla}", json=fila, headers=self._headers("return=representation"))
            if r.status_code >= 300:
                self._log_error(f"insert {tabla}", f"{r.status_code} {r.text[:200]}")
                return None
            return r.json()
        if fondo:
            self._fondo(hacer)
            return None
        return self._seguro(hacer)

    def patch(self, tabla: str, filtro: str, cambios: dict) -> None:
        if not self.activo:
            return

        def hacer():
            r = self.http.patch(f"{self.url}/rest/v1/{tabla}?{filtro}", json=cambios, headers=self._headers("return=minimal"))
            if r.status_code >= 300:
                self._log_error(f"patch {tabla}", f"{r.status_code} {r.text[:200]}")
        self._fondo(hacer)

    # ─────────── n8n / app
    def incidente_n8n(self, cuerpo: dict) -> None:
        """F1 de n8n; si no hay n8n, la ruta de respaldo de la app hace lo mismo."""
        if self.dry:
            return

        def hacer():
            if self.n8n:
                r = self.http.post(f"{self.n8n}/vivecuu/incidente", json=cuerpo, timeout=20)
                if r.status_code < 300:
                    return
            self.http.post(f"{self.app}/api/incidente", json=cuerpo, timeout=20)
        self._fondo(hacer)

    def iot(self, lectura: dict) -> None:
        if self.dry:
            return

        def hacer():
            r = self.http.post(f"{self.app}/api/iot/ingest", json=lectura, headers={"x-iot-token": self.iot_token}, timeout=4)
            if r.status_code >= 300:
                self._log_error("iot/ingest", f"{r.status_code} {r.text[:160]}")
        self._fondo(hacer)


class Poller(threading.Thread):
    """Lee cada N s lo que la app, /demo y n8n escriben: incidentes, overrides, emergencias, control."""

    def __init__(self, pub: Publicador, cada: float) -> None:
        super().__init__(daemon=True)
        self.pub, self.cada = pub, cada
        self.lock = threading.Lock()
        self.incidentes: list[dict] = []
        self.overrides: dict[int, tuple[str, float]] = {}
        self.emergencias: list[dict] = []
        self.control: dict = {}

    def run(self) -> None:
        from datetime import datetime
        while True:
            if self.pub.activo:
                inc = self.pub.select("incidentes?estado=eq.activo&select=*")
                ov = self.pub.select(f"overrides_semaforo?expira=gt.{datetime.utcnow().isoformat()}Z&select=*")
                em = self.pub.select("emergencias?estado=in.(solicitada,en_camino)&select=*&order=created_at.desc&limit=5")
                ctl = self.pub.select("sim_control?id=eq.1&select=*")
                with self.lock:
                    self.incidentes = inc
                    self.overrides = {o["osm_id"]: (o["estado"], _ts(o["expira"])) for o in ov}
                    self.emergencias = em
                    self.control = ctl[0] if ctl else {}
            time.sleep(self.cada)


def _ts(iso: str) -> float:
    from datetime import datetime
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
