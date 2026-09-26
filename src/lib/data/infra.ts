import type { TipoInfra } from '@/lib/types';

export type InfraProps = { osm_id: number; tipo: TipoInfra; nombre: string };
export type InfraFC = GeoJSON.FeatureCollection<GeoJSON.Point, InfraProps>;
export type ZonaProps = { osm_id: number; nombre: string; horarios: string; limite_kmh: number };
export type ZonasFC = GeoJSON.FeatureCollection<GeoJSON.Polygon, ZonaProps>;

const vacia = <T extends GeoJSON.Geometry, P>(): GeoJSON.FeatureCollection<T, P> => ({ type: 'FeatureCollection', features: [] });

let infraCache: Promise<InfraFC> | null = null;
let zonasCache: Promise<ZonasFC> | null = null;

export function cargarInfra(): Promise<InfraFC> {
  infraCache ??= fetch('/data/infra.geojson').then((r) => r.json()).catch(() => vacia());
  return infraCache;
}

export function cargarZonas(): Promise<ZonasFC> {
  zonasCache ??= fetch('/data/zonas_escolares.geojson').then((r) => r.json()).catch(() => vacia());
  return zonasCache;
}

/** Minutos del día en hora de Chihuahua. */
export function minutosCUU(fecha = new Date()): number {
  const partes = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Chihuahua', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(fecha);
  const h = Number(partes.find((p) => p.type === 'hour')?.value || 0);
  const m = Number(partes.find((p) => p.type === 'minute')?.value || 0);
  return h * 60 + m;
}

/** ¿La zona escolar está activa por horario? ("07:00-08:30,12:30-14:30") */
export function zonaActiva(horarios = '07:00-08:30,12:30-14:30', forzar = false, fecha = new Date()): boolean {
  if (forzar) return true;
  const dia = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chihuahua', weekday: 'short' }).format(fecha);
  if (dia === 'Sat' || dia === 'Sun') return false;
  const ahora = minutosCUU(fecha);
  return horarios.split(',').some((rango) => {
    const [a, b] = rango.split('-').map((t) => {
      const [h, m] = t.trim().split(':').map(Number);
      return h * 60 + m;
    });
    return ahora >= a && ahora <= b;
  });
}
