'use client';
/**
 * Datos en vivo: canal Broadcast `city-live` del motor + tablas por Postgres Changes.
 * Los autos NO pasan por React (se interpolan en requestAnimationFrame dentro del mapa).
 */
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { getMapa, setDatos } from '@/lib/map/instancia';
import { TOAST_POR_ALERTA } from '@/lib/eventos';
import type { AlertaN8n, Camion, Emergencia, Incidente, Reporte, RutaCamion } from '@/lib/types';

// [id, lat, lng, vel, heading]
export type TickAuto = [number, number, number, number, number];

export const autos = {
  prev: new Map<number, [number, number, number]>(), // id → [lng, lat, heading]
  next: new Map<number, [number, number, number, number]>(), // id → [lng, lat, heading, vel]
  tNext: 0,
  dt: 1000,
};

export const ambulanciasVivas = { lista: [] as [number, number, number][] };

function onTick(p: { vehiculos?: TickAuto[]; ambulancias?: [number, number, number][] }, local = false) {
  const ahora = performance.now();
  const f = autos.tNext ? Math.min(1, (ahora - autos.tNext) / autos.dt) : 1;
  const prev = new Map<number, [number, number, number]>();
  // la posición interpolada actual se vuelve el nuevo origen: sin saltos
  for (const [id, n] of autos.next) {
    const p0 = autos.prev.get(id);
    prev.set(id, p0 ? [p0[0] + (n[0] - p0[0]) * f, p0[1] + (n[1] - p0[1]) * f, n[2]] : [n[0], n[1], n[2]]);
  }
  const next = new Map<number, [number, number, number, number]>();
  for (const [id, lat, lng, vel, hdg] of p.vehiculos || []) next.set(id, [lng, lat, hdg, vel]);
  if (autos.tNext) autos.dt = Math.max(500, Math.min(3000, ahora - autos.tNext));
  autos.prev = prev;
  autos.next = next;
  autos.tNext = ahora;
  const s = useApp.getState();
  if (local) {
    if (s.nVehiculos !== next.size) s.set({ nVehiculos: next.size });
    return;
  }
  ambulanciasVivas.lista = p.ambulancias || [];
  if (s.nVehiculos !== next.size || !s.motorVivo) s.set({ nVehiculos: next.size, motorVivo: true, simLocal: false });
}

/** Tick de la simulación local (sin motor): mismo formato, sin marcar el motor como vivo. */
export const tickLocal = (vehiculos: TickAuto[]) => onTick({ vehiculos }, true);

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') (window as unknown as { __autos: typeof autos }).__autos = autos;

/** Nivel de tráfico por tramo (geometría fija en /data/tramos.geojson). */
export const traficoVivo = { niveles: new Map<number, number>(), aplicados: new Map<number, number>() };

/** Pinta niveles con feature-state (sin recrear la capa). Se llama al llegar datos y al cargar la fuente. */
export function aplicarTrafico() {
  const m = getMapa();
  if (!m || !m.getSource('trafico')) return;
  for (const [id, n] of traficoVivo.niveles) {
    if (traficoVivo.aplicados.get(id) === n) continue;
    try {
      m.setFeatureState({ source: 'trafico', id }, { n });
      traficoVivo.aplicados.set(id, n);
    } catch { /* fuente aún sin datos */ }
  }
}

function onTrafico(p: { n?: [number, number][] }) {
  for (const [id, n] of p.n || []) traficoVivo.niveles.set(id, n);
  aplicarTrafico();
}

export const celdasVivas: { fc: GeoJSON.FeatureCollection } = { fc: { type: 'FeatureCollection', features: [] } };

function onCeldas(p: { o?: [number, number, number, number]; c?: [number, number, number, number, number][] }) {
  if (!p.o || !p.c) return;
  const [lng0, lat0, dlng, dlat] = p.o;
  celdasVivas.fc = {
    type: 'FeatureCollection',
    features: p.c.map(([i, j, vel, n, anomalia]) => {
      const x = lng0 + i * dlng;
      const y = lat0 + j * dlat;
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[x, y], [x + dlng, y], [x + dlng, y + dlat], [x, y + dlat], [x, y]]] },
        properties: { vel, n, anomalia: anomalia === 1 },
      };
    }),
  };
  setDatos('celdas', celdasVivas.fc);
}


function upsert<T extends { id: number | string }>(lista: T[], fila: T): T[] {
  const i = lista.findIndex((x) => x.id === fila.id);
  if (i === -1) return [fila, ...lista];
  const copia = lista.slice();
  copia[i] = fila;
  return copia;
}

/** Hook único que conecta toda la app a Supabase. Úsalo una sola vez en la página. */
export function useDatosVivos() {
  useEffect(() => {
    const { set } = useApp.getState();

    // Clima (Open-Meteo, sin llave)
    fetch('https://api.open-meteo.com/v1/forecast?latitude=28.635&longitude=-106.089&current=temperature_2m')
      .then((r) => r.json())
      .then((j) => set({ temperatura: Math.round(j.current.temperature_2m) }))
      .catch(() => {});

    if (!supabase) return;
    const sb = supabase;
    let vivo = true;
    let ultimoTick = 0;

    // ── Carga inicial
    const hace48h = new Date(Date.now() - 48 * 3600e3).toISOString();
    Promise.all([
      sb.from('incidentes').select('*').eq('estado', 'activo').order('inicio', { ascending: false }).limit(100),
      sb.from('reportes').select('*').neq('estado', 'resuelto').gte('created_at', hace48h).order('created_at', { ascending: false }).limit(300),
      sb.from('alertas').select('*').order('created_at', { ascending: false }).limit(30),
      sb.from('overrides_semaforo').select('*').gt('expira', new Date().toISOString()),
      sb.from('rutas_camion').select('*'),
      sb.from('camiones').select('*'),
      sb.from('sim_control').select('*').eq('id', 1).maybeSingle(),
      sb.from('emergencias').select('*').in('estado', ['solicitada', 'en_camino']).order('created_at', { ascending: false }).limit(1),
    ]).then(([inc, rep, al, ov, rc, ca, sc, em]) => {
      if (!vivo) return;
      const overrides: Record<number, { estado: 'verde' | 'rojo'; expira: number }> = {};
      for (const o of (ov.data || []) as { osm_id: number; estado: 'verde' | 'rojo'; expira: string }[]) {
        overrides[o.osm_id] = { estado: o.estado, expira: Date.parse(o.expira) };
      }
      const camiones: Record<string, Camion> = {};
      for (const c of (ca.data || []) as Camion[]) camiones[c.id] = c;
      set({
        incidentes: (inc.data || []) as Incidente[],
        reportes: (rep.data || []) as Reporte[],
        alertasN8n: (al.data || []) as AlertaN8n[],
        overrides,
        rutasCamion: (rc.data || []) as RutaCamion[],
        camiones,
        forzarZonas: Boolean((sc.data as { forzar_zonas?: boolean } | null)?.forzar_zonas),
        emergencia: ((em.data || [])[0] as Emergencia) || useApp.getState().emergencia,
      });
    });

    // ── Motor de ciudad (Broadcast)
    const canalCiudad = sb
      .channel('city-live')
      .on('broadcast', { event: 'tick' }, ({ payload }) => { ultimoTick = Date.now(); onTick(payload); })
      .on('broadcast', { event: 'trafico' }, ({ payload }) => onTrafico(payload))
      .on('broadcast', { event: 'celdas' }, ({ payload }) => onCeldas(payload))
      .subscribe();

    // ── Tablas (Postgres Changes)
    const canalDb = sb
      .channel('db-vivecuu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidentes' }, ({ new: fila, eventType, old }) => {
        const s = useApp.getState();
        if (eventType === 'DELETE') return s.set({ incidentes: s.incidentes.filter((i) => i.id !== (old as { id: number }).id) });
        const inc = fila as Incidente;
        const lista = inc.estado === 'activo' ? upsert(s.incidentes, inc) : s.incidentes.filter((i) => i.id !== inc.id);
        s.set({ incidentes: lista });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes' }, ({ new: fila, eventType, old }) => {
        const s = useApp.getState();
        if (eventType === 'DELETE') return s.set({ reportes: s.reportes.filter((r) => r.id !== (old as { id: number }).id) });
        s.set({ reportes: upsert(s.reportes, fila as Reporte) });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas' }, ({ new: fila }) => {
        const a = fila as AlertaN8n;
        const s = useApp.getState();
        s.set({ alertasN8n: [a, ...s.alertasN8n].slice(0, 50) });
        s.toast({ tipo: TOAST_POR_ALERTA[a.tipo], titulo: a.titulo || 'Alerta', texto: a.mensaje || undefined });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overrides_semaforo' }, ({ new: fila, eventType, old }) => {
        const s = useApp.getState();
        const overrides = { ...s.overrides };
        if (eventType === 'DELETE') delete overrides[(old as { osm_id: number }).osm_id];
        else {
          const o = fila as { osm_id: number; estado: 'verde' | 'rojo'; expira: string };
          overrides[o.osm_id] = { estado: o.estado, expira: Date.parse(o.expira) };
        }
        s.set({ overrides });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'camiones' }, ({ new: fila, eventType }) => {
        if (eventType === 'DELETE') return;
        const c = fila as Camion;
        const s = useApp.getState();
        s.set({ camiones: { ...s.camiones, [c.id]: c } });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergencias' }, ({ new: fila, eventType }) => {
        const e = fila as Emergencia;
        const s = useApp.getState();
        const activa = s.emergencia && (s.emergencia.estado === 'solicitada' || s.emergencia.estado === 'en_camino');
        // la propia, o una nueva (ej. SOS de prueba de /demo) si no hay otra en curso
        if (s.emergencia?.id === e.id || (eventType === 'INSERT' && !activa)) s.set({ emergencia: e });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_control' }, ({ new: fila }) => {
        useApp.getState().set({ forzarZonas: Boolean((fila as { forzar_zonas?: boolean }).forzar_zonas) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rutas_camion' }, () => {
        sb.from('rutas_camion').select('*').then(({ data }) => useApp.getState().set({ rutasCamion: (data || []) as RutaCamion[] }));
      })
      .subscribe();

    // Si el motor deja de mandar ticks, lo marcamos como apagado
    const vigia = setInterval(() => {
      const s = useApp.getState();
      if (s.motorVivo && Date.now() - ultimoTick > 6000) {
        autos.next.clear();
        autos.prev.clear();
        traficoVivo.niveles.clear();
        const m = getMapa();
        for (const id of traficoVivo.aplicados.keys()) {
          try { m?.setFeatureState({ source: 'trafico', id }, { n: null }); } catch { /* */ }
        }
        traficoVivo.aplicados.clear();
        setDatos('celdas', { type: 'FeatureCollection', features: [] });
        s.set({ motorVivo: false, nVehiculos: 0 });
      }
    }, 3000);

    return () => {
      vivo = false;
      clearInterval(vigia);
      sb.removeChannel(canalCiudad);
      sb.removeChannel(canalDb);
    };
  }, []);
}
