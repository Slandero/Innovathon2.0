'use client';
/** Obras viales activas: se cargan de /data/obras.json y viven aparte de los incidentes (no se "limpian"). */
import { useEffect } from 'react';
import { traficoObras } from '@/lib/local/trafico';
import { useApp } from '@/lib/store';
import type { Incidente, Obra } from '@/lib/types';

/** Id negativo estable para usar la obra donde se esperan incidentes (ruteo, alertas). */
export const idIncidenteObra = (i: number) => -(i + 1);

export function obraComoIncidente(o: Obra, i: number): Incidente {
  return {
    id: idIncidenteObra(i), tipo: 'obra', descripcion: o.afectacion, calle: o.calle,
    carril_bloqueado: o.carriles?.cerrados ?? [], carriles_totales: o.carriles?.total ?? 3,
    severidad: 3, retraso_min: o.impacto_min, votos: null, origen: 'obra_municipal', estado: 'activo',
    inicio: o.inicio ? `${o.inicio}T07:00:00-06:00` : new Date().toISOString(), lat: o.lat, lng: o.lng,
  };
}

/** Incidentes + obras, para todo lo que decide rutas o avisa en el camino. */
export function incidentesYObras(s: { incidentes: Incidente[]; obras: Obra[] }): Incidente[] {
  return s.obras.length ? [...s.incidentes, ...s.obras.map(obraComoIncidente)] : s.incidentes;
}

export const obraPorIncidente = (obras: Obra[], id: number) => (id < 0 ? obras[-id - 1] : undefined);

/** ¿Sigue vigente? (sin fecha de fin = en obra). */
export const obraVigente = (o: Obra, hoy = new Date()) => !o.fin || new Date(`${o.fin}T23:59:59-06:00`) >= hoy;

export function fechaCorta(iso: string | null): string {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00-06:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Chihuahua' }).replace('.', '');
}

export function useObras() {
  useEffect(() => {
    let vivo = true;
    fetch('/data/obras.json')
      .then((r) => r.json())
      .then((todas: Obra[]) => {
        if (!vivo) return;
        const obras = todas.filter((o) => obraVigente(o));
        useApp.getState().set({ obras });
        traficoObras(obras);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
}
