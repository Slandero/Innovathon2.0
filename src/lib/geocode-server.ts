import 'server-only';
import { BBOX_CUU } from '@/lib/config';

/** Geocodifica texto libre en Chihuahua desde el servidor (Mapbox si hay token, si no Nominatim). */
export async function geocodificar(q: string, cerca?: [number, number]): Promise<{ nombre: string; lng: number; lat: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  try {
    if (token?.startsWith('pk.')) {
      const p = new URLSearchParams({ q, country: 'mx', bbox: BBOX_CUU.join(','), language: 'es', limit: '1', access_token: token });
      if (cerca) p.set('proximity', `${cerca[0]},${cerca[1]}`);
      const r = await fetch(`https://api.mapbox.com/search/searchbox/v1/forward?${p}`, { signal: AbortSignal.timeout(5000) });
      const j = await r.json();
      const f = j.features?.[0];
      if (f) return { nombre: f.properties.name, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
    }
  } catch { /* respaldo */ }
  try {
    const p = new URLSearchParams({
      q: /chihuahua/i.test(q) ? q : `${q}, Chihuahua`, format: 'jsonv2', limit: '1', countrycodes: 'mx',
      viewbox: `${BBOX_CUU[0]},${BBOX_CUU[3]},${BBOX_CUU[2]},${BBOX_CUU[1]}`, bounded: '1', 'accept-language': 'es',
    });
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, {
      headers: { 'User-Agent': 'ViveCUU-hackathon/1.0 (demo)' }, signal: AbortSignal.timeout(6000),
    });
    const j = (await r.json()) as { name?: string; display_name: string; lat: string; lon: string }[];
    if (j[0]) return { nombre: j[0].name || j[0].display_name.split(',')[0], lng: Number(j[0].lon), lat: Number(j[0].lat) };
  } catch { /* nada */ }
  return null;
}
