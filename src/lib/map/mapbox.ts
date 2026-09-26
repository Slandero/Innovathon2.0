/**
 * Llamadas a Mapbox (Search Box, Geocoding v6, Directions driving-traffic)
 * con respaldo a Nominatim y OSRM públicos si no hay token o fallan.
 */
import { BBOX_CUU, MAPBOX_TOKEN, USA_MAPBOX } from '@/lib/config';
import type { LngLat, Lugar, Paso, Ruta } from '@/lib/types';

const BBOX = BBOX_CUU.join(',');

async function getJson<T>(url: string, ms = 8000): Promise<T> {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${r.status} ${url.split('?')[0]}`);
  return r.json() as Promise<T>;
}

// ───────────────────────────── Búsqueda

interface SearchBoxResp {
  features: {
    properties: { mapbox_id: string; name: string; full_address?: string; place_formatted?: string; address?: string };
    geometry: { coordinates: LngLat };
  }[];
}

async function buscarSearchBox(q: string, cerca?: LngLat): Promise<Lugar[]> {
  const p = new URLSearchParams({
    q, country: 'mx', bbox: BBOX, language: 'es', limit: '8', access_token: MAPBOX_TOKEN,
  });
  if (cerca) p.set('proximity', `${cerca[0]},${cerca[1]}`);
  const j = await getJson<SearchBoxResp>(`https://api.mapbox.com/search/searchbox/v1/forward?${p}`);
  return j.features.map((f) => ({
    id: f.properties.mapbox_id,
    nombre: f.properties.name,
    direccion: f.properties.full_address || f.properties.place_formatted || f.properties.address || '',
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
}

interface GeocodeV6Resp {
  features: { id: string; properties: { name: string; full_address?: string; place_formatted?: string }; geometry: { coordinates: LngLat } }[];
}

async function buscarGeocodingV6(q: string, cerca?: LngLat): Promise<Lugar[]> {
  const p = new URLSearchParams({ q, country: 'mx', bbox: BBOX, language: 'es', limit: '8', access_token: MAPBOX_TOKEN });
  if (cerca) p.set('proximity', `${cerca[0]},${cerca[1]}`);
  const j = await getJson<GeocodeV6Resp>(`https://api.mapbox.com/search/geocode/v6/forward?${p}`);
  return j.features.map((f) => ({
    id: f.id,
    nombre: f.properties.name,
    direccion: f.properties.place_formatted || f.properties.full_address || '',
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
}

interface NominatimItem { place_id: number; name?: string; display_name: string; lat: string; lon: string }

let ultimoNominatim = 0;
async function buscarNominatim(q: string): Promise<Lugar[]> {
  // Política de uso: máx. 1 petición por segundo
  const espera = 1000 - (Date.now() - ultimoNominatim);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimoNominatim = Date.now();
  const p = new URLSearchParams({
    q: /chihuahua/i.test(q) ? q : `${q}, Chihuahua`,
    format: 'jsonv2', limit: '8', 'accept-language': 'es', countrycodes: 'mx',
    viewbox: `${BBOX_CUU[0]},${BBOX_CUU[3]},${BBOX_CUU[2]},${BBOX_CUU[1]}`, bounded: '1',
  });
  const j = await getJson<NominatimItem[]>(`https://nominatim.openstreetmap.org/search?${p}`);
  return j.map((it) => {
    const partes = it.display_name.split(',').map((s) => s.trim());
    return {
      id: `osm-${it.place_id}`,
      nombre: it.name || partes[0],
      direccion: partes.slice(1, 4).join(', '),
      lng: Number(it.lon),
      lat: Number(it.lat),
    };
  });
}

export async function buscarLugares(q: string, cerca?: LngLat): Promise<Lugar[]> {
  if (!q.trim()) return [];
  if (USA_MAPBOX) {
    try {
      const r = await buscarSearchBox(q, cerca);
      if (r.length) return r;
    } catch { /* sigue al respaldo */ }
    try {
      const r = await buscarGeocodingV6(q, cerca);
      if (r.length) return r;
    } catch { /* sigue al respaldo */ }
  }
  try {
    return await buscarNominatim(q);
  } catch {
    return [];
  }
}

/** Nombre de la calle en una coordenada (para el copiloto). */
export async function calleEn(lng: number, lat: number): Promise<string> {
  try {
    if (USA_MAPBOX) {
      const p = new URLSearchParams({ longitude: String(lng), latitude: String(lat), language: 'es', types: 'street,address', limit: '1', access_token: MAPBOX_TOKEN });
      const j = await getJson<GeocodeV6Resp>(`https://api.mapbox.com/search/geocode/v6/reverse?${p}`, 5000);
      if (j.features[0]) return j.features[0].properties.name;
    }
    const j = await getJson<{ address?: { road?: string } }>(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&accept-language=es&lat=${lat}&lon=${lng}`, 5000);
    return j.address?.road || 'Chihuahua';
  } catch {
    return 'Chihuahua';
  }
}

/** Calle y colonia en una coordenada (para el pin de reportes). */
export async function direccionEn(lng: number, lat: number): Promise<{ calle: string; zona: string }> {
  try {
    if (USA_MAPBOX) {
      const p = new URLSearchParams({ longitude: String(lng), latitude: String(lat), language: 'es', types: 'address,street', limit: '1', access_token: MAPBOX_TOKEN });
      const j = await getJson<{ features: { properties: { name: string; context?: { neighborhood?: { name: string }; locality?: { name: string } } } }[] }>(
        `https://api.mapbox.com/search/geocode/v6/reverse?${p}`, 5000);
      const f = j.features[0];
      if (f) return { calle: f.properties.name, zona: f.properties.context?.neighborhood?.name || f.properties.context?.locality?.name || 'Chihuahua' };
    }
    const j = await getJson<{ address?: { road?: string; house_number?: string; suburb?: string; neighbourhood?: string; quarter?: string } }>(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=es&lat=${lat}&lon=${lng}`, 5000);
    const a = j.address || {};
    return { calle: a.road ? `${a.road}${a.house_number ? ` ${a.house_number}` : ''}` : 'Punto en el mapa', zona: a.neighbourhood || a.suburb || a.quarter || 'Chihuahua' };
  } catch {
    return { calle: 'Punto en el mapa', zona: 'Chihuahua' };
  }
}

// ───────────────────────────── Rutas

interface DirStep {
  distance: number;
  name: string;
  maneuver: { type: string; modifier?: string; instruction?: string; location: LngLat };
}
interface DirRoute {
  geometry: GeoJSON.LineString;
  duration: number;
  distance: number;
  legs: { summary?: string; steps: DirStep[] }[];
}

const GIROS: Record<string, string> = {
  left: 'a la izquierda', right: 'a la derecha', 'slight left': 'ligeramente a la izquierda',
  'slight right': 'ligeramente a la derecha', 'sharp left': 'cerrado a la izquierda',
  'sharp right': 'cerrado a la derecha', straight: 'derecho', uturn: 'en U',
};

/** OSRM no trae texto: armamos la instrucción en español. */
function instruccionEs(s: DirStep): string {
  const calle = s.name ? ` en ${s.name}` : '';
  const giro = GIROS[s.maneuver.modifier || ''] || '';
  switch (s.maneuver.type) {
    case 'depart': return `Sal${calle || ' hacia tu destino'}`;
    case 'arrive': return 'Llegaste a tu destino';
    case 'roundabout': case 'rotary': return `En la glorieta toma la salida${calle}`;
    case 'merge': return `Incorpórate${calle}`;
    case 'fork': return `En la bifurcación mantente ${giro}${calle}`;
    case 'continue': case 'new name': return `Sigue${calle}`;
    default: return `Gira ${giro}${calle}`.replace('Gira derecho', 'Sigue derecho');
  }
}

function aRuta(r: DirRoute, fuente: Ruta['fuente']): Ruta {
  const pasos: Paso[] = r.legs.flatMap((l) => l.steps).map((s) => ({
    instruccion: fuente === 'mapbox' && s.maneuver.instruction ? s.maneuver.instruction : instruccionEs(s),
    calle: s.name,
    distancia: s.distance,
    tipo: s.maneuver.type,
    modificador: s.maneuver.modifier,
    ubicacion: s.maneuver.location,
  }));
  // Resumen: calle más larga del recorrido
  const porCalle = new Map<string, number>();
  for (const p of pasos) if (p.calle) porCalle.set(p.calle, (porCalle.get(p.calle) || 0) + p.distancia);
  const principal = [...porCalle.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    geometry: r.geometry,
    duracion: r.duration,
    distancia: r.distance,
    pasos,
    resumen: r.legs[0]?.summary || principal || '',
    fuente,
  };
}

export async function trazarRutas(origen: LngLat, destino: LngLat, evitar?: LngLat): Promise<Ruta[]> {
  const coords = `${origen[0]},${origen[1]};${destino[0]},${destino[1]}`;
  if (USA_MAPBOX) {
    try {
      const p = new URLSearchParams({
        alternatives: 'true', steps: 'true', geometries: 'geojson', overview: 'full', language: 'es', access_token: MAPBOX_TOKEN,
      });
      if (evitar) p.set('exclude', `point(${evitar[0]} ${evitar[1]})`);
      const j = await getJson<{ code: string; routes: DirRoute[] }>(
        `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?${p}`);
      if (j.code === 'Ok' && j.routes.length) return j.routes.map((r) => aRuta(r, 'mapbox'));
    } catch { /* respaldo */ }
  }
  try {
    const j = await getJson<{ code: string; routes: DirRoute[] }>(
      `https://router.project-osrm.org/route/v1/driving/${coords}?alternatives=true&steps=true&geometries=geojson&overview=full`, 10000);
    if (j.code === 'Ok' && j.routes.length) return j.routes.map((r) => aRuta(r, 'osrm'));
  } catch { /* respaldo final */ }
  // Último respaldo: línea recta a 30 km/h para que la UI no se rompa
  const dx = (destino[0] - origen[0]) * 111320 * Math.cos((origen[1] * Math.PI) / 180);
  const dy = (destino[1] - origen[1]) * 110540;
  const d = Math.hypot(dx, dy) * 1.3;
  return [{
    geometry: { type: 'LineString', coordinates: [origen, destino] },
    duracion: d / 8.3, distancia: d, resumen: 'ruta aproximada', fuente: 'local',
    pasos: [
      { instruccion: 'Dirígete a tu destino', calle: '', distancia: d, tipo: 'depart', ubicacion: origen },
      { instruccion: 'Llegaste a tu destino', calle: '', distancia: 0, tipo: 'arrive', ubicacion: destino },
    ],
  }];
}
