'use client';
import { useEffect, useState } from 'react';
import { origenActual } from '@/lib/acciones';
import { colorOcupacion, paradaMasCercana, pctOcupacion, proximasLlegadas } from '@/lib/data/camiones';
import { useApp } from '@/lib/store';
import { BottomSheet } from '../ui/BottomSheet';
import { Icon } from '../ui/Icon';

const TONO = (pct: number) => pct < 55
  ? { bg: '#E6F4EA', label: '#137333', valor: '#137333', track: '#CEEAD6' }
  : pct < 80
    ? { bg: '#FEF4E0', label: '#8A5A00', valor: '#B06000', track: '#FBE3B0' }
    : { bg: '#FFF0E0', label: '#7A3E00', valor: '#B34700', track: '#FDD9B5' };

/** B3 · hoja de camión: cuándo llega a tu parada, ocupación por sensor y aviso. */
export function CamionSheet({ id }: { id: string }) {
  const c = useApp((s) => s.camiones[id]);
  const ruta = useApp((s) => s.rutasCamion.find((r) => r.id === s.camiones[id]?.ruta_id));
  const aviso = useApp((s) => s.avisoCamion);
  const set = useApp((s) => s.set);
  const toast = useApp((s) => s.toast);
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!c || !ruta) return null;

  const pct = pctOcupacion(c);
  const tono = TONO(pct);
  const hace = Math.max(0, Math.round((ahora - Date.parse(c.updated_at)) / 1000));
  const [olng, olat] = origenActual();
  const tuParada = paradaMasCercana([ruta], olng, olat);
  const eta = tuParada ? proximasLlegadas(ruta, tuParada.parada, [c])[0]?.eta_min : c.eta_min;
  const avisando = aviso?.camionId === c.id;

  const avisame = async () => {
    if (avisando) { set({ avisoCamion: null }); toast({ tipo: 'info', titulo: 'Quitamos el aviso' }); return; }
    if (!tuParada) return;
    try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch { /* */ }
    set({ avisoCamion: { camionId: c.id, rutaId: ruta.id, parada: tuParada.parada.nombre } });
    toast({ tipo: 'ok', titulo: 'Te avisamos cuando esté cerca', texto: `Unidad ${c.id} · ${tuParada.parada.nombre}` });
  };

  return (
    <BottomSheet sinCerrar>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-white" style={{ background: ruta.color }}>
            <Icon name="directions_bus" size={28} fill />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[22px] font-bold leading-tight tracking-[-0.3px]">{ruta.nombre}</h2>
            <p className="mt-0.5 text-[13px] text-ink-2">Unidad {c.id}{c.fuente === 'iot' ? ' · sensor ESP32' : ''}</p>
          </div>
          <button aria-label="Cerrar" onClick={() => set({ hoja: null })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface active:scale-95">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1 rounded-2xl bg-surface p-3.5">
            <div className="text-xs font-semibold text-ink-2">{tuParada ? 'Llega a tu parada en' : 'Próxima parada en'}</div>
            <div className="text-[28px] font-extrabold leading-tight tracking-[-0.5px] text-[#188038]">{eta ?? '?'} min</div>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl p-3.5" style={{ background: tono.bg }}>
            <div className="text-xs font-semibold" style={{ color: tono.label }}>Ocupación</div>
            <div className="text-[28px] font-extrabold leading-none tracking-[-0.5px]" style={{ color: tono.valor }}>{pct}%</div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: tono.track }}>
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, pct)}%`, background: colorOcupacion(pct) }} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-0.5 py-1">
          <Icon name="location_on" size={22} fill style={{ color: ruta.color }} />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-ink-2">Próxima parada · {c.eta_min ?? '?'} min</div>
            <div className="truncate text-[15px] font-semibold">{c.proxima_parada || '—'}</div>
          </div>
          <span className="text-xs text-ink-2">{c.ocupacion}/{c.capacidad}</span>
        </div>

        <div className="flex h-7 items-center gap-2 self-start rounded-full bg-[#E6F4EA] px-3 text-xs font-semibold text-[#137333]">
          <span className="h-[7px] w-[7px] rounded-full bg-traffic-free" />Dato de sensor · hace {hace} s
        </div>

        <button onClick={avisame} disabled={!tuParada}
          className={`flex h-[52px] items-center justify-center gap-2 rounded-full text-base font-bold active:scale-[.98] disabled:opacity-50 ${avisando ? 'border-[1.5px] border-primary text-primary' : 'bg-primary text-white'}`}>
          <Icon name={avisando ? 'notifications_off' : 'notifications_active'} size={22} fill />
          {avisando ? 'Quitar aviso' : 'Avísame cuando esté cerca'}
        </button>
      </div>
    </BottomSheet>
  );
}
