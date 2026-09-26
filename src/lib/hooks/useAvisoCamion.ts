'use client';
/** "Avísame cuando esté cerca": vigila la unidad y avisa (toast + voz + notificación) a ≤ 2 min de la parada. */
import { useEffect } from 'react';
import { hablar } from '@/lib/acciones';
import { proximasLlegadas } from '@/lib/data/camiones';
import { useApp } from '@/lib/store';

export function useAvisoCamion() {
  const aviso = useApp((s) => s.avisoCamion);
  useEffect(() => {
    if (!aviso) return;
    const revisar = () => {
      const s = useApp.getState();
      const ruta = s.rutasCamion.find((r) => r.id === aviso.rutaId);
      const c = s.camiones[aviso.camionId];
      const parada = ruta?.paradas.find((p) => p.nombre === aviso.parada);
      if (!ruta || !c || !parada) return;
      const eta = proximasLlegadas(ruta, parada, [c])[0]?.eta_min;
      if (eta == null || eta > 2) return;
      const nombre = ruta.nombre.split('·')[0].trim();
      const texto = `${nombre} llega en ${eta} min a ${parada.nombre}`;
      s.set({ avisoCamion: null });
      s.toast({ tipo: 'ok', titulo: `¡Ya viene tu camión!`, texto });
      hablar(`Ya viene tu camión. ${texto}.`);
      try {
        if ('Notification' in window && Notification.permission === 'granted') new Notification('ViveCUU · ¡Ya viene tu camión!', { body: texto, icon: '/icons/icon-192.png' });
      } catch { /* sin notificaciones */ }
    };
    revisar();
    const t = setInterval(revisar, 3000);
    return () => clearInterval(t);
  }, [aviso]);
}
