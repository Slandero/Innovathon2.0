/**
 * Función determinista de semáforos (sección 18.4). La MISMA fórmula vive en sim/semaforos.py,
 * así todos los celulares y el motor ven el mismo color sin gastar red.
 * Ciclo 90 s: verde 45, ámbar 4, rojo 41. offset = osm_id % 90.
 */
export type EstadoSemaforo = 'verde' | 'ambar' | 'rojo';

export const CICLO = 90;
export const VERDE = 45;
export const AMBAR = 4;

export interface Override { estado: 'verde' | 'rojo'; expira: number }

export function estadoSemaforo(osmId: number, ahoraMs = Date.now(), override?: Override): EstadoSemaforo {
  if (override && override.expira > ahoraMs) return override.estado;
  const t = (Math.floor(ahoraMs / 1000) + (osmId % CICLO)) % CICLO;
  return t < VERDE ? 'verde' : t < VERDE + AMBAR ? 'ambar' : 'rojo';
}

/** Segundos que faltan para que el semáforo se ponga en verde (0 si ya está). */
export function segundosParaVerde(osmId: number, ahoraMs = Date.now(), override?: Override): number {
  if (override && override.expira > ahoraMs) {
    return override.estado === 'verde' ? 0 : Math.ceil((override.expira - ahoraMs) / 1000);
  }
  const t = (Math.floor(ahoraMs / 1000) + (osmId % CICLO)) % CICLO;
  return t < VERDE ? 0 : CICLO - t;
}
