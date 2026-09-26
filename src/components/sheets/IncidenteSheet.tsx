'use client';
import { useState } from 'react';
import { nombreIncidente } from '@/lib/hechos';
import { llamarCiudad } from '@/lib/local/aplicar';
import { useApp } from '@/lib/store';
import { BottomSheet } from '../ui/BottomSheet';
import { Icon } from '../ui/Icon';

const ICONO: Record<string, string> = { accidente: 'car_crash', cierre: 'block', obra: 'construction', congestion: 'traffic_jam', peligro: 'warning' };
const ATIENDE: Record<string, string> = { accidente: 'Tránsito', cierre: 'Tránsito', congestion: 'Tránsito', obra: 'Obras Públicas', peligro: 'Protección Civil' };

/** Carriles vistos desde arriba; los bloqueados en rojo. */
export function Carriles({ total, bloqueados }: { total: number; bloqueados: number[] }) {
  return (
    <div className="grid h-[132px] flex-1 rounded-2xl bg-[#3C4148] px-2.5" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const b = bloqueados.includes(n);
        return (
          <div key={n} className={`flex flex-col items-center justify-around py-2.5 ${i < total - 1 ? 'border-r-2 border-dashed border-white' : ''} ${b ? 'bg-[rgba(229,37,42,.85)]' : ''}`}>
            <Icon name={b ? 'block' : 'arrow_upward'} size={b ? 24 : 22} fill className={b ? 'text-white' : 'text-[#D5DAE0]'} />
            <span className={`text-[11px] ${b ? 'font-extrabold text-white' : 'font-bold text-[#D5DAE0]'}`}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

/** B4 · hoja de incidente: carriles, retraso, quién atiende y votos. */
export function IncidenteSheet({ id }: { id: number }) {
  const inc = useApp((s) => s.incidentes.find((i) => i.id === id));
  const set = useApp((s) => s.set);
  const toast = useApp((s) => s.toast);
  const [votado, setVotado] = useState<'sigue' | 'ya_no' | null>(null);
  if (!inc) return null;
  const total = inc.carriles_totales || 3;
  const bloq = inc.carril_bloqueado || [];
  const minutos = Math.max(1, Math.round((Date.now() - Date.parse(inc.inicio)) / 60000));
  const libres = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !bloq.includes(n));
  const aviso = !bloq.length ? (inc.descripcion || 'Avanza lento, todos los carriles abiertos')
    : !libres.length ? 'Vía cerrada · busca otra ruta'
      : `Carril ${bloq.join(' y ')} cerrado${bloq.length > 1 ? 's' : ''} · usa ${libres.length === 1 ? `el ${libres[0]}` : `el ${libres.slice(0, -1).join(', ')} o el ${libres[libres.length - 1]}`}`;

  const votar = async (accion: 'sigue' | 'ya_no') => {
    setVotado(accion);
    const r = await llamarCiudad(`/api/incidente/${id}/voto`, { accion, votos: inc.votos ?? 1 });
    if (!r?.ok) { setVotado(null); toast({ tipo: 'info', titulo: 'No se pudo registrar tu voto' }); return; }
    toast({ tipo: 'ok', titulo: accion === 'sigue' ? 'Gracias, confirmaste que sigue ahí' : 'Gracias por avisar', texto: r.mensaje === 'resuelto' ? 'Lo quitamos del mapa.' : accion === 'ya_no' ? 'Si más gente lo confirma, lo quitamos del mapa.' : undefined });
    if (r.mensaje === 'resuelto') set({ hoja: null });
  };

  return (
    <BottomSheet sinCerrar>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-traffic-stop text-white">
            <Icon name={ICONO[inc.tipo] || 'warning'} size={26} fill />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[21px] font-bold leading-tight tracking-[-0.3px]">{nombreIncidente(inc.tipo)} · {inc.calle || 'en tu zona'}</h2>
            <p className="mt-0.5 text-[13px] text-ink-2">Hace {minutos} min{inc.origen ? ` · ${inc.origen === 'voz' ? 'reportado por voz' : inc.origen === 'reporte' ? 'reporte ciudadano' : inc.origen === 'anomalia_celda' ? 'detectado por sensores' : 'reportado'}` : ''}</p>
          </div>
          <button aria-label="Cerrar" onClick={() => set({ hoja: null })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface active:scale-95">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="flex items-stretch gap-3.5">
          <Carriles total={total} bloqueados={bloq} />
          <div className="flex w-[130px] flex-col gap-2.5">
            <div className="flex flex-1 flex-col justify-center rounded-[14px] bg-[#FCE8E6] px-3 py-2.5">
              <div className="text-[26px] font-extrabold leading-tight tracking-[-0.5px] text-traffic-stop">+{inc.retraso_min ?? '?'} min</div>
              <div className="text-xs text-[#8C1D18]">de retraso</div>
            </div>
            <div className="flex flex-1 flex-col justify-center rounded-[14px] bg-surface px-3 py-2.5">
              <div className="text-xs text-ink-2">Atiende:</div>
              <div className="text-[15px] font-bold">{ATIENDE[inc.tipo] || 'Tránsito'}</div>
            </div>
          </div>
        </div>

        <p className="text-[13px] text-ink-2">{aviso}</p>

        <div className="grid grid-cols-2 gap-2.5">
          <button disabled={votado != null} onClick={() => votar('sigue')}
            className="flex h-[52px] items-center justify-center gap-1.5 rounded-full bg-primary text-[15px] font-bold text-white active:scale-[.98] disabled:opacity-60">
            <Icon name="thumb_up" size={20} fill /> Sigue ahí ({inc.votos ?? 1})
          </button>
          <button disabled={votado != null} onClick={() => votar('ya_no')}
            className="flex h-[52px] items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#D5DAE0] text-[15px] font-bold text-ink active:scale-[.98] disabled:opacity-60">
            <Icon name="check_circle" size={20} /> Ya no está
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
