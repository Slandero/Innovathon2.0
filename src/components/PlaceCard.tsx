'use client';
import { useEffect, useState } from 'react';
import { comoLlegar, distanciaA, fmtDist, minutos, origenActual } from '@/lib/acciones';
import { trazarRutas } from '@/lib/map/mapbox';
import { useApp } from '@/lib/store';
import { BottomSheet } from './ui/BottomSheet';
import { Icon } from './ui/Icon';

/** Barra superior del lugar: regresar a la búsqueda · nombre · cerrar. */
export function PlaceTopBar() {
  const lugar = useApp((s) => s.lugar);
  const set = useApp((s) => s.set);
  if (!lugar) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto w-full max-w-[480px] px-3 pt-[max(12px,env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex h-[52px] items-center gap-3 rounded-full bg-white pl-3.5 pr-2 shadow-float">
        <button aria-label="Regresar a la búsqueda" onClick={() => set({ busquedaAbierta: true })} className="flex text-ink active:scale-95">
          <Icon name="arrow_back" />
        </button>
        <button onClick={() => set({ busquedaAbierta: true })} className="min-w-0 flex-1 truncate text-left text-base text-ink">{lugar.nombre}</button>
        <button aria-label="Cerrar" onClick={() => set({ lugar: null })} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-2 active:bg-surface">
          <Icon name="close" size={22} />
        </button>
      </div>
    </div>
  );
}

/** Tarjeta del lugar elegido: nombre, dirección, distancia, carro/camión y "Cómo llegar". */
export function PlaceCard() {
  const lugar = useApp((s) => s.lugar)!;
  const cargando = useApp((s) => s.cargandoRuta);
  const toast = useApp((s) => s.toast);
  const [autoMin, setAutoMin] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    setAutoMin(null);
    trazarRutas(origenActual(), [lugar.lng, lugar.lat]).then((r) => { if (vivo && r[0]) setAutoMin(minutos(r[0].duracion)); });
    return () => { vivo = false; };
  }, [lugar]);

  // Camión: estimación (caminar a la parada + esperar + recorrido más lento)
  const camionMin = autoMin != null ? Math.round(autoMin * 1.8 + 8) : null;

  const guardarCasa = () => {
    try { localStorage.setItem('vivecuu:casa', JSON.stringify({ ...lugar, nombre: 'Casa' })); } catch { /* */ }
    toast({ tipo: 'ok', titulo: 'Guardamos este lugar como Casa' });
  };

  return (
    <BottomSheet sinCerrar>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <h2 className="text-[22px] font-bold leading-tight tracking-[-0.3px] text-ink">{lugar.nombre}</h2>
          <p className="text-sm text-ink-2">{lugar.direccion || 'Chihuahua, Chih.'} · {fmtDist(distanciaA(lugar))}</p>
        </div>
        <div className="flex items-center gap-2.5 text-[15px] font-semibold text-ink">
          <span className="flex items-center gap-1.5"><Icon name="directions_car" size={20} fill className="text-primary" />{autoMin != null ? `${autoMin} min` : '…'}</span>
          <span className="text-ink-2">·</span>
          <span className="flex items-center gap-1.5"><Icon name="directions_bus" size={20} fill className="text-brand" />{camionMin != null ? `${camionMin} min` : '…'}</span>
          <button onClick={guardarCasa} className="ml-auto flex items-center gap-1 text-xs font-medium text-ink-2 active:text-primary">
            <Icon name="home" size={18} /> Guardar como casa
          </button>
        </div>
        <button
          onClick={() => comoLlegar()}
          disabled={cargando}
          className="mt-1 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-white active:scale-[.98] disabled:opacity-70"
        >
          <Icon name={cargando ? 'progress_activity' : 'directions'} size={22} fill className={cargando ? 'animate-spin' : ''} /> Cómo llegar
        </button>
      </div>
    </BottomSheet>
  );
}
