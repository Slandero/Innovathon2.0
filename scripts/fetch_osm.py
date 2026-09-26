"""Descarga la infraestructura vial de Chihuahua desde Overpass (sección 9.1) → data/osm_infra.json

Uso:  python scripts/fetch_osm.py
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "osm_infra.json"

QUERY = """
[out:json][timeout:120][bbox:28.55,-106.20,28.76,-105.95];
(
  node["highway"="traffic_signals"];
  node["highway"="stop"];
  node["traffic_calming"];
  way["traffic_calming"];
  node["highway"="crossing"];
  node["amenity"="school"];
  way["amenity"="school"];
  node["amenity"="hospital"];
  way["amenity"="hospital"];
  node["highway"="bus_stop"];
  relation["route"="bus"];
);
out center tags;
"""

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    for url in ENDPOINTS:
        try:
            print(f"Consultando {url} …")
            t0 = time.time()
            req = urllib.request.Request(url, data=data, headers={"User-Agent": "ViveCUU-hackathon/1.0"})
            with urllib.request.urlopen(req, timeout=180) as r:
                payload = json.loads(r.read().decode("utf-8"))
            OUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            n = len(payload.get("elements", []))
            print(f"OK: {n} elementos en {time.time() - t0:.1f} s → {OUT}")
            return
        except Exception as e:  # noqa: BLE001
            print(f"  falló: {e}")
    print("Todos los espejos de Overpass fallaron. Pide el JSON a un compañero.")
    sys.exit(1)


if __name__ == "__main__":
    main()
