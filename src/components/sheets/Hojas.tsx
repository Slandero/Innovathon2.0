'use client';
import { useEffect } from 'react';
import { useApp } from '@/lib/store';
import { CamionSheet } from './CamionSheet';
import { IncidenteSheet } from './IncidenteSheet';
import { ReporteSheet } from './ReporteSheet';
import { ObraSheet } from './ObraSheet';
import { obraPorIncidente } from '@/lib/data/obras';

/** Hojas inferiores de detalle (camión, incidente, reporte) según lo que se tocó en el mapa. */
export function Hojas() {
  const hoja = useApp((s) => s.hoja);
  const set = useApp((s) => s.set);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') set({ hoja: null }); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [set]);
  if (!hoja) return null;
  if (hoja.tipo === 'camion') return <CamionSheet id={hoja.id} />;
  if (hoja.tipo === 'obra') return <ObraSheet id={hoja.id} />;
  if (hoja.tipo === 'incidente') {
    // las obras también viajan como incidentes con id negativo (ruteo, alertas)
    const obra = hoja.id < 0 ? obraPorIncidente(useApp.getState().obras, hoja.id) : undefined;
    return obra ? <ObraSheet id={obra.id} /> : <IncidenteSheet id={hoja.id} />;
  }
  return <ReporteSheet id={hoja.id} />;
}
