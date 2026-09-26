'use client';
/**
 * Ciudad simulada en el navegador cuando el motor de Python no está corriendo.
 * ~140 autos circulan por avenidas reales (los trazos de /data/rutas_camion.json), guardan
 * distancia con el de adelante, se detienen en semáforos en rojo (misma fórmula que el motor)
 * y hacen fila detrás de un incidente. Publica en el mismo formato que el motor (tick cada 1 s).
 */
import { useEffect } from 'react';
import { cargarInfra } from '@/lib/data/infra';
import { tickLocal, type TickAuto } from '@/lib/data/vivo';
import { estadoSemaforo } from '@/lib/map/semaforos';
import { useApp } from '@/lib/store';
import type { Obra, RutaCamion } from '@/lib/types';
import { traficoBase } from './trafico';

const N_AUTOS = 140;
const GAP = 9; // m al auto de adelante
const TICK_MS = 1000;
const FILA = 9; // autos que se forman detrás de un incidente nuevo
const AUTOS_CORREDOR = 14; // por corredor de obra
const VEL_OBRA = 7 / 3.6; // m/s dentro de la zona de obra

type P = [number, number];
interface Camino { pts: P[]; cum: number[]; largo: number; semaforos: { osm: number; s: number }[]; lentas: [number, number][] }
interface Auto { id: number; c: number; s: number; v: number; vmax: number }

const KX = 97_700; // m por grado de longitud a 28.6° N
const KY = 110_900;
const dist = (a: P, b: P) => Math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY);

function camino(coords: number[][]): Camino {
  const pts = coords as P[];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return { pts, cum, largo: cum[cum.length - 1], semaforos: [], lentas: [] };
}

/** Punto y rumbo a `s` metros sobre el camino (circular). */
function puntoEn(c: Camino, s: number): { p: P; h: number } {
  s = ((s % c.largo) + c.largo) % c.largo;
  let lo = 0, hi = c.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c.cum[m] <= s) lo = m; else hi = m; }
  const a = c.pts[lo], b = c.pts[hi];
  const f = (s - c.cum[lo]) / Math.max(1e-6, c.cum[hi] - c.cum[lo]);
  const h = (Math.atan2((b[0] - a[0]) * KX, (b[1] - a[1]) * KY) * 180) / Math.PI;
  return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], h: (h + 360) % 360 };
}

/** Posición (m desde el inicio) del punto del camino más cercano a `q`, si está a < `max` m. */
function proyectar(c: Camino, q: P, max: number): number | null {
  let mejor: number | null = null, dMin = max;
  for (let i = 1; i < c.pts.length; i++) {
    const a = c.pts[i - 1], b = c.pts[i];
    const ax = (q[0] - a[0]) * KX, ay = (q[1] - a[1]) * KY;
    const bx = (b[0] - a[0]) * KX, by = (b[1] - a[1]) * KY;
    const l2 = bx * bx + by * by || 1e-6;
    const t = Math.max(0, Math.min(1, (ax * bx + ay * by) / l2));
    const d = Math.hypot(ax - bx * t, ay - by * t);
    if (d < dMin) { dMin = d; mejor = c.cum[i - 1] + t * Math.sqrt(l2); }
  }
  return mejor;
}

/** Distancia hacia adelante de `desde` a `hasta` en un camino circular. */
const adelante = (c: Camino, desde: number, hasta: number) => ((hasta - desde) % c.largo + c.largo) % c.largo;

export function useCiudadLocal() {
  useEffect(() => {
    let vivo = true;
    let intervalo: ReturnType<typeof setInterval> | undefined;
    let traficoT: ReturnType<typeof setInterval> | undefined;

    const arrancar = async () => {
      if (!vivo || useApp.getState().motorVivo) return;
      let rutas: RutaCamion[] = [];
      try { rutas = await (await fetch('/data/rutas_camion.json')).json(); } catch { return; }
      const infra = await cargarInfra().catch(() => null);
      if (!vivo || !rutas.length || useApp.getState().motorVivo) return;

      // Corredores que pasan por las obras (tráfico lento y filas en la zona de obra)
      let obras: Obra[] = [];
      try { obras = await (await fetch('/data/obras.json')).json(); } catch { /* sin obras */ }
      const caminos = [...rutas.map((r) => camino(r.trazo.coordinates)), ...obras.flatMap((o) => o.corredores.map((g) => camino(g.coordinates)))];
      const nRutas = rutas.length;
      const semaforos = (infra?.features || []).filter((f) => f.properties.tipo === 'semaforo');
      for (const c of caminos) {
        const lngs = c.pts.map((p) => p[0]), lats = c.pts.map((p) => p[1]);
        const [w, e, s, n] = [Math.min(...lngs) - 0.002, Math.max(...lngs) + 0.002, Math.min(...lats) - 0.002, Math.max(...lats) + 0.002];
        for (const f of semaforos) {
          const q = f.geometry.coordinates as P;
          if (q[0] < w || q[0] > e || q[1] < s || q[1] > n) continue;
          const pos = proyectar(c, q, 14);
          if (pos != null) c.semaforos.push({ osm: f.properties.osm_id, s: pos });
        }
        c.semaforos.sort((a, b) => a.s - b.s);
        // zona de obra: desde 300 m antes hasta 80 m después, a vuelta de rueda
        for (const o of obras) {
          const pos = proyectar(c, [o.lng, o.lat], 60);
          if (pos != null) c.lentas.push([pos - 300, pos + 80]);
        }
      }

      // Autos repartidos según el largo de cada camino
      const total = caminos.slice(0, nRutas).reduce((a, c) => a + c.largo, 0);
      const autos: Auto[] = [];
      let id = 1;
      caminos.forEach((c, ci) => {
        const n = ci >= nRutas ? AUTOS_CORREDOR : Math.max(4, Math.round((N_AUTOS * c.largo) / total));
        for (let k = 0; k < n; k++) {
          const vmax = (38 + Math.random() * 22) / 3.6;
          autos.push({ id: id++, c: ci, s: (c.largo / n) * k + Math.random() * 40, v: vmax * 0.8, vmax });
        }
      });

      const vistos = new Set<number>(useApp.getState().incidentes.map((i) => i.id));
      useApp.getState().set({ simLocal: true });
      traficoBase(true);
      traficoT = setInterval(() => { if (!useApp.getState().motorVivo) traficoBase(true); }, 20_000);

      const paso = () => {
        const st = useApp.getState();
        if (st.motorVivo) { // llegó el motor real: le cedemos la ciudad
          clearInterval(intervalo); clearInterval(traficoT);
          st.set({ simLocal: false });
          return;
        }
        const dt = TICK_MS / 1000;
        const ahora = Date.now();
        // incidentes activos proyectados sobre cada camino
        const activos = st.incidentes.filter((i) => i.estado === 'activo');
        const bloqueos = caminos.map((c) => activos
          .map((i) => proyectar(c, [i.lng, i.lat], 30))
          .filter((x): x is number => x != null));
        // Incidente nuevo: mete una fila de autos detrás para que se vea al instante (como el motor)
        for (const inc of activos) {
          if (vistos.has(inc.id)) continue;
          vistos.add(inc.id);
          caminos.forEach((c, ci) => {
            const b = proyectar(c, [inc.lng, inc.lat], 30);
            if (b == null) return;
            for (let k = 0; k < FILA; k++) {
              const vmax = (38 + Math.random() * 22) / 3.6;
              autos.push({ id: id++, c: ci, s: (b - 6 - k * (GAP + 1) + c.largo) % c.largo, v: 0, vmax });
            }
          });
        }

        const out: TickAuto[] = [];
        caminos.forEach((c, ci) => {
          const propios = autos.filter((a) => a.c === ci).sort((a, b) => a.s - b.s);
          for (let k = propios.length - 1; k >= 0; k--) {
            const a = propios[k];
            const lider = propios[(k + 1) % propios.length];
            let libre = lider === a ? Infinity : adelante(c, a.s, lider.s) - GAP;
            // semáforo en rojo o ámbar a menos de 60 m
            for (const sem of c.semaforos) {
              const d = adelante(c, a.s, sem.s);
              if (d > 60) continue;
              if (d > 2 && estadoSemaforo(sem.osm, ahora, st.overrides[sem.osm]) !== 'verde') libre = Math.min(libre, d - 3);
            }
            // fila detrás del incidente
            for (const b of bloqueos[ci]) {
              const d = adelante(c, a.s, b);
              if (d < 120) libre = Math.min(libre, d - 6);
            }
            let tope = a.vmax;
            for (const [ini, fin] of c.lentas) {
              if (adelante(c, ini, a.s) <= fin - ini) tope = Math.min(tope, VEL_OBRA);
            }
            const deseada = Math.min(tope, a.v + 2.5 * dt);
            const avance = Math.max(0, Math.min(deseada * dt, libre));
            a.v = avance / dt;
            a.s = (a.s + avance) % c.largo;
            const { p, h } = puntoEn(c, a.s);
            out.push([a.id, p[1], p[0], Math.round(a.v * 3.6), Math.round(h)]);
          }
        });
        tickLocal(out);
      };
      paso();
      intervalo = setInterval(paso, TICK_MS);
    };

    // Espera a ver si el motor real manda ticks antes de simular
    const t = setTimeout(arrancar, 5000);
    return () => {
      vivo = false;
      clearTimeout(t);
      if (intervalo) clearInterval(intervalo);
      if (traficoT) clearInterval(traficoT);
    };
  }, []);
}
