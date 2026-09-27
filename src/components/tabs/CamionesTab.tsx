'use client';
import { useEffect, useMemo, useState } from 'react';
import { fmtDist, origenActual } from '@/lib/acciones';
import {
  colorTextoOcupacion, fraseSugerencia, paradaMasCercana, pctOcupacion, proximasLlegadas, sugerirRutas, type Sugerencia,
} from '@/lib/data/camiones';
import { encuadrar } from '@/lib/map/instancia';
import { buscarLugares } from '@/lib/map/mapbox';
import { useApp } from '@/lib/store';
import type { Lugar, RutaCamion } from '@/lib/types';
import { ALTO_NAV_CSS } from '../BottomNav';
import { Icon } from '../ui/Icon';
import { BarraOcupacion, InsigniaRuta, nombreCorto } from '../ui/Ocupacion';

const tarjeta = 'rounded-[20px] bg-white shadow-[0_2px_10px_rgba(0,0,0,.05)]';

/** B2 · ruta seleccionada: el mapa muestra solo esa ruta con sus unidades en vivo. */
function RutaSeleccionada({ ruta, onAtras }: { ruta: RutaCamion; onAtras: () => void }) {
  const camionesMap = useApp((s) => s.camiones);
  const hoja = useApp((s) => s.hoja);
  const set = useApp((s) => s.set);
  const unidades = useMemo(() => Object.values(camionesMap).filter((c) => c.ruta_id === ruta.id), [camionesMap, ruta.id]);
  const [olng, olat] = origenActual();
  const cercana = paradaMasCercana([ruta], olng, olat);
  const llegada = cercana ? proximasLlegadas(ruta, cercana.parada, unidades)[0] : undefined;

  return (
    <>
      <div className="absolute inset-x-0 top-0 z-30 mx-auto w-full max-w-[480px] animate-fade-in rounded-b-[20px] bg-white pb-3.5 pl-1.5 pr-4 pt-[max(12px,env(safe-area-inset-top))] shadow-float">
        <div className="flex items-center gap-2 pt-1">
          <button aria-label="Regresar" onClick={onAtras} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-surface"><Icon name="arrow_back" /></button>
          <InsigniaRuta id={ruta.id} color={ruta.color} tam={36} radio={10} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold">{ruta.nombre}</div>
            <div className="text-[13px] text-ink-2">{unidades.length} unidad{unidades.length === 1 ? '' : 'es'} en servicio · {ruta.paradas.length} paradas</div>
          </div>
        </div>
      </div>
      {!hoja && (
        <div className="absolute inset-x-3 z-30 mx-auto flex max-w-[456px] animate-slide-up flex-col gap-2.5 rounded-[20px] bg-white px-3.5 py-3 shadow-[0_6px_20px_rgba(0,0,0,.14)]" style={{ bottom: 'max(28px, env(safe-area-inset-bottom))' }}>
          {cercana && (
            <div className="flex items-center gap-2.5">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border-[3px]" style={{ borderColor: ruta.color }} />
              <div className="min-w-0 flex-1 truncate text-sm font-semibold">{cercana.parada.nombre}</div>
              <div className="shrink-0 text-sm font-bold text-[#188038]">{llegada ? `${llegada.eta_min} min` : '—'}</div>
            </div>
          )}
          {unidades.length > 0 && (
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              {unidades.map((c) => {
                const pct = pctOcupacion(c);
                return (
                  <button key={c.id} onClick={() => set({ hoja: { tipo: 'camion', id: c.id } })}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-surface pl-2 pr-3 text-xs font-semibold active:bg-[#ECEEFF]">
                    <Icon name="directions_bus" size={16} fill style={{ color: ruta.color }} />Unidad {c.id}
                    <span style={{ color: colorTextoOcupacion(pct) }}>{pct}%</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-3.5 text-xs text-ink-2">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-traffic-free" />Con lugar</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-traffic-mod" />Medio</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-traffic-heavy" />Lleno</span>
            <span className="ml-auto">Toca una unidad</span>
          </div>
        </div>
      )}
    </>
  );
}

/** B1 · pestaña Camiones. */
export function CamionesTab() {
  const rutas = useApp((s) => s.rutasCamion);
  const camionesMap = useApp((s) => s.camiones);
  const sel = useApp((s) => s.rutaCamionSel);
  const set = useApp((s) => s.set);
  const camiones = useMemo(() => Object.values(camionesMap), [camionesMap]);
  const [q, setQ] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [destino, setDestino] = useState<Lugar | null>(null);
  const [sugerencias, setSugerencias] = useState<Sugerencia[] | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => { const t = setTimeout(() => setCargado(true), 6000); return () => clearTimeout(t); }, []);

  const [olng, olat] = origenActual();
  const cercana = useMemo(() => paradaMasCercana(rutas, olng, olat), [rutas, olng, olat]);
  const llegadaCercana = cercana ? proximasLlegadas(cercana.ruta, cercana.parada, camiones)[0] : undefined;
  const rutaSel = rutas.find((r) => r.id === sel) || null;

  const elegirRuta = (r: RutaCamion | null) => {
    set({ rutaCamionSel: r?.id ?? null, hoja: null });
    if (r) encuadrar(r.trazo.coordinates, { top: 130, bottom: 170, left: 40, right: 40 });
  };

  const buscar = async () => {
    if (!q.trim()) return;
    setBuscando(true);
    const [l] = await buscarLugares(q, origenActual());
    setBuscando(false);
    if (!l) { setSugerencias([]); setDestino(null); return; }
    setDestino(l);
    let s = sugerirRutas(rutas, camiones, origenActual(), [l.lng, l.lat]);
    if (!s.length) s = sugerirRutas(rutas, camiones, origenActual(), [l.lng, l.lat], 900);
    setSugerencias(s);
  };

  if (rutaSel) return <RutaSeleccionada ruta={rutaSel} onAtras={() => elegirRuta(null)} />;

  return (
    <div className="absolute inset-x-0 top-0 z-30 mx-auto flex w-full max-w-[480px] animate-fade-in flex-col bg-surface" style={{ bottom: ALTO_NAV_CSS }}>
      <div className="flex flex-col gap-3.5 bg-white px-4 pb-4 pt-[max(14px,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-extrabold tracking-[-0.4px]">Camiones</h1>
        <form onSubmit={(e) => { e.preventDefault(); buscar(); }} className="flex h-12 items-center gap-2.5 rounded-full bg-surface px-4">
          <Icon name="search" size={22} className="text-ink-2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="¿A dónde quieres ir en camión?" enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-2" />
          {buscando ? <Icon name="progress_activity" size={20} className="animate-spin text-ink-2" /> : q && (
            <button type="button" aria-label="Borrar" onClick={() => { setQ(''); setSugerencias(null); setDestino(null); }} className="text-ink-2"><Icon name="close" size={20} /></button>
          )}
        </form>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4">
        {!rutas.length && (
          <div className={`${tarjeta} flex flex-col items-center gap-2 p-6 text-center text-sm text-ink-2`}>
            <Icon name={cargado ? 'directions_bus' : 'progress_activity'} size={32} className={cargado ? 'text-[#D5DAE0]' : 'animate-spin text-primary'} />
            {cargado ? 'No hay rutas en vivo. Enciende el motor de ciudad (python -m sim.main).' : 'Cargando rutas y unidades…'}
          </div>
        )}

        {sugerencias && (
          <div className={`${tarjeta} flex flex-col gap-2 p-4`}>
            <p className="text-xs font-bold tracking-[0.3px] text-ink-2">PARA IR A {(destino?.nombre || q).toUpperCase()}</p>
            {sugerencias.length === 0 && <p className="text-sm text-ink-2">Ninguna ruta pasa cerca de ti y de tu destino. Prueba en carro o combina rutas.</p>}
            {sugerencias.slice(0, 3).map((s) => (
              <button key={s.ruta.id} onClick={() => elegirRuta(s.ruta)} className="flex items-center gap-3 rounded-[14px] bg-surface p-3 text-left active:bg-[#ECEEFF]">
                <InsigniaRuta id={s.ruta.id} color={s.ruta.color} />
                <span className="min-w-0 flex-1 text-sm">{fraseSugerencia(s)}<span className="mt-0.5 block text-xs text-ink-2">Bájate en {s.bajar.parada.nombre}</span></span>
                <Icon name="chevron_right" size={22} className="text-ink-2" />
              </button>
            ))}
          </div>
        )}

        {cercana && !sugerencias && (
          <div className={`${tarjeta} flex flex-col gap-3 p-4`}>
            <div className="flex items-center gap-2 text-xs font-bold tracking-[0.3px] text-ink-2">
              <Icon name="near_me" size={18} fill className="text-[#0E9F8E]" />TU PARADA MÁS CERCANA
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0 text-lg font-bold leading-tight">{cercana.parada.nombre}</div>
              <div className="shrink-0 text-sm text-ink-2">{fmtDist(cercana.distancia_m)}</div>
            </div>
            <button onClick={() => elegirRuta(cercana.ruta)} className="flex items-center gap-3 rounded-[14px] bg-surface p-3 text-left active:bg-[#ECEEFF]">
              <InsigniaRuta id={cercana.ruta.id} color={cercana.ruta.color} texto={17} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">
                  {cercana.ruta.nombre.split('·')[0].trim()} {llegadaCercana ? `llega en ${llegadaCercana.eta_min} min` : '· sin unidades cerca'}
                </div>
                {llegadaCercana && (
                  <div className="mt-0.5 text-[13px] font-semibold" style={{ color: colorTextoOcupacion(llegadaCercana.pct) }}>
                    {llegadaCercana.pct}% lleno · {cercana.caminar_min} min caminando
                  </div>
                )}
              </div>
              <Icon name="chevron_right" size={22} className="text-ink-2" />
            </button>
          </div>
        )}

        {rutas.length > 0 && (
          <>
            <p className="px-1 pt-1 text-[13px] font-bold tracking-[0.3px] text-ink-2">RUTAS</p>
            <div className={`${tarjeta} overflow-hidden`}>
              {rutas.map((r) => {
                const us = camiones.filter((c) => c.ruta_id === r.id);
                const prom = us.length ? Math.round(us.reduce((a, c) => a + pctOcupacion(c), 0) / us.length) : 0;
                return (
                  <button key={r.id} onClick={() => elegirRuta(r)} className="flex w-full items-center gap-3 border-b border-[#ECEEF1] px-4 py-3.5 text-left last:border-b-0 active:bg-surface">
                    <InsigniaRuta id={r.id} color={r.color} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="flex justify-between gap-2">
                        <span className="truncate text-[15px]"><span className="font-semibold">{r.nombre.split('·')[0].trim()}</span>{r.nombre.includes('·') && <span className="text-ink-2"> · {nombreCorto(r.nombre)}</span>}</span>
                        <span className="whitespace-nowrap text-xs text-ink-2">{us.length} unidades</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <BarraOcupacion pct={prom} alto={6} />
                        <span className="w-8 text-right text-xs font-semibold" style={{ color: colorTextoOcupacion(prom) }}>{prom}%</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="px-1 text-xs text-ink-2">La ocupación viene de los sensores de conteo en las puertas de cada unidad. Trazos de ruta aproximados.</p>
          </>
        )}
      </div>
    </div>
  );
}
