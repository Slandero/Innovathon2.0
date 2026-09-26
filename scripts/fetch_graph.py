"""Descarga la red vial manejable de Chihuahua con OSMnx (sección 9.1) → data/cuu_drive.graphml

Uso:  python scripts/fetch_graph.py
Tarda 1–5 min. Córrelo primero que nada y comparte el .graphml con el equipo.
"""
import time
from pathlib import Path

import osmnx as ox

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "cuu_drive.graphml"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    try:
        G = ox.graph_from_place("Chihuahua, Chihuahua, Mexico", network_type="drive")
    except Exception as e:  # noqa: BLE001
        print(f"graph_from_place falló ({e}); uso el bbox de la ciudad")
        G = ox.graph_from_bbox(bbox=(-106.20, 28.55, -105.95, 28.76), network_type="drive")
    G = ox.add_edge_speeds(G)
    G = ox.add_edge_travel_times(G)
    ox.save_graphml(G, OUT)
    print(f"OK: {len(G.nodes)} nodos, {len(G.edges)} aristas en {time.time() - t0:.0f} s → {OUT}")


if __name__ == "__main__":
    main()
