'use client';
/**
 * Camiones de respaldo: si a los pocos segundos no llegaron rutas de Supabase, carga
 * /data/rutas_camion.json y mueve 2 unidades por ruta con sensores de conteo simulados
 * (mismas reglas que sim/camiones.py: paradas cada ~400 m, 18 s de espera, suben/bajan).
 */
import { useEffect } from 'react';
import { along, length, lineString } from '@turf/turf';
import { useApp } from '@/lib/store';
import type { Camion, RutaCamion } from '@/lib/types';

const UNIDADES = 2;
const CAPACIDAD = 80;
const VEL = 24 / 3.6; // m/s
const ESPERA = 18; // s en parada

interface Unidad { id: string; ruta: RutaCamion; linea: ReturnType<typeof lineString>; largo: number; s: number; esperaHasta: number; ocupacion: number; parada: number }

export function useCamionesLocal() {
  useEffect(() => {
    let vivo = true;
    let t: ReturnType<typeof setInterval> | undefined;
    const arranque = setTimeout(async () => {
      if (!vivo || useApp.getState().rutasCamion.length) return;
      let rutas: RutaCamion[] = [];
      try { rutas = await (await fetch('/data/rutas_camion.json')).json(); } catch { return; }
      if (!vivo || !rutas.length || useApp.getState().rutasCamion.length) return;

      const unidades: Unidad[] = rutas.flatMap((ruta) => {
        const linea = lineString(ruta.trazo.coordinates);
        const largo = length(linea, { units: 'meters' });
        return Array.from({ length: UNIDADES }, (_, n) => {
          const s = ((largo / UNIDADES) * n + Math.random() * 300) % largo;
          const parada = Math.max(0, ruta.paradas.findIndex((p) => p.km * 1000 > s));
          return {
            id: `${ruta.id}-${String(n + 1).padStart(2, '0')}`, ruta, linea, largo, s, esperaHasta: 0,
            ocupacion: 15 + Math.floor(Math.random() * 45), parada,
          };
        });
      });
      useApp.getState().set({ rutasCamion: rutas });

      let ultimo = performance.now();
      const paso = () => {
        const ahora = performance.now();
        const dt = Math.min(5, (ahora - ultimo) / 1000);
        ultimo = ahora;
        const camiones: Record<string, Camion> = {};
        for (const u of unidades) {
          const paradas = u.ruta.paradas;
          if (ahora >= u.esperaHasta) {
            const p = paradas[u.parada];
            const falta = p ? (p.km * 1000 - u.s + u.largo) % u.largo : Infinity;
            const avance = VEL * dt;
            u.s = (u.s + Math.min(avance, falta)) % u.largo;
            // llegó a la parada → se detiene, suben y bajan pasajeros
            if (p && avance >= falta) {
              const bajan = Math.min(u.ocupacion, Math.floor(Math.random() * 7));
              const suben = Math.floor(Math.random() * 9);
              u.ocupacion = Math.max(0, Math.min(CAPACIDAD, u.ocupacion - bajan + suben));
              u.esperaHasta = ahora + ESPERA * 1000;
              u.parada = (u.parada + 1) % paradas.length;
            }
          }
          const pt = along(u.linea, u.s / 1000, { units: 'kilometers' }).geometry.coordinates;
          const adelante = along(u.linea, Math.min(u.largo, u.s + 25) / 1000, { units: 'kilometers' }).geometry.coordinates;
          const heading = (Math.atan2((adelante[0] - pt[0]) * Math.cos((pt[1] * Math.PI) / 180), adelante[1] - pt[1]) * 180) / Math.PI;
          const prox = paradas[u.parada];
          const falta = prox ? ((prox.km * 1000 - u.s + u.largo) % u.largo) : 0;
          camiones[u.id] = {
            id: u.id, ruta_id: u.ruta.id, capacidad: CAPACIDAD, ocupacion: u.ocupacion,
            proxima_parada: prox?.nombre ?? null, eta_min: Math.max(1, Math.round(falta / VEL / 60 + (ahora < u.esperaHasta ? 0.3 : 0))),
            fuente: 'sim', lat: pt[1], lng: pt[0], heading: (heading + 360) % 360, updated_at: new Date().toISOString(),
          };
        }
        useApp.getState().set({ camiones });
      };
      paso();
      t = setInterval(paso, 3000);
    }, 4000);
    return () => { vivo = false; clearTimeout(arranque); if (t) clearInterval(t); };
  }, []);
}
