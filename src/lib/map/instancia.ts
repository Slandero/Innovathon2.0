/**
 * Referencia global al mapa (Mapbox o MapLibre) para que cualquier componente pueda
 * mover la cámara sin pasar props. Tipado mínimo común a ambas librerías.
 */
export interface Mapa {
  flyTo(o: { center: [number, number]; zoom?: number; pitch?: number; bearing?: number; duration?: number; essential?: boolean }): void;
  easeTo(o: { center?: [number, number]; zoom?: number; pitch?: number; bearing?: number; duration?: number; padding?: unknown }): void;
  setPadding?(p: { top: number; bottom: number; left: number; right: number }): void;
  jumpTo(o: { center?: [number, number]; zoom?: number; pitch?: number; bearing?: number }): void;
  fitBounds(b: [[number, number], [number, number]], o?: { padding?: unknown; duration?: number; maxZoom?: number }): void;
  getZoom(): number;
  getCenter(): { lng: number; lat: number };
  getSource(id: string): unknown;
  getLayer(id: string): unknown;
  setFeatureState(f: { source: string; id: number | string }, s: Record<string, unknown>): void;
  setLayoutProperty(layer: string, prop: string, value: unknown): void;
  setPaintProperty?(layer: string, prop: string, value: unknown): void;
  hasImage(id: string): boolean;
  addImage(id: string, img: ImageData, opts?: { pixelRatio?: number }): void;
  updateImage?(id: string, img: ImageData): void;
  isStyleLoaded(): boolean;
  on(ev: string, fn: (...a: unknown[]) => void): void;
  off(ev: string, fn: (...a: unknown[]) => void): void;
}

let mapa: Mapa | null = null;
export const setMapa = (m: Mapa | null) => { mapa = m; };
export const getMapa = () => mapa;

export function setDatos(fuente: string, datos: GeoJSON.FeatureCollection | GeoJSON.Feature) {
  try {
    const s = mapa?.getSource(fuente) as { setData?: (d: unknown) => void } | undefined;
    s?.setData?.(datos);
  } catch { /* el mapa se está desmontando o el estilo aún no carga */ }
}

export function volarA(lng: number, lat: number, zoom = 15) {
  mapa?.flyTo({ center: [lng, lat], zoom, pitch: 0, bearing: 0, duration: 1200, essential: true });
}

export function encuadrar(coords: number[][], padding = { top: 200, bottom: 340, left: 40, right: 40 }) {
  if (!mapa || !coords.length) return;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of coords) {
    w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
  }
  mapa.fitBounds([[w, s], [e, n]], { padding, duration: 900, maxZoom: 16 });
}
