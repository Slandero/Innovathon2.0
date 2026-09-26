'use client';
import { CENTRO_CUU } from '@/lib/config';
import { volarA } from '@/lib/map/instancia';
import { useApp } from '@/lib/store';
import { Icon } from './ui/Icon';

/** SOS (rojo, izquierda) · centrar en mí + Reportar (naranja, derecha). */
export function FloatingButtons({ bottom }: { bottom: number }) {
  const set = useApp((s) => s.set);
  const toast = useApp((s) => s.toast);
  const centrar = () => {
    const u = useApp.getState().ubicacion;
    if (u) volarA(u.lng, u.lat, 16);
    else {
      volarA(CENTRO_CUU.lng, CENTRO_CUU.lat, 13);
      toast({ tipo: 'info', titulo: 'Activa tu ubicación para rutas' });
    }
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20 mx-auto flex w-full max-w-[480px] items-end justify-between px-3 transition-[bottom] duration-300" style={{ bottom }}>
      <button
        aria-label="SOS emergencia"
        onClick={() => set({ flujo: 'sos' })}
        className="pointer-events-auto flex h-[60px] w-[60px] items-center justify-center rounded-full border-[3px] border-white bg-sos text-[17px] font-extrabold tracking-[0.5px] text-white shadow-[0_6px_18px_rgba(229,37,42,.4)] active:scale-95"
      >
        SOS
      </button>
      <div className="flex flex-col items-end gap-3">
        <button
          aria-label="Centrar en mí"
          onClick={centrar}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary shadow-[0_4px_16px_rgba(0,0,0,.12)] active:scale-95"
        >
          <Icon name="my_location" fill />
        </button>
        <button
          onClick={() => set({ flujo: 'reportar' })}
          className="pointer-events-auto flex h-14 items-center gap-2 rounded-full bg-futuro pl-4 pr-5 text-base font-bold text-white shadow-[0_6px_18px_rgba(124,92,255,.4)] active:scale-95"
        >
          <Icon name="add_a_photo" fill /> Reportar
        </button>
      </div>
    </div>
  );
}
