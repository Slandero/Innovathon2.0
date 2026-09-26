'use client';
/** Acciones de la vista principal (búsqueda → lugar → ruta), usables desde UI y copiloto. */
import { distance, lineString, point, pointToLineDistance } from '@turf/turf';
import { CENTRO_CUU } from '@/lib/config';
import { cargarInfra, cargarZonas } from '@/lib/data/infra';
import { incidentesYObras } from '@/lib/data/obras';
import { alertasEnRuta, incidenteEnLinea, textoResumen } from '@/lib/map/alertas';
import { encuadrar, volarA } from '@/lib/map/instancia';
import { buscarLugares, trazarRutas } from '@/lib/map/mapbox';
import { posicionActual, useApp } from '@/lib/store';
import type { Incidente, LngLat, Lugar, Ruta } from '@/lib/types';

const RECIENTES = 'vivecuu:recientes';

export function leerRecientes(): Lugar[] {
  try { return JSON.parse(localStorage.getItem(RECIENTES) || '[]'); } catch { return []; }
}
function guardarReciente(l: Lugar) {
  try {
    const r = [l, ...leerRecientes().filter((x) => x.id !== l.id)].slice(0, 6);
    localStorage.setItem(RECIENTES, JSON.stringify(r));
  } catch { /* sin storage */ }
}

export function origenActual(): LngLat {
  const p = posicionActual(useApp.getState());
  return p ? [p.lng, p.lat] : [CENTRO_CUU.lng, CENTRO_CUU.lat];
}

export function distanciaA(l: { lng: number; lat: number }): number {
  const [lng, lat] = origenActual();
  return distance(point([lng, lat]), point([l.lng, l.lat]), { units: 'meters' });
}

export function elegirLugar(l: Lugar) {
  guardarReciente(l);
  const s = useApp.getState();
  s.limpiarRuta();
  s.set({ lugar: l, busquedaAbierta: false, hoja: null, tab: 'mapa' });
  volarA(l.lng, l.lat, 15.5);
}

export async function comoLlegar(destino?: Lugar): Promise<Ruta[]> {
  const s = useApp.getState();
  const l = destino ?? s.lugar;
  if (!l) return [];
  s.set({ cargandoRuta: true, lugar: l });
  const rutas = await trazarRutas(origenActual(), [l.lng, l.lat]);
  // Si la ruta principal cruza un incidente activo y hay alternativa limpia, esa va primero
  let sel = 0;
  const inc = incidentesYObras(useApp.getState());
  if (rutas.length > 1 && incidenteEnLinea(rutas[0].geometry, inc)) {
    const limpia = rutas.findIndex((r) => !incidenteEnLinea(r.geometry, inc));
    if (limpia > 0) sel = limpia;
  }
  useApp.getState().set({ rutas, rutaSel: sel, cargandoRuta: false });
  encuadrar(rutas[sel].geometry.coordinates);
  return rutas;
}

/** Recalcula alertas de la ruta seleccionada (se llama cuando cambian datos). */
export async function recalcularAlertas() {
  const s = useApp.getState();
  const r = s.rutas[s.rutaSel];
  if (!r) return;
  const [infra, zonas] = await Promise.all([cargarInfra(), cargarZonas()]);
  const { alertas, resumen } = alertasEnRuta(r.geometry, infra, zonas, incidentesYObras(s), s.reportes, s.forzarZonas);
  // pasos con km en ruta para el banner de maniobras
  let acumulado = 0;
  for (const p of r.pasos) {
    p.kmEnRuta = acumulado / 1000;
    acumulado += p.distancia;
  }
  useApp.getState().set({ alertas, resumen });
}

export const minutos = (seg: number) => Math.max(1, Math.round(seg / 60));

export function horaLlegada(seg: number): string {
  return new Date(Date.now() + seg * 1000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Chihuahua' });
}

export function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/** Client tool del copiloto: busca, traza y regresa un texto para decir en voz. */
export async function llevarA(destino: string): Promise<string> {
  const lugares = await buscarLugares(destino, origenActual());
  if (!lugares.length) return `No encontré "${destino}" en Chihuahua. ¿Me lo dices de otra forma?`;
  const l = lugares[0];
  elegirLugar(l);
  const rutas = await comoLlegar(l);
  await recalcularAlertas();
  const s = useApp.getState();
  const r = rutas[s.rutaSel];
  if (!r) return `Encontré ${l.nombre}, pero no pude trazar la ruta.`;
  const extras = s.resumen ? textoResumen(s.resumen).join(', ') : '';
  return `Ruta lista a ${l.nombre}: ${minutos(r.duracion)} minutos${r.resumen ? ` por ${r.resumen}` : ''}${extras ? `, ${extras}` : ''}.`;
}

/**
 * Si un incidente nuevo cae sobre la ruta activa, recalcula y avisa "Te cambié de ruta, +N min".
 * Devuelve true si cambió de ruta.
 */
export async function evitarIncidente(inc: Incidente): Promise<boolean> {
  const s = useApp.getState();
  const actual = s.rutas[s.rutaSel];
  if (!actual || !s.lugar) return false;
  const ls = lineString(actual.geometry.coordinates);
  if (pointToLineDistance(point([inc.lng, inc.lat]), ls, { units: 'meters' }) > 40) return false;
  const rutas = await trazarRutas(origenActual(), [s.lugar.lng, s.lugar.lat], [inc.lng, inc.lat]);
  const todas = incidentesYObras(useApp.getState());
  const limpia = rutas.findIndex((r) => !incidenteEnLinea(r.geometry, todas));
  const calle = inc.calle ? ` en ${inc.calle}` : '';
  if (limpia === -1) {
    useApp.getState().toast({ tipo: 'desvio', titulo: `Aguas: ${inc.tipo === 'accidente' ? 'choque' : inc.tipo}${calle}`, texto: 'No hay alternativa más rápida; maneja con precaución.' });
    return false;
  }
  const extra = Math.max(0, minutos(rutas[limpia].duracion) - minutos(actual.duracion));
  useApp.getState().set({ rutas, rutaSel: limpia });
  await recalcularAlertas();
  const msg = `Te cambié de ruta, +${extra} min`;
  useApp.getState().toast({ tipo: 'desvio', titulo: msg, texto: `Evitas el ${inc.tipo === 'accidente' ? 'choque' : inc.tipo}${calle}${rutas[limpia].resumen ? ` · por ${rutas[limpia].resumen}` : ''}` });
  hablar(`${msg}. Evitas el ${inc.tipo === 'accidente' ? 'choque' : inc.tipo}${calle}.`);
  return true;
}

// ───────────── Voz del navegador (es-MX)
let vozMx: SpeechSynthesisVoice | null | undefined;
export function hablar(texto: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (vozMx === undefined) {
    const voces = speechSynthesis.getVoices();
    vozMx = voces.find((v) => v.lang === 'es-MX') || voces.find((v) => v.lang.startsWith('es')) || null;
  }
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-MX';
  if (vozMx) u.voice = vozMx;
  u.rate = 1.05;
  speechSynthesis.speak(u);
}
