/** Lógica de camiones compartida por la pestaña Camiones y /api/camiones/cercanos. */
import { distance, length, lineString, nearestPointOnLine, point, pointToLineDistance } from '@turf/turf';
import type { Camion, Parada, RutaCamion } from '@/lib/types';

const M_POR_MIN_CAMION = 300; // ~18 km/h con paradas
const M_POR_MIN_CAMINANDO = 75;

export const pctOcupacion = (c: Pick<Camion, 'ocupacion' | 'capacidad'>) =>
  Math.round((c.ocupacion / Math.max(1, c.capacidad || 80)) * 100);

export function textoOcupacion(pct: number): string {
  if (pct < 35) return 'Viene vacío';
  if (pct < 60) return 'Hay lugar';
  if (pct < 80) return 'Viene casi lleno';
  return 'Viene lleno';
}

/** Umbrales del diseño: < 55 % verde, 55–79 % ámbar, ≥ 80 % naranja. */
export const colorOcupacion = (pct: number) => (pct < 55 ? '#34A853' : pct < 80 ? '#FBBC04' : '#F57C00');
/** Color de texto legible para el porcentaje. */
export const colorTextoOcupacion = (pct: number) => (pct < 55 ? '#137333' : pct < 80 ? '#B06000' : '#B34700');

/** km a lo largo del trazo de la ruta. */
export function kmEnRuta(ruta: RutaCamion, lng: number, lat: number): number {
  return nearestPointOnLine(lineString(ruta.trazo.coordinates), point([lng, lat]), { units: 'kilometers' }).properties.location ?? 0;
}

export interface Llegada { camion: Camion; eta_min: number; pct: number }

/** Próximas unidades que llegan a una parada (la ruta es un circuito). */
export function proximasLlegadas(ruta: RutaCamion, parada: Parada, camiones: Camion[]): Llegada[] {
  const total = length(lineString(ruta.trazo.coordinates), { units: 'kilometers' });
  return camiones
    .filter((c) => c.ruta_id === ruta.id && c.lat != null && c.lng != null)
    .map((c) => {
      const km = kmEnRuta(ruta, c.lng!, c.lat!);
      const falta = (((parada.km - km) % total) + total) % total;
      return { camion: c, eta_min: Math.max(1, Math.round((falta * 1000) / M_POR_MIN_CAMION)), pct: pctOcupacion(c) };
    })
    .sort((a, b) => a.eta_min - b.eta_min);
}

export interface ParadaCercana { ruta: RutaCamion; parada: Parada; distancia_m: number; caminar_min: number }

export function paradaMasCercana(rutas: RutaCamion[], lng: number, lat: number, soloRuta?: string): ParadaCercana | null {
  let mejor: ParadaCercana | null = null;
  for (const r of rutas) {
    if (soloRuta && r.id !== soloRuta) continue;
    for (const p of r.paradas || []) {
      const d = distance(point([lng, lat]), point([p.lng, p.lat]), { units: 'meters' });
      if (!mejor || d < mejor.distancia_m) mejor = { ruta: r, parada: p, distancia_m: d, caminar_min: Math.max(1, Math.round(d / M_POR_MIN_CAMINANDO)) };
    }
  }
  return mejor;
}

export interface Sugerencia { ruta: RutaCamion; subir: ParadaCercana; bajar: ParadaCercana; llegada?: Llegada }

/** Rutas cuya línea pasa a < `radio` m del origen y del destino (sección 21). */
export function sugerirRutas(rutas: RutaCamion[], camiones: Camion[], origen: [number, number], destino: [number, number], radio = 400): Sugerencia[] {
  const out: Sugerencia[] = [];
  for (const r of rutas) {
    const ls = lineString(r.trazo.coordinates);
    const dO = pointToLineDistance(point(origen), ls, { units: 'meters' });
    const dD = pointToLineDistance(point(destino), ls, { units: 'meters' });
    if (dO > radio || dD > radio) continue;
    const subir = paradaMasCercana([r], origen[0], origen[1])!;
    const bajar = paradaMasCercana([r], destino[0], destino[1])!;
    if (!subir || !bajar) continue;
    out.push({ ruta: r, subir, bajar, llegada: proximasLlegadas(r, subir.parada, camiones)[0] });
  }
  return out.sort((a, b) => a.subir.distancia_m + (a.llegada?.eta_min ?? 30) * 75 - (b.subir.distancia_m + (b.llegada?.eta_min ?? 30) * 75));
}

export function fraseSugerencia(s: Sugerencia): string {
  const nombre = s.ruta.nombre.split('·')[0].trim();
  const base = `Toma la ${nombre} en la parada ${s.subir.parada.nombre}, a ${Math.round(s.subir.distancia_m / 10) * 10} metros.`;
  if (!s.llegada) return `${base} Ahorita no veo unidades en camino.`;
  return `${base} Llega en ${s.llegada.eta_min} minuto${s.llegada.eta_min === 1 ? '' : 's'} y viene ${s.llegada.pct}% lleno.`;
}
