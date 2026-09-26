'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { CENTRO_CUU } from '@/lib/config';
import { useDatosVivos } from '@/lib/data/vivo';
import { CALLES_DEMO, type RespuestaCiudad } from '@/lib/eventos';
import { hechosCiudad } from '@/lib/hechos';
import { useCanalLocal, llamarCiudad } from '@/lib/local/aplicar';
import { useCamionesLocal } from '@/lib/local/camiones';
import { useCiudadLocal } from '@/lib/local/ciudad';
import { useObras } from '@/lib/data/obras';
import { useEmergenciaLocal } from '@/lib/local/emergencia';
import { volarA } from '@/lib/map/instancia';
import { useApp } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Toasts } from '../Toasts';
import { Icon } from '../ui/Icon';

const MapView = dynamic(() => import('../map/MapView'), { ssr: false, loading: () => <div className="absolute inset-0 bg-[#F1F0EC]" /> });

type Accion = 'accidente' | 'congestion' | 'cerrar_via' | 'hora_pico' | 'sos' | 'resumen' | 'limpiar';

/** B9 · Panel /demo (tablet): el "botón secreto" que dispara la automatización en vivo. */
export function DemoPanel() {
  useDatosVivos();
  useCanalLocal();
  useCamionesLocal();
  useCiudadLocal();
  useObras();
  useEmergenciaLocal();

  const nVehiculos = useApp((s) => s.nVehiculos);
  const motorVivo = useApp((s) => s.motorVivo);
  const incidentes = useApp((s) => s.incidentes.filter((i) => i.estado === 'activo').length);
  const camiones = useApp((s) => Object.keys(s.camiones).length);
  const [calle, setCalle] = useState(CALLES_DEMO[0].nombre);
  const [carril, setCarril] = useState(2);
  const [horaPico, setHoraPico] = useState(false);
  const [ocupado, setOcupado] = useState<Accion | null>(null);
  const [log, setLog] = useState<{ t: string; txt: string; ok: boolean }[]>([]);
  const c = CALLES_DEMO.find((x) => x.nombre === calle) || CALLES_DEMO[0];

  const lanzar = async (accion: Accion, extra: Record<string, unknown> = {}) => {
    setOcupado(accion);
    const cuerpo = { accion, ...extra, ...(accion === 'resumen' ? { hechos: hechosCiudad() } : {}) };
    const r = await llamarCiudad<RespuestaCiudad & { mensaje_voz?: string }>('/api/demo', cuerpo);
    setOcupado(null);
    const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const txt = r?.ok ? (r.mensaje || 'Listo') : r?.error || 'Sin conexión con la app';
    setLog((l) => [{ t: hora, txt: `${txt}${r?.ok ? (r.persistido ? ' · Supabase' : ' · local') : ''}`, ok: Boolean(r?.ok) }, ...l].slice(0, 6));
    if (r?.ok && (accion === 'accidente' || accion === 'congestion' || accion === 'cerrar_via')) volarA(c.lng, c.lat, 15);
    if (r?.ok && accion === 'sos') volarA(CENTRO_CUU.lng, CENTRO_CUU.lat, 13.5);
    if (r?.ok && accion === 'limpiar') setHoraPico(false);
    return r;
  };

  const Tile = ({ accion, icon, label, caja, color, activo, onClick }: { accion: Accion; icon: string; label: string; caja: string; color?: string; activo?: boolean; onClick: () => void }) => (
    <button onClick={onClick} disabled={ocupado != null}
      className={`relative flex h-[72px] flex-col justify-center gap-1 rounded-2xl px-3.5 text-left transition active:scale-[.98] disabled:opacity-60 ${caja} ${activo ? 'ring-2 ring-offset-2 ring-[#E3A100]' : ''}`}>
      <Icon name={ocupado === accion ? 'progress_activity' : icon} size={22} fill className={`${color || ''} ${ocupado === accion ? 'animate-spin' : ''}`} />
      <span className="text-sm font-bold">{label}{activo ? ' · activa' : ''}</span>
    </button>
  );

  return (
    <main className="flex min-h-[100dvh] w-full flex-col bg-white md:grid md:h-[100dvh] md:grid-cols-[360px_1fr]">
      <section className="flex flex-col gap-[18px] border-[#ECEEF1] px-[22px] py-6 md:overflow-y-auto md:border-r">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-extrabold tracking-[-0.4px]">Vive<span className="text-futuro">CUU</span> <span className="font-semibold text-ink-2">/demo</span></h1>
          <span className={`flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs font-bold ${supabase ? 'bg-[#E6F4EA] text-[#137333]' : 'bg-[#FEF4E0] text-[#B06000]'}`}>
            <span className={`h-[7px] w-[7px] rounded-full ${supabase ? 'bg-traffic-free' : 'bg-[#E3A100]'}`} />{supabase ? 'En vivo' : 'Modo local'}
          </span>
        </div>

        <div className="flex flex-col gap-3 rounded-[18px] border border-[#E1E4E8] p-3.5">
          <div className="flex items-center gap-2 text-[15px] font-bold"><Icon name="car_crash" size={22} fill className="text-traffic-stop" />Provocar accidente</div>
          <div className="grid grid-cols-[1fr_92px] gap-2">
            <label className="relative">
              <span className="sr-only">Calle</span>
              <select value={calle} onChange={(e) => { setCalle(e.target.value); setCarril(Math.min(carril, CALLES_DEMO.find((x) => x.nombre === e.target.value)?.carriles || 3)); }}
                className="h-[42px] w-full appearance-none rounded-xl border border-[#E1E4E8] bg-white pl-3 pr-8 text-sm outline-none focus:border-primary">
                {CALLES_DEMO.map((x) => <option key={x.nombre}>{x.nombre}</option>)}
              </select>
              <Icon name="expand_more" size={20} className="pointer-events-none absolute right-2 top-[11px] text-ink-2" />
            </label>
            <label className="relative">
              <span className="sr-only">Carril</span>
              <select value={carril} onChange={(e) => setCarril(Number(e.target.value))}
                className="h-[42px] w-full appearance-none rounded-xl border border-[#E1E4E8] bg-white pl-3 pr-7 text-sm outline-none focus:border-primary">
                {Array.from({ length: c.carriles }, (_, i) => <option key={i} value={i + 1}>Carril {i + 1}</option>)}
              </select>
              <Icon name="expand_more" size={20} className="pointer-events-none absolute right-1.5 top-[11px] text-ink-2" />
            </label>
          </div>
          <button onClick={() => lanzar('accidente', { calle, carril })} disabled={ocupado != null}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-traffic-stop text-[15px] font-bold text-white active:scale-[.98] disabled:opacity-60">
            {ocupado === 'accidente' && <Icon name="progress_activity" size={20} className="animate-spin" />}Provocar
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Tile accion="congestion" icon="traffic_jam" label="Congestión total" caja="bg-[#FCE8E6] text-[#8C1D18]" color="text-traffic-stop" onClick={() => lanzar('congestion', { calle })} />
          <Tile accion="cerrar_via" icon="block" label="Cerrar vía" caja="bg-[#FFF0E0] text-[#7A3E00]" color="text-traffic-heavy" onClick={() => lanzar('cerrar_via', { calle })} />
          <Tile accion="hora_pico" icon="schedule" label="Hora pico" caja="bg-[#FEF4E0] text-[#6B4400]" color="text-[#E3A100]" activo={horaPico}
            onClick={async () => { const r = await lanzar('hora_pico', { activo: !horaPico }); if (r?.ok) setHoraPico(!horaPico); }} />
          <Tile accion="sos" icon="sos" label="Lanzar SOS de prueba" caja="bg-sos text-white" onClick={() => lanzar('sos', { lat: CENTRO_CUU.lat, lng: CENTRO_CUU.lng })} />
        </div>
        <p className="-mt-2 text-xs text-ink-2">Congestión y cierre usan la calle elegida arriba. El 911 siempre es simulado.</p>

        <div className="flex min-h-[96px] flex-1 flex-col gap-1.5">
          {log.map((l, i) => (
            <div key={i} className={`flex gap-2 text-[13px] ${i ? 'text-ink-2' : 'text-ink'}`}>
              <span className="shrink-0 font-mono text-[11px] leading-5 text-ink-2">{l.t}</span>
              <Icon name={l.ok ? 'check_circle' : 'error'} size={16} fill className={`mt-0.5 ${l.ok ? 'text-traffic-free' : 'text-sos'}`} />
              <span className="min-w-0 whitespace-pre-line">{l.txt}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => lanzar('resumen')} disabled={ocupado != null}
            className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-primary text-[15px] font-bold text-white active:scale-[.98] disabled:opacity-60">
            <Icon name={ocupado === 'resumen' ? 'progress_activity' : 'summarize'} size={20} fill className={ocupado === 'resumen' ? 'animate-spin' : ''} />Resumen
          </button>
          <button onClick={() => lanzar('limpiar')} disabled={ocupado != null}
            className="flex h-12 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#D5DAE0] text-[15px] font-bold text-ink active:scale-[.98] disabled:opacity-60">
            <Icon name="restart_alt" size={20} />Limpiar
          </button>
        </div>
      </section>

      <section className="relative h-[60vh] bg-[#F1F0EC] md:h-auto">
        <MapView />
        <div className="pointer-events-none absolute inset-x-4 top-4 flex gap-2.5">
          {[
            { k: 'Vehículos', v: motorVivo || nVehiculos ? String(nVehiculos) : '—', c: 'text-ink' },
            { k: 'Incidentes', v: String(incidentes), c: 'text-traffic-stop' },
            { k: 'Camiones', v: String(camiones), c: 'text-[#0E9F8E]' },
          ].map((x) => (
            <div key={x.k} className="rounded-[14px] bg-white px-3.5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,.1)]">
              <div className="text-xs text-ink-2">{x.k}</div>
              <div className={`text-xl font-extrabold ${x.c}`}>{x.v}</div>
            </div>
          ))}
        </div>
        <Toasts />
      </section>
    </main>
  );
}
