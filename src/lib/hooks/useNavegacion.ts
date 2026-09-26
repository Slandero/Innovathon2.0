'use client';
/**
 * Modo navegación (18.5) + "Simular viaje": el punto recorre la ruta a 40 km/h,
 * espera el verde en semáforos en rojo, se detiene 2 s en altos y baja a 10 km/h en topes.
 */
import { useEffect } from 'react';
import { along, bearing, length, lineString, nearestPointOnLine, point } from '@turf/turf';
import { comoLlegar, hablar } from '@/lib/acciones';
import { getMapa } from '@/lib/map/instancia';
import { estadoSemaforo, segundosParaVerde } from '@/lib/map/semaforos';
import { useApp } from '@/lib/store';
import type { AlertaRuta } from '@/lib/types';
import { create } from 'zustand';

export interface InfoNav {
  instruccion: string;
  calle: string;
  tipo: string;
  modificador?: string;
  distPaso: number; // m a la próxima maniobra
  aviso: string | null; // "Semáforo en rojo a 150 m"
  avisoTipo: AlertaRuta['tipo'] | null;
  restanteM: number;
  restanteS: number;
  velKmh: number;
  esperando: string | null; // "Esperando el verde · 12 s"
  llegaste: boolean;
}

export const useNav = create<{ info: InfoNav | null; set: (i: InfoNav | null) => void }>((set) => ({
  info: null,
  set: (info) => set({ info }),
}));

const VEL_BASE = 40 / 3.6; // m/s
const ACEL = 2.5; // m/s²
const FRENO = 3.5; // m/s²

function textoAviso(a: AlertaRuta, m: number, estadoSem?: string): string {
  const d = m < 30 ? '' : ` a ${Math.round(m / 10) * 10} m`;
  switch (a.tipo) {
    case 'semaforo': return `Semáforo en ${estadoSem === 'verde' ? 'verde' : estadoSem === 'ambar' ? 'ámbar' : 'rojo'}${d}`;
    case 'alto': return `Alto${d}`;
    case 'tope': return `Tope${d}`;
    case 'cruce': return `Cruce peatonal${d}`;
    case 'zona_escolar': return `Aguas: zona escolar${d} · máx. 20`;
    case 'incidente': return `${a.titulo}${d}`;
    case 'reporte': return `${a.titulo}${d}`;
    default: return a.titulo;
  }
}

export function useNavegacion() {
  const navegando = useApp((s) => s.navegando);
  const simulando = useApp((s) => s.simulando);
  const rutaSel = useApp((s) => s.rutaSel);
  const rutas = useApp((s) => s.rutas);

  useEffect(() => {
    const ruta = rutas[rutaSel];
    if (!navegando || !ruta) {
      useNav.getState().set(null);
      return;
    }
    const ls = lineString(ruta.geometry.coordinates);
    const total = length(ls, { units: 'meters' });
    const factorTiempo = ruta.duracion / Math.max(1, total); // s por metro según el ruteador
    let dist = 0; // m recorridos (simulación)
    let vel = 0;
    let ultimo = performance.now();
    let raf = 0;
    let altoHasta = 0;
    const altosHechos = new Set<number>();
    const dichos = new Set<string>();
    let ultimoRecalculo = 0;
    let pasoDicho = -1;
    let frame = 0;
    hablar(simulando ? 'Iniciando viaje simulado.' : 'Vámonos. Sigue la ruta azul.');

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - ultimo) / 1000);
      ultimo = t;
      const s = useApp.getState();
      const mult = s.velSim;
      const alertas = s.alertas;
      let esperando: string | null = null;

      let pos: [number, number];
      let hdg: number;
      if (simulando) {
        // ── Velocidad objetivo según lo que viene adelante
        let objetivo = VEL_BASE;
        const ahora = Date.now();
        for (const a of alertas) {
          const am = a.km * 1000 - dist;
          if (am < -25 || am > 120) continue;
          if (a.tipo === 'tope' && am < 25 && am > -8) objetivo = Math.min(objetivo, 10 / 3.6);
          if (a.tipo === 'zona_escolar' && am < 150 && am > -150) objetivo = Math.min(objetivo, 20 / 3.6);
          const parar = am - 6; // se detiene 6 m antes
          if (parar < -2) continue;
          if (a.tipo === 'semaforo' && a.osm_id != null) {
            const e = estadoSemaforo(a.osm_id, ahora, s.overrides[a.osm_id]);
            if (e !== 'verde' && !(e === 'ambar' && parar < 8)) {
              objetivo = Math.min(objetivo, frenar(parar));
              if (parar < 3) esperando = `Esperando el verde · ${segundosParaVerde(a.osm_id, ahora, s.overrides[a.osm_id])} s`;
            }
          }
          if (a.tipo === 'alto' && !altosHechos.has(a.km)) {
            objetivo = Math.min(objetivo, frenar(parar));
            if (parar < 1.5 && vel < 0.6) {
              if (!altoHasta) altoHasta = performance.now() + 2000 / mult;
              esperando = 'Alto total · 2 s';
              if (performance.now() >= altoHasta) { altosHechos.add(a.km); altoHasta = 0; }
            }
          }
        }
        vel = vel < objetivo ? Math.min(objetivo, vel + ACEL * dt * mult) : Math.max(objetivo, vel - FRENO * 1.6 * dt * mult);
        if (parar0(vel)) vel = 0;
        dist = Math.min(total, dist + vel * dt * mult);
        const p = along(ls, dist / 1000, { units: 'kilometers' }).geometry.coordinates as [number, number];
        const q = along(ls, Math.min(total, dist + 12) / 1000, { units: 'kilometers' }).geometry.coordinates as [number, number];
        pos = p;
        hdg = dist >= total - 1 ? s.posSim?.heading ?? 0 : bearing(point(p), point(q));
        s.set({ posSim: { lng: p[0], lat: p[1], heading: hdg } });
      } else {
        const u = s.ubicacion;
        if (!u) return;
        const np = nearestPointOnLine(ls, point([u.lng, u.lat]), { units: 'meters' });
        dist = (np.properties.location ?? 0);
        vel = VEL_BASE;
        pos = [u.lng, u.lat];
        hdg = u.heading ?? 0;
        // Fuera de ruta > 40 m → recalcula (máx. cada 10 s)
        if ((np.properties.dist ?? 0) > 40 && t - ultimoRecalculo > 10000) {
          ultimoRecalculo = t;
          hablar('Recalculando ruta.');
          comoLlegar();
        }
      }

      // ── Cámara siguiendo al usuario
      const m = getMapa();
      m?.jumpTo({ center: pos, bearing: hdg, pitch: 55, zoom: 17 });

      frame++;
      if (frame % 4 !== 0 && simulando) return; // HUD a ~15 fps

      // ── Maniobra siguiente
      const pasos = ruta.pasos;
      let idx = pasos.findIndex((p) => (p.kmEnRuta ?? 0) * 1000 > dist + 5);
      if (idx === -1) idx = pasos.length - 1;
      const paso = pasos[idx];
      const distPaso = Math.max(0, (paso.kmEnRuta ?? 0) * 1000 - dist);
      if (distPaso < 160 && pasoDicho !== idx && paso.tipo !== 'arrive') {
        pasoDicho = idx;
        hablar(`En ${Math.round(distPaso / 10) * 10} metros, ${paso.instruccion.toLowerCase()}`);
      }

      // ── Próxima alerta y avisos de voz
      let aviso: string | null = null;
      let avisoTipo: AlertaRuta['tipo'] | null = null;
      for (const a of alertas) {
        const am = a.km * 1000 - dist;
        if (am < -5 || am > 350) continue;
        if (a.tipo === 'cruce' && am > 60) continue;
        const e = a.tipo === 'semaforo' && a.osm_id != null ? estadoSemaforo(a.osm_id, Date.now(), s.overrides[a.osm_id]) : undefined;
        aviso = textoAviso(a, am, e);
        avisoTipo = a.tipo;
        const clave = `${a.tipo}-${a.km}`;
        if (!dichos.has(clave)) {
          if (a.tipo === 'tope' && am <= 100) { dichos.add(clave); hablar('Tope a 100 metros'); }
          else if (a.tipo === 'semaforo' && am <= 150 && e === 'rojo') { dichos.add(clave); hablar('Semáforo en rojo adelante'); }
          else if (a.tipo === 'alto' && am <= 80) { dichos.add(clave); hablar('Alto adelante'); }
          else if (a.tipo === 'zona_escolar' && am <= 200) { dichos.add(clave); hablar('Aguas, zona escolar activa. Máximo 20.'); }
          else if (a.tipo === 'incidente' && am <= 350) { dichos.add(clave); hablar(`Cuidado: ${a.titulo} adelante`); }
        }
        break;
      }

      const restanteM = Math.max(0, total - dist);
      const llegaste = restanteM < 12;
      if (llegaste && !dichos.has('fin')) {
        dichos.add('fin');
        hablar('Llegaste a tu destino.');
      }
      useNav.getState().set({
        instruccion: llegaste ? 'Llegaste a tu destino' : paso.instruccion,
        calle: llegaste ? '' : paso.calle,
        tipo: llegaste ? 'arrive' : paso.tipo,
        modificador: paso.modificador,
        distPaso,
        aviso: llegaste ? null : aviso,
        avisoTipo,
        restanteM,
        restanteS: restanteM * factorTiempo,
        velKmh: Math.round(vel * 3.6),
        esperando,
        llegaste,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) speechSynthesis.cancel();
    };
    // la ruta seleccionada cambia al recalcular: reinicia el recorrido
  }, [navegando, simulando, rutaSel, rutas]);
}

const parar0 = (v: number) => v < 0.05;
/** Velocidad máxima para detenerse a `m` metros (0 si ya llegó a la línea). */
const frenar = (m: number) => (m < 1 ? 0 : Math.sqrt(2 * FRENO * (m - 1)));
