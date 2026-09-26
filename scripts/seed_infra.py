"""Normaliza data/osm_infra.json, exporta GeoJSON para el mapa y siembra Supabase.

- public/data/infra.geojson           puntos {osm_id, tipo, nombre}
- public/data/zonas_escolares.geojson polígonos buffer 150 m por escuela
- Supabase: tablas infra y zonas_escolares (lotes de 500) si hay llaves en .env.local

Uso:  python scripts/seed_infra.py [--solo-geojson]
"""
import json
import math
import os
import sys
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "osm_infra.json"
OUT_INFRA = ROOT / "public" / "data" / "infra.geojson"
OUT_ZONAS = ROOT / "public" / "data" / "zonas_escolares.geojson"
BUFFER_M = 150
TOPES = {"bump", "hump", "table", "cushion", "yes", "rumble_strip", "speed_bump", "speed_hump", "dip"}


def cargar_env() -> dict:
    env = dict(os.environ)
    for nombre in (".env.local", ".env"):
        p = ROOT / nombre
        if p.exists():
            for linea in p.read_text(encoding="utf-8").splitlines():
                if "=" in linea and not linea.strip().startswith("#"):
                    k, v = linea.split("=", 1)
                    env.setdefault(k.strip(), v.strip())
    return env


def tipo_de(tags: dict, el_type: str) -> str | None:
    hw = tags.get("highway")
    if hw == "traffic_signals":
        return "semaforo"
    if hw == "stop":
        return "alto"
    if "traffic_calming" in tags and tags["traffic_calming"] in TOPES:
        return "tope"
    if hw == "crossing":
        return "cruce"
    if tags.get("amenity") == "school":
        return "escuela"
    if tags.get("amenity") == "hospital":
        return "hospital"
    if hw == "bus_stop":
        return "parada"
    return None


def normalizar(elements: list) -> list[dict]:
    out, vistos = [], set()
    for el in elements:
        if el["type"] == "relation":
            continue
        tags = el.get("tags", {}) or {}
        tipo = tipo_de(tags, el["type"])
        if not tipo:
            continue
        if el["type"] == "node":
            lat, lng = el.get("lat"), el.get("lon")
        else:
            c = el.get("center") or {}
            lat, lng = c.get("lat"), c.get("lon")
        if lat is None or lng is None:
            continue
        # ways y nodes pueden compartir número: desplazamos los ways
        osm_id = el["id"] if el["type"] == "node" else 10_000_000_000 + el["id"]
        if (osm_id, tipo) in vistos:
            continue
        vistos.add((osm_id, tipo))
        meta = {k: tags[k] for k in ("traffic_calming", "operator", "ref", "route_ref", "emergency", "isced:level") if k in tags}
        meta["osm_type"] = el["type"]
        out.append({
            "osm_id": osm_id,
            "tipo": tipo,
            "nombre": tags.get("name") or tags.get("name:es"),
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "meta": meta,
        })
    return out


def circulo(lat: float, lng: float, radio_m: float, n: int = 32) -> list:
    """Buffer en metros. Usa shapely+pyproj si están; si no, aproximación local."""
    try:
        from pyproj import Transformer
        from shapely.geometry import Point
        from shapely.ops import transform

        a = Transformer.from_crs("EPSG:4326", "EPSG:32613", always_xy=True).transform
        b = Transformer.from_crs("EPSG:32613", "EPSG:4326", always_xy=True).transform
        poly = transform(b, transform(a, Point(lng, lat)).buffer(radio_m, quad_segs=8))
        return [[round(x, 6), round(y, 6)] for x, y in poly.exterior.coords]
    except ImportError:
        dlat = radio_m / 111_320
        dlng = radio_m / (111_320 * math.cos(math.radians(lat)))
        pts = [[round(lng + dlng * math.cos(2 * math.pi * i / n), 6), round(lat + dlat * math.sin(2 * math.pi * i / n), 6)] for i in range(n)]
        return pts + [pts[0]]


def exportar(items: list[dict]) -> list[dict]:
    OUT_INFRA.parent.mkdir(parents=True, exist_ok=True)
    feats = [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [it["lng"], it["lat"]]},
        "properties": {"osm_id": it["osm_id"], "tipo": it["tipo"], "nombre": it["nombre"] or ""},
    } for it in items]
    OUT_INFRA.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    zonas = []
    for it in items:
        if it["tipo"] != "escuela":
            continue
        zonas.append({
            "osm_id": it["osm_id"],
            "nombre": it["nombre"] or "Escuela",
            "poligono": {"type": "Polygon", "coordinates": [circulo(it["lat"], it["lng"], BUFFER_M)]},
        })
    OUT_ZONAS.write_text(json.dumps({"type": "FeatureCollection", "features": [{
        "type": "Feature", "geometry": z["poligono"],
        "properties": {"osm_id": z["osm_id"], "nombre": z["nombre"], "horarios": "07:00-08:30,12:30-14:30", "limite_kmh": 20},
    } for z in zonas]}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"GeoJSON: {len(feats)} puntos → {OUT_INFRA.relative_to(ROOT)}; {len(zonas)} zonas → {OUT_ZONAS.relative_to(ROOT)}")
    return zonas


def rest(env: dict, metodo: str, ruta: str, cuerpo=None, prefer: str = "return=minimal"):
    url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/rest/v1/" + ruta
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(url, method=metodo, data=json.dumps(cuerpo).encode() if cuerpo is not None else None, headers={
        "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": prefer,
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        txt = r.read().decode()
        return json.loads(txt) if txt else None


def sembrar(env: dict, items: list[dict], zonas: list[dict]) -> None:
    print("Sembrando Supabase…")
    rest(env, "DELETE", "zonas_escolares?id=gt.0")
    ids_escuela: dict[int, int] = {}
    for i in range(0, len(items), 500):
        lote = items[i:i + 500]
        filas = rest(env, "POST", "infra?on_conflict=osm_id,tipo", lote, prefer="resolution=merge-duplicates,return=representation")
        for f in filas or []:
            if f["tipo"] == "escuela":
                ids_escuela[f["osm_id"]] = f["id"]
        print(f"  infra {i + len(lote)}/{len(items)}")
    filas_z = [{"escuela_id": ids_escuela.get(z["osm_id"]), "nombre": z["nombre"], "poligono": z["poligono"]} for z in zonas]
    for i in range(0, len(filas_z), 500):
        rest(env, "POST", "zonas_escolares", filas_z[i:i + 500])
    print(f"  zonas_escolares {len(filas_z)}")


def main() -> None:
    if not SRC.exists():
        print("Falta data/osm_infra.json. Corre primero: python scripts/fetch_osm.py")
        sys.exit(1)
    raw = json.loads(SRC.read_text(encoding="utf-8"))
    elements = raw.get("elements", [])
    items = normalizar(elements)
    zonas = exportar(items)

    env = cargar_env()
    if "--solo-geojson" in sys.argv:
        pass
    elif env.get("NEXT_PUBLIC_SUPABASE_URL") and env.get("SUPABASE_SERVICE_ROLE_KEY"):
        try:
            sembrar(env, items, zonas)
        except Exception as e:  # noqa: BLE001
            print(f"No se pudo sembrar Supabase: {e}")
    else:
        print("Sin llaves de Supabase en .env.local: solo se exportó GeoJSON.")

    conteo = Counter(it["tipo"] for it in items)
    rels = sum(1 for el in elements if el["type"] == "relation")
    print("\nConteo por tipo:")
    for tipo in ("semaforo", "alto", "tope", "cruce", "escuela", "hospital", "parada"):
        print(f"  {tipo:<9} {conteo.get(tipo, 0):>6}")
    print(f"  rutas de camión (relaciones OSM): {rels}")


if __name__ == "__main__":
    main()
