'use client';
/**
 * Despacho local de la unidad de emergencia cuando el motor de ciudad no está corriendo.
 * Igual que sim/emergencias.py: sale del hospital más cercano, va a 1.4× la velocidad normal
 * y pone en verde los semáforos a < 300 m adelante (ola verde, 45 s).
 */
import { useEffect } from 'react';
import { along, length, lineString, nearestPointOnLine, point } from '@turf/turf';
import { hablar } from '@/lib/acciones';
import { cargarInfra } from '@/lib/data/infra';
import { trazarRutas } from '@/lib/map/mapbox';
import { useApp } from '@/lib/store';
import type { Emergencia } from '@/lib/types';

const OLA_VERDE_M = 300;
const OVERRIDE_MS = 45_000;
const ES_HOSPITAL = /hospital|cl[ií]nica|sanatorio|cruz roja|imss|issste|m[eé]dic|salud|urgencia/i;

const metros = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * 97_700, (a[1] - b[1]) * 110_900);

async function origenDe(e: Emergencia): Promise<{ nombre: string; lngLat: [number, number] }> {
  const destino: [number, number] = [e.lng, e.lat];
  if (e.tipo === 'ambulancia') {
    const infra = await cargarInfra().catch(() => null);
    const hospitales = (infra?.features || []).filter((f) => f.properties.tipo === 'hospital' && ES_HOSPITAL.test(f.properties.nombre || ''));
    // el más cercano pero a más de 600 m, para que se vea el recorrido
    const orden = hospitales
      .map((f) => ({ nombre: f.properties.nombre, lngLat: f.geometry.coordinates as [number, number], d: metros(f.geometry.coordinates, destino) }))
      .sort((a, b) => a.d - b.d);
    const h = orden.find((x) => x.d > 600) || orden[0];
    if (h) return { nombre: h.nombre, lngLat: h.lngLat };
  }
  // Bomberos / policía (o sin hospitales): unidad a ~2 km
  const ang = (e.id % 360) * (Math.PI / 180);
  return {
    nombre: e.tipo === 'policia' ? 'la patrulla más cercana' : e.tipo === 'bomberos' ? 'la estación más cercana' : 'la base más cercana',
    lngLat: [e.lng + Math.cos(ang) * 0.02, e.lat + Math.sin(ang) * 0.017],
  };
}

async function despachar(e: Emergencia, sigue: () => boolean) {
  const { nombre, lngLat } = await origenDe(e);
  const rutas = await trazarRutas(lngLat, [e.lng, e.lat]).catch(() => []);
  if (!sigue()) return;
  const geom: GeoJSON.LineString = rutas[0]?.geometry || { type: 'LineString', coordinates: [lngLat, [e.lng, e.lat]] };
  const linea = lineString(geom.coordinates);
  const largo = length(linea, { units: 'meters' });
  const durS = Math.max(90, (rutas[0]?.duracion ?? largo / 11) / 1.4);

  // semáforos sobre la ruta con su distancia desde el origen
  const infra = await cargarInfra().catch(() => null);
  const semaforos: { osm: number; m: number }[] = [];
  for (const f of infra?.features || []) {
    if (f.properties.tipo !== 'semaforo') continue;
    const c = f.geometry.coordinates;
    if (c[0] < Math.min(lngLat[0], e.lng) - 0.01 || c[0] > Math.max(lngLat[0], e.lng) + 0.01) continue;
    const np = nearestPointOnLine(linea, point(c), { units: 'meters' });
    if ((np.properties.dist ?? 99) < 25) semaforos.push({ osm: f.properties.osm_id, m: np.properties.location ?? 0 });
  }
  const verdes = new Set<number>();
  const t0 = Date.now();
  const base: Emergencia = { ...e, estado: 'en_camino', ruta: geom, hospital_nombre: nombre, amb_lng: lngLat[0], amb_lat: lngLat[1], eta_seg: Math.round(durS), semaforos_verdes: 0 };
  useApp.getState().set({ emergencia: base });

  const tick = setInterval(() => {
    const actual = useApp.getState().emergencia;
    if (!sigue() || !actual || actual.id !== e.id || actual.estado === 'cancelada') { clearInterval(tick); return; }
    const f = Math.min(1, (Date.now() - t0) / 1000 / durS);
    const m = largo * f;
    const pos = along(linea, m / 1000, { units: 'kilometers' }).geometry.coordinates;
    // ola verde
    const nuevos = semaforos.filter((s) => !verdes.has(s.osm) && s.m > m && s.m - m < OLA_VERDE_M);
    if (nuevos.length) {
      const ov = { ...useApp.getState().overrides };
      for (const s of nuevos) { verdes.add(s.osm); ov[s.osm] = { estado: 'verde', expira: Date.now() + OVERRIDE_MS }; }
      useApp.getState().set({ overrides: ov });
    }
    if (f >= 1) {
      clearInterval(tick);
      useApp.getState().set({ emergencia: { ...actual, estado: 'en_sitio', eta_seg: 0, amb_lng: e.lng, amb_lat: e.lat, semaforos_verdes: verdes.size } });
      useApp.getState().toast({ tipo: 'ok', titulo: e.tipo === 'ambulancia' ? 'La ambulancia llegó' : 'La unidad llegó', texto: `${verdes.size} semáforos en verde en su camino` });
      hablar(e.tipo === 'ambulancia' ? 'La ambulancia ya llegó.' : 'La unidad ya llegó.');
      return;
    }
    useApp.getState().set({
      emergencia: { ...actual, estado: 'en_camino', amb_lng: pos[0], amb_lat: pos[1], eta_seg: Math.round(durS * (1 - f)), semaforos_verdes: verdes.size },
    });
  }, 1000);
}

/** Si en 3 s nadie (el motor) despachó la emergencia solicitada, la despacha la app. */
export function useEmergenciaLocal() {
  const id = useApp((s) => (s.emergencia?.estado === 'solicitada' ? s.emergencia.id : null));
  useEffect(() => {
    if (id == null) return;
    let vivo = true;
    const t = setTimeout(() => {
      const e = useApp.getState().emergencia;
      if (!vivo || !e || e.id !== id || e.estado !== 'solicitada') return;
      despachar(e, () => vivo || useApp.getState().emergencia?.id === id);
    }, useApp.getState().motorVivo ? 6000 : 1500);
    return () => { vivo = false; clearTimeout(t); };
  }, [id]);
}
