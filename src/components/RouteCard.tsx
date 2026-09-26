'use client';
import { fmtDist, horaLlegada, minutos } from '@/lib/acciones';
import { incidentesYObras } from '@/lib/data/obras';
import { incidenteEnLinea } from '@/lib/map/alertas';
import { useApp } from '@/lib/store';
import { BottomSheet } from './ui/BottomSheet';
import { Icon } from './ui/Icon';

/** Panel superior de la ruta: origen / destino. */
export function RouteTopBar() {
  const lugar = useApp((s) => s.lugar);
  const set = useApp((s) => s.set);
  const limpiar = useApp((s) => s.limpiarRuta);
  const toast = useApp((s) => s.toast);
  return (
    <div className="absolute inset-x-0 top-0 z-20 mx-auto w-full max-w-[480px] rounded-b-[20px] bg-white pb-3.5 pl-1.5 pr-3 pt-[max(12px,env(safe-area-inset-top))] shadow-float">
      <div className="flex items-center gap-1.5 pt-1">
        <button aria-label="Regresar" onClick={() => limpiar()} className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-surface">
          <Icon name="arrow_back" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex h-10 items-center gap-2.5 rounded-xl border border-[#E1E4E8] px-3 text-[15px] text-ink">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full border-[3px] border-primary" />Tu ubicación
          </div>
          <button onClick={() => set({ busquedaAbierta: true })} className="flex h-10 items-center gap-2 rounded-xl border border-[#E1E4E8] px-2.5 text-left text-[15px] text-ink">
            <Icon name="location_on" size={18} fill className="text-brand" />
            <span className="truncate">{lugar?.nombre ?? 'Destino'}</span>
          </button>
        </div>
        <button aria-label="Invertir" onClick={() => toast({ tipo: 'info', titulo: 'Por ahora salimos de tu ubicación' })} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-2 active:bg-surface">
          <Icon name="swap_vert" size={22} />
        </button>
      </div>
    </div>
  );
}

/** Tarjeta de ruta: tiempo, distancia, hora de llegada, alertas en el camino, Iniciar / Simular viaje. */
export function RouteCard() {
  const rutas = useApp((s) => s.rutas);
  const sel = useApp((s) => s.rutaSel);
  const resumen = useApp((s) => s.resumen);
  const incidentesSolos = useApp((s) => s.incidentes);
  const obras = useApp((s) => s.obras);
  const incidentes = incidentesYObras({ incidentes: incidentesSolos, obras });
  const set = useApp((s) => s.set);
  const r = rutas[sel];
  if (!r) return null;

  const incEnRuta = incidenteEnLinea(r.geometry, incidentes);
  const alternativaLimpia = incEnRuta ? rutas.findIndex((x) => !incidenteEnLinea(x.geometry, incidentes)) : -1;

  const chips: { k: string; txt: string; icon: string; color: string; escolar?: boolean }[] = [];
  if (resumen) {
    if (resumen.semaforos) chips.push({ k: 's', txt: `${resumen.semaforos} semáforo${resumen.semaforos > 1 ? 's' : ''}`, icon: 'traffic', color: 'text-traffic-free' });
    if (resumen.topes) chips.push({ k: 't', txt: `${resumen.topes} tope${resumen.topes > 1 ? 's' : ''}`, icon: 'warning', color: 'text-[#E3A100]' });
    if (resumen.altos) chips.push({ k: 'a', txt: `${resumen.altos} alto${resumen.altos > 1 ? 's' : ''}`, icon: 'report', color: 'text-traffic-stop' });
    if (resumen.zonas) chips.push({ k: 'z', txt: resumen.zonas > 1 ? `${resumen.zonas} zonas escolares activas` : 'zona escolar activa', icon: 'school', color: 'text-school', escolar: true });
    if (resumen.incidentes) chips.push({ k: 'i', txt: `${resumen.incidentes} incidente${resumen.incidentes > 1 ? 's' : ''}`, icon: 'car_crash', color: 'text-sos' });
  }

  return (
    <BottomSheet sinCerrar>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-[28px] font-extrabold leading-none tracking-[-0.5px] text-[#188038]">{minutos(r.duracion)} min</span>
          <span className="text-[15px] text-ink-2">
            {fmtDist(r.distancia)} · llegas {horaLlegada(r.duracion)}
            {r.fuente !== 'mapbox' && <span className="ml-1.5 rounded bg-surface px-1 text-[11px]">{r.fuente === 'osrm' ? 'OSRM' : 'aprox.'}</span>}
          </span>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map(({ k, txt, icon, color, escolar }) => (
              <span key={k} className={`flex h-8 items-center gap-1.5 rounded-full pl-2 pr-3 text-[13px] ${escolar ? 'bg-[#F3E9F7] font-bold text-[#6E2C8C]' : 'bg-surface font-semibold text-ink'}`}>
                <Icon name={icon} size={18} fill className={color} /> {txt}
              </span>
            ))}
          </div>
        )}
        {!resumen && <p className="text-sm text-ink-2">Revisando lo que hay en tu camino…</p>}

        {incEnRuta && (
          <div className="flex items-start gap-3 rounded-2xl bg-[#FCE8E6] px-3.5 py-3 text-sm text-[#A50E0E]">
            <Icon name="car_crash" size={22} fill className="text-sos" />
            <div>
              <b>Aguas:</b> {incEnRuta.tipo === 'accidente' ? 'choque' : incEnRuta.tipo} en {incEnRuta.calle || 'tu ruta'}{incEnRuta.origen === 'obra_municipal' && incEnRuta.descripcion ? ` · ${incEnRuta.descripcion.toLowerCase()}` : ''}
              {incEnRuta.carril_bloqueado?.length ? ` · carril ${incEnRuta.carril_bloqueado.join(', ')}` : ''}
              {alternativaLimpia >= 0 && (
                <button onClick={() => set({ rutaSel: alternativaLimpia })} className="mt-0.5 block font-bold underline">
                  Evítalo: +{Math.max(0, minutos(rutas[alternativaLimpia].duracion) - minutos(r.duracion))} min
                </button>
              )}
            </div>
          </div>
        )}

        {rutas.length > 1 && (
          <div className="flex gap-2">
            {rutas.map((x, i) => (
              <button key={i} onClick={() => set({ rutaSel: i })}
                className={`flex-1 rounded-xl border px-2.5 py-1.5 text-left text-xs ${i === sel ? 'border-primary bg-[#ECEEFF] text-primary' : 'border-[#E1E4E8] text-ink-2'}`}>
                <b className="text-sm">{minutos(x.duracion)} min</b><br /><span className="line-clamp-1">{x.resumen || `Opción ${i + 1}`}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-1 grid grid-cols-2 gap-2.5">
          <button onClick={() => set({ navegando: true, simulando: false, hoja: null })}
            className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-white active:scale-[.98]">
            <Icon name="navigation" size={22} fill /> Iniciar
          </button>
          <button onClick={() => set({ navegando: true, simulando: true, hoja: null })}
            className="flex h-[52px] items-center justify-center gap-1.5 rounded-full border-[1.5px] border-primary text-base font-bold text-primary active:scale-[.98]">
            <Icon name="play_arrow" size={22} fill /> Simular viaje
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
