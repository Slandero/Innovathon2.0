/**
 * Alertas en el camino (sección 18.3): buffer de 25 m sobre la ruta con Turf
 * y cruce con semáforos, altos, topes, cruces, zonas escolares activas, incidentes y reportes.
 */
import { bbox, booleanIntersects, centroid, lineString, nearestPointOnLine, point, pointToLineDistance } from '@turf/turf';
import type { InfraFC, ZonasFC } from '@/lib/data/infra';
import { zonaActiva } from '@/lib/data/infra';
import type { AlertaRuta, Incidente, Reporte } from '@/lib/types';

const BUFFER_M = 25;

export interface ResumenAlertas {
  semaforos: number;
  altos: number;
  topes: number;
  cruces: number;
  zonas: number;
  incidentes: number;
  reportes: number;
}

const ETIQUETA: Record<string, string> = {
  semaforo: 'Semáforo', alto: 'Alto', tope: 'Tope', cruce: 'Cruce peatonal',
};

/** Junta puntos del mismo tipo que caen a menos de `km` sobre la ruta (una intersección = 1 semáforo). */
function agrupar(alertas: AlertaRuta[], km: number): AlertaRuta[] {
  const out: AlertaRuta[] = [];
  for (const a of alertas) {
    const prev = out[out.length - 1];
    if (prev && a.km - prev.km < km) continue;
    out.push(a);
  }
  return out;
}

export function alertasEnRuta(
  linea: GeoJSON.LineString,
  infra: InfraFC,
  zonas: ZonasFC,
  incidentes: Incidente[],
  reportes: Reporte[],
  forzarZonas = false,
): { alertas: AlertaRuta[]; resumen: ResumenAlertas } {
  const ls = lineString(linea.coordinates);
  const [w, s, e, n] = bbox(ls);
  const m = 0.0006;
  const dentroBbox = (lng: number, lat: number) => lng >= w - m && lng <= e + m && lat >= s - m && lat <= n + m;
  const kmDe = (lng: number, lat: number) => nearestPointOnLine(ls, point([lng, lat]), { units: 'kilometers' }).properties.location ?? 0;
  const cerca = (lng: number, lat: number, metros: number) =>
    pointToLineDistance(point([lng, lat]), ls, { units: 'meters' }) <= metros;

  const porTipo: Record<string, AlertaRuta[]> = { semaforo: [], alto: [], tope: [], cruce: [] };
  for (const f of infra.features) {
    const { tipo, osm_id, nombre } = f.properties;
    if (!(tipo in porTipo)) continue;
    const [lng, lat] = f.geometry.coordinates;
    if (!dentroBbox(lng, lat) || !cerca(lng, lat, BUFFER_M)) continue;
    porTipo[tipo].push({ tipo, km: kmDe(lng, lat), lng, lat, osm_id, titulo: nombre || ETIQUETA[tipo] });
  }
  for (const t of Object.keys(porTipo)) porTipo[t].sort((a, b) => a.km - b.km);
  const semaforos = agrupar(porTipo.semaforo, 0.045);
  const altos = agrupar(porTipo.alto, 0.02);
  const topes = agrupar(porTipo.tope, 0.02);
  const cruces = agrupar(porTipo.cruce, 0.03);

  const zonasRuta: AlertaRuta[] = [];
  for (const z of zonas.features) {
    if (!zonaActiva(z.properties.horarios, forzarZonas)) continue;
    const [zlng, zlat] = z.geometry.coordinates[0][0];
    if (!dentroBbox(zlng, zlat)) continue;
    if (!booleanIntersects(ls, z)) continue;
    const c = centroid(z).geometry.coordinates;
    zonasRuta.push({ tipo: 'zona_escolar', km: kmDe(c[0], c[1]), lng: c[0], lat: c[1], osm_id: z.properties.osm_id, titulo: `Zona escolar · ${z.properties.nombre}` });
  }

  const inc: AlertaRuta[] = incidentes
    .filter((i) => i.estado === 'activo' && dentroBbox(i.lng, i.lat) && cerca(i.lng, i.lat, 40))
    .map((i) => ({
      tipo: 'incidente' as const, km: kmDe(i.lng, i.lat), lng: i.lng, lat: i.lat, ref: i.id,
      titulo: i.origen === 'obra_municipal'
        ? `Obra en ${i.calle}`
        : `${i.tipo === 'accidente' ? 'Choque' : i.tipo[0].toUpperCase() + i.tipo.slice(1)}${i.carril_bloqueado?.length ? ` en carril ${i.carril_bloqueado.join(', ')}` : ''}`,
    }));

  const rep: AlertaRuta[] = reportes
    .filter((r) => (r.severidad ?? 0) >= 3 && r.estado !== 'resuelto' && dentroBbox(r.lng, r.lat) && cerca(r.lng, r.lat, BUFFER_M))
    .map((r) => ({ tipo: 'reporte' as const, km: kmDe(r.lng, r.lat), lng: r.lng, lat: r.lat, ref: r.id, titulo: r.titulo || 'Reporte ciudadano' }));

  const alertas = [...semaforos, ...altos, ...topes, ...cruces, ...zonasRuta, ...inc, ...rep].sort((a, b) => a.km - b.km);
  return {
    alertas,
    resumen: {
      semaforos: semaforos.length, altos: altos.length, topes: topes.length + rep.filter((r) => /tope|bache/i.test(r.titulo)).length,
      cruces: cruces.length, zonas: zonasRuta.length, incidentes: inc.length, reportes: rep.length,
    },
  };
}

/** ¿Algún incidente activo cae sobre esta línea? */
export function incidenteEnLinea(linea: GeoJSON.LineString, incidentes: Incidente[], metros = 40): Incidente | undefined {
  const ls = lineString(linea.coordinates);
  return incidentes.find((i) => i.estado === 'activo' && pointToLineDistance(point([i.lng, i.lat]), ls, { units: 'meters' }) <= metros);
}

export function textoResumen(r: ResumenAlertas): string[] {
  const p = (n: number, s: string, pl: string) => `${n} ${n === 1 ? s : pl}`;
  const out: string[] = [];
  if (r.semaforos) out.push(p(r.semaforos, 'semáforo', 'semáforos'));
  if (r.altos) out.push(p(r.altos, 'alto', 'altos'));
  if (r.topes) out.push(p(r.topes, 'tope', 'topes'));
  if (r.zonas) out.push(p(r.zonas, 'zona escolar activa', 'zonas escolares activas'));
  if (r.incidentes) out.push(p(r.incidentes, 'incidente', 'incidentes'));
  return out;
}
