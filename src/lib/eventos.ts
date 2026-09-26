/**
 * Eventos de ciudad que regresan las API routes. Con Supabase la app ya los recibe por Realtime
 * (persistido = true); sin Supabase el cliente los aplica a su estado y los reparte a otras
 * pestañas del mismo navegador (ej. /demo → app) con BroadcastChannel.
 */
import type { AlertaN8n, Emergencia, Incidente, Reporte } from './types';

export type EventoCiudad =
  | { t: 'incidente'; incidente: Incidente }
  | { t: 'resolver_incidentes'; ids?: number[] }
  | { t: 'voto_incidente'; id: number; votos: number }
  | { t: 'alerta'; alerta: AlertaN8n }
  | { t: 'reporte'; reporte: Reporte }
  | { t: 'voto_reporte'; id: number; votos: number }
  | { t: 'emergencia'; emergencia: Emergencia }
  | { t: 'semaforo'; osm_id: number; estado: 'verde' | 'rojo'; expira: number }
  | { t: 'trafico'; lng: number; lat: number; radio_m: number; nivel: number }
  | { t: 'hora_pico'; activo: boolean }
  | { t: 'limpiar' };

export interface RespuestaCiudad {
  ok: boolean;
  /** true si ya quedó en Supabase (la app lo recibe por Realtime). */
  persistido: boolean;
  eventos: EventoCiudad[];
  mensaje?: string;
  error?: string;
}

/** Calles del botón secreto (coordenadas reales sobre la avenida). */
export const CALLES_DEMO: { nombre: string; lng: number; lat: number; carriles: number; alterna: string }[] = [
  { nombre: 'Av. Tecnológico', lng: -106.11187, lat: 28.68964, carriles: 3, alterna: 'Av. Universidad' },
  { nombre: 'Av. Universidad', lng: -106.08865, lat: 28.65394, carriles: 3, alterna: 'Av. Tecnológico' },
  { nombre: 'Periférico de la Juventud', lng: -106.12557, lat: 28.64516, carriles: 3, alterna: 'Av. Teófilo Borunda' },
  { nombre: 'Av. Independencia', lng: -106.07217, lat: 28.62689, carriles: 2, alterna: 'Av. Ocampo' },
  { nombre: 'Av. Pacheco', lng: -106.03988, lat: 28.63433, carriles: 2, alterna: 'Av. Tecnológico' },
];

export function alternaDe(calle: string | null | undefined): string {
  const c = (calle || '').toLowerCase();
  return CALLES_DEMO.find((x) => c.includes(x.nombre.toLowerCase().replace(/^av\. /, '')))?.alterna || 'calles paralelas';
}

/** Estilo de aviso (toast) para cada tipo de alerta de n8n. */
export const TOAST_POR_ALERTA: Record<AlertaN8n['tipo'], 'sos' | 'familiar' | 'desvio' | 'dependencia' | 'info'> = {
  '911_simulado': 'sos', familiar: 'familiar', desvio: 'desvio', dependencia: 'dependencia', resumen: 'info', zona_escolar: 'info',
};
