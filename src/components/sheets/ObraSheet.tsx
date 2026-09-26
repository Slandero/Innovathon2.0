'use client';
import { useEffect } from 'react';
import { fechaCorta } from '@/lib/data/obras';
import { encuadrar } from '@/lib/map/instancia';
import { useApp } from '@/lib/store';
import { BottomSheet } from '../ui/BottomSheet';
import { Icon } from '../ui/Icon';
import { Carriles } from './IncidenteSheet';

const ICONO_REC = ['construction', 'warning', 'schedule'];
const PADDING = { top: 150, bottom: 500, left: 40, right: 40 };

/** Hoja de una obra vial: qué está cerrado, hasta cuándo, desvíos oficiales y vías alternas. */
export function ObraSheet({ id }: { id: string }) {
  const o = useApp((s) => s.obras.find((x) => x.id === id));
  const desvio = useApp((s) => s.obraDesvio);
  const set = useApp((s) => s.set);

  useEffect(() => {
    if (!o) return;
    encuadrar([...o.cierre.coordinates, ...o.desvios.flatMap((d) => d.geometry.coordinates)], PADDING);
    return () => useApp.getState().set({ obraDesvio: null });
  }, [o]);
  if (!o) return null;

  const verDesvio = (i: number) => {
    const nuevo = desvio === i ? null : i;
    set({ obraDesvio: nuevo });
    encuadrar(nuevo == null ? o.cierre.coordinates : [...o.desvios[i].geometry.coordinates, ...o.cierre.coordinates], PADDING);
  };
  const periodo = o.inicio
    ? `Desde el ${fechaCorta(o.inicio)} · ${o.duracion}${o.fin ? ` (hasta ~${fechaCorta(o.fin)})` : ''}`
    : `En obra · ${o.motivo.toLowerCase()}`;

  return (
    <BottomSheet sinCerrar alto="55vh">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-traffic-heavy text-white">
            <Icon name="construction" size={26} fill />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[19px] font-bold leading-tight tracking-[-0.3px]">{o.nombre}</h2>
            <p className="mt-0.5 text-[13px] text-ink-2">{periodo}</p>
          </div>
          <button aria-label="Cerrar" onClick={() => set({ hoja: null })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface active:scale-95">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl bg-[#FCE8E6] px-3.5 py-3">
          <Icon name="block" size={22} fill className="text-traffic-stop" />
          <div className="text-sm">
            <div className="font-bold text-[#8C1D18]">{o.afectacion}</div>
            {o.sin_afectacion && <div className="mt-0.5 flex items-center gap-1 text-[#137333]"><Icon name="check_circle" size={16} fill />{o.sin_afectacion}</div>}
          </div>
        </div>

        <div className="flex items-stretch gap-3.5">
          {o.carriles
            ? <Carriles total={o.carriles.total} bloqueados={o.carriles.cerrados} />
            : (
              <div className="flex flex-1 flex-col justify-center gap-1 rounded-2xl bg-[#3C4148] p-3.5 text-white">
                <Icon name="engineering" size={26} fill className="text-traffic-mod" />
                <div className="text-sm font-bold">Cierre parcial</div>
                <div className="text-xs text-white/70">{o.motivo}</div>
              </div>
            )}
          <div className="flex w-[130px] flex-col gap-2.5">
            <div className="flex flex-1 flex-col justify-center rounded-[14px] bg-[#FFF0E0] px-3 py-2.5">
              <div className="text-[26px] font-extrabold leading-tight tracking-[-0.5px] text-[#B34700]">+{o.impacto_min} min</div>
              <div className="text-xs text-[#7A3E00]">en hora pico</div>
            </div>
            <div className="flex flex-1 flex-col justify-center rounded-[14px] bg-surface px-3 py-2.5">
              <div className="text-xs text-ink-2">Obra de:</div>
              <div className="text-[15px] font-bold">Municipio</div>
            </div>
          </div>
        </div>

        {o.desvios.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-bold tracking-[0.3px] text-ink-2">USA LAS {o.desvios.length} VÍAS ALTERNAS</p>
            {o.desvios.map((d, i) => {
              const on = desvio === i;
              return (
                <button key={d.titulo} onClick={() => verDesvio(i)}
                  className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${on ? 'border-[#188038] bg-[#E6F4EA]' : 'border-[#E1E4E8] active:bg-surface'}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${on ? 'bg-[#188038] text-white' : 'bg-surface text-ink'}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold">{d.titulo}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{d.texto}</span>
                  </span>
                  <Icon name={on ? 'visibility' : 'route'} size={20} className={on ? 'text-[#188038]' : 'text-ink-2'} />
                </button>
              );
            })}
            <p className="text-xs text-ink-2">Toca un desvío para verlo en el mapa (trazo aproximado).</p>
          </div>
        )}

        {o.alternas_saturadas.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-bold tracking-[0.3px] text-ink-2">VÍAS ALTERNAS · VAN SATURADAS</p>
            <div className="flex flex-wrap gap-1.5">
              {o.alternas_saturadas.map((a) => (
                <span key={a} className="flex h-7 items-center gap-1 rounded-full bg-[#FEF4E0] px-2.5 text-xs font-semibold text-[#B06000]"><Icon name="traffic_jam" size={15} fill />{a}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3.5">
          {o.recomendaciones.map((r, i) => (
            <div key={r} className="flex items-center gap-2.5 text-sm"><Icon name={ICONO_REC[i % 3]} size={20} fill className="text-traffic-heavy" />{r}</div>
          ))}
        </div>

        {o.colonias.length > 0 && (
          <p className="text-[13px] text-ink-2"><b className="text-ink">Colonias afectadas:</b> {o.colonias.join(', ')}.</p>
        )}

        <p className="flex items-center gap-1.5 text-xs text-ink-2">
          <Icon name="info" size={15} />
          Fuente: {o.fuente.url
            ? <a href={o.fuente.url} target="_blank" rel="noreferrer" className="font-semibold text-primary">{o.fuente.nombre}</a>
            : o.fuente.nombre}
        </p>
      </div>
    </BottomSheet>
  );
}
