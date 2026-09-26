'use client';
/**
 * Aplica los eventos que regresan las API routes cuando NO llegan por Supabase Realtime,
 * y los reparte a las otras pestañas del navegador (app ↔ /demo) con BroadcastChannel.
 */
import { useEffect } from 'react';
import { TOAST_POR_ALERTA, type EventoCiudad, type RespuestaCiudad } from '@/lib/eventos';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { limpiarTraficoLocal, traficoEnPunto, traficoHoraPico } from './trafico';

const CANAL = 'vivecuu-ciudad';
let canal: BroadcastChannel | null = null;
const getCanal = () => {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  canal ??= new BroadcastChannel(CANAL);
  return canal;
};

function upsert<T extends { id: number | string }>(lista: T[], fila: T): T[] {
  const i = lista.findIndex((x) => x.id === fila.id);
  if (i === -1) return [fila, ...lista];
  const c = lista.slice();
  c[i] = fila;
  return c;
}

/** Aplica eventos al estado. `silencioso` evita toasts (p. ej. al repetir los propios). */
export function aplicarEventos(eventos: EventoCiudad[], { silencioso = false } = {}) {
  const s = useApp.getState();
  for (const e of eventos) {
    switch (e.t) {
      case 'incidente': s.set({ incidentes: upsert(useApp.getState().incidentes, e.incidente) }); break;
      case 'resolver_incidentes': {
        const ids = e.ids;
        s.set({ incidentes: ids ? useApp.getState().incidentes.filter((i) => !ids.includes(i.id)) : [] });
        break;
      }
      case 'voto_incidente': s.set({ incidentes: useApp.getState().incidentes.map((i) => (i.id === e.id ? { ...i, votos: e.votos } : i)) }); break;
      case 'alerta': {
        const a = e.alerta;
        if (useApp.getState().alertasN8n.some((x) => x.id === a.id)) break;
        s.set({ alertasN8n: [a, ...useApp.getState().alertasN8n].slice(0, 50) });
        if (!silencioso) s.toast({ tipo: TOAST_POR_ALERTA[a.tipo], titulo: a.titulo || 'Alerta', texto: a.mensaje || undefined });
        break;
      }
      case 'reporte': s.set({ reportes: upsert(useApp.getState().reportes, e.reporte) }); break;
      case 'voto_reporte': s.set({ reportes: useApp.getState().reportes.map((r) => (r.id === e.id ? { ...r, votos: e.votos } : r)) }); break;
      case 'emergencia': {
        const actual = useApp.getState().emergencia;
        const activa = actual && (actual.estado === 'solicitada' || actual.estado === 'en_camino');
        if (!activa || actual.id === e.emergencia.id) s.set({ emergencia: e.emergencia });
        break;
      }
      case 'semaforo': s.set({ overrides: { ...useApp.getState().overrides, [e.osm_id]: { estado: e.estado, expira: e.expira } } }); break;
      case 'trafico': traficoEnPunto(e); break;
      case 'hora_pico': traficoHoraPico(e.activo); break;
      case 'limpiar':
        s.set({ incidentes: [], alertasN8n: [], overrides: {}, emergencia: null });
        limpiarTraficoLocal();
        break;
    }
  }
}

/**
 * POST a una API de ciudad. Si no quedó en Supabase, aplica los eventos aquí y los manda a las
 * demás pestañas. Nunca lanza: regresa null si falla la red.
 */
export async function llamarCiudad<T extends RespuestaCiudad = RespuestaCiudad>(url: string, cuerpo: unknown): Promise<T | null> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const j = (await r.json()) as T;
    if (!r.ok || !j.ok) return j.ok === false ? j : null;
    // Con Supabase en el cliente, Realtime entrega todo. Tráfico y hora pico son solo visuales: siempre local.
    const locales = j.persistido && supabase
      ? j.eventos.filter((e) => e.t === 'trafico' || e.t === 'hora_pico')
      : j.eventos;
    if (locales.length) {
      aplicarEventos(locales);
      getCanal()?.postMessage(locales);
    }
    return j;
  } catch {
    return null;
  }
}

/** Escucha eventos de otras pestañas (ej. el botón secreto de /demo). Úsalo una vez por página. */
export function useCanalLocal() {
  useEffect(() => {
    const c = getCanal();
    if (!c) return;
    const on = (m: MessageEvent<EventoCiudad[]>) => { if (Array.isArray(m.data)) aplicarEventos(m.data); };
    c.addEventListener('message', on);
    return () => c.removeEventListener('message', on);
  }, []);
}
