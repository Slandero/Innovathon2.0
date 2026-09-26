'use client';
import { useEffect, useRef } from 'react';
import { evitarIncidente, recalcularAlertas } from '@/lib/acciones';
import { useApp } from '@/lib/store';

/** Sin UI: recalcula alertas de la ruta y reacciona a incidentes nuevos sobre ella. */
export function RutaController() {
  const rutas = useApp((s) => s.rutas);
  const rutaSel = useApp((s) => s.rutaSel);
  const incidentes = useApp((s) => s.incidentes);
  const reportes = useApp((s) => s.reportes);
  const forzarZonas = useApp((s) => s.forzarZonas);
  const vistos = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (rutas.length) recalcularAlertas();
  }, [rutas, rutaSel, incidentes, reportes, forzarZonas]);

  // Incidente nuevo en la ruta activa → recalcular y avisar "Te cambié de ruta, +3 min"
  useEffect(() => {
    if (vistos.current === null) {
      vistos.current = new Set(incidentes.map((i) => i.id));
      return;
    }
    const nuevos = incidentes.filter((i) => !vistos.current!.has(i.id));
    for (const i of incidentes) vistos.current.add(i.id);
    if (!nuevos.length) return;
    if (useApp.getState().rutas.length) {
      (async () => {
        for (const inc of nuevos) if (await evitarIncidente(inc)) break;
      })();
    }
  }, [incidentes]);

  return null;
}
