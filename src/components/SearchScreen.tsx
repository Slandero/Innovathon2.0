'use client';
import { useEffect, useRef, useState } from 'react';
import { distanciaA, elegirLugar, fmtDist, leerRecientes, origenActual } from '@/lib/acciones';
import { buscarLugares } from '@/lib/map/mapbox';
import { useApp } from '@/lib/store';
import type { Lugar } from '@/lib/types';
import { Icon } from './ui/Icon';

const RAPIDOS = [
  { label: 'Casa', icon: 'home', color: 'text-primary', q: null as string | null },
  { label: 'Tec II', icon: 'school', color: 'text-school', q: 'Instituto Tecnológico de Chihuahua II' },
  { label: 'Centro', icon: 'location_city', color: 'text-brand', q: 'Plaza de Armas Chihuahua' },
  { label: 'UACH', icon: 'account_balance', color: 'text-traffic-free', q: 'Universidad Autónoma de Chihuahua Campus II' },
];

const esCalle = (n: string) => /^(av\.?|avenida|calle|blvd\.?|boulevard|perif[eé]rico|carretera|privada)\b/i.test(n.trim());

/** Resalta en negritas la parte del nombre que coincide con lo escrito. */
function Resaltado({ texto, q }: { texto: string; q: string }) {
  const norm = (x: string) => x.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const i = q.trim() ? norm(texto).indexOf(norm(q.trim())) : -1;
  if (i < 0) return <>{texto}</>;
  const f = i + q.trim().length;
  return <>{texto.slice(0, i)}<b className="font-bold">{texto.slice(i, f)}</b>{texto.slice(f)}</>;
}

export function leerCasa(): Lugar | null {
  try { return JSON.parse(localStorage.getItem('vivecuu:casa') || 'null'); } catch { return null; }
}

export function SearchScreen() {
  const set = useApp((s) => s.set);
  const toast = useApp((s) => s.toast);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Lugar[]>([]);
  const [cargando, setCargando] = useState(false);
  const [recientes] = useState<Lugar[]>(() => leerRecientes());
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => { input.current?.focus(); }, []);

  useEffect(() => {
    if (!q.trim()) { setRes([]); setCargando(false); return; }
    setCargando(true);
    const mio = ++seq.current;
    const t = setTimeout(async () => {
      const r = await buscarLugares(q, origenActual());
      if (mio === seq.current) { setRes(r); setCargando(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const rapido = async (label: string, consulta: string | null) => {
    if (!consulta) {
      const casa = leerCasa();
      if (casa) return elegirLugar(casa);
      toast({ tipo: 'info', titulo: 'Aún no guardas tu casa', texto: 'Búscala y toca "Guardar como casa" en la tarjeta.' });
      return;
    }
    setQ(label);
    setCargando(true);
    const r = await buscarLugares(consulta, origenActual());
    setCargando(false);
    if (r[0]) elegirLugar({ ...r[0], nombre: r[0].nombre || label });
    else setRes([]);
  };

  const Fila = ({ l, icono, primero }: { l: Lugar; icono: 'pin' | 'reloj'; primero?: boolean }) => (
    <button onClick={() => elegirLugar(l)} className={`flex w-full items-center gap-3.5 px-5 py-3 text-left active:bg-surface ${primero ? 'bg-surface' : ''}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${primero ? 'bg-white text-brand' : 'bg-surface text-ink-2'}`}>
        <Icon name={icono === 'reloj' ? 'history' : esCalle(l.nombre) ? 'add_road' : 'location_on'} size={22} fill={primero} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">{icono === 'pin' ? <Resaltado texto={l.nombre} q={q} /> : l.nombre}</span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-2">{l.direccion}</span>
      </span>
      {icono === 'pin' && <span className="shrink-0 text-[13px] text-ink-2">{fmtDist(distanciaA(l))}</span>}
    </button>
  );

  const Titulo = ({ children, arriba = 16 }: { children: string; arriba?: number }) => (
    <p className="px-5 pb-1.5 text-[13px] font-bold tracking-[0.3px] text-ink-2" style={{ paddingTop: arriba }}>{children}</p>
  );

  return (
    <div className="absolute inset-0 z-50 flex animate-fade-in flex-col bg-white">
      <div className="mx-auto w-full max-w-[480px] pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-1.5 pl-1.5 pr-3 pt-1">
          <button aria-label="Regresar" onClick={() => set({ busquedaAbierta: false })} className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-surface">
            <Icon name="arrow_back" />
          </button>
          <div className="flex h-12 flex-1 items-center gap-2 rounded-full border-2 border-primary bg-surface pl-4 pr-1.5">
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="¿A dónde vas?"
              className="min-w-0 flex-1 bg-transparent text-base text-ink caret-primary outline-none placeholder:text-ink-2"
              enterKeyHint="search"
              onKeyDown={(e) => { if (e.key === 'Enter' && res[0]) elegirLugar(res[0]); }}
            />
            {cargando ? (
              <span className="flex h-9 w-9 items-center justify-center"><Icon name="progress_activity" size={20} className="animate-spin text-ink-2" /></span>
            ) : q && (
              <button aria-label="Borrar" onClick={() => setQ('')} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 active:bg-white">
                <Icon name="close" size={20} />
              </button>
            )}
          </div>
          <button aria-label="Buscar con voz" onClick={() => set({ busquedaAbierta: false, flujo: 'copiloto' })} className="flex h-11 w-11 items-center justify-center rounded-full text-primary active:bg-surface">
            <Icon name="mic" fill />
          </button>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2 pt-4">
          {RAPIDOS.map(({ label, icon, color, q: consulta }) => (
            <button key={label} onClick={() => rapido(label, consulta)} className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#E1E4E8] pl-3 pr-4 text-sm font-semibold text-ink active:bg-surface">
              <Icon name={icon} size={20} fill className={color} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[480px] flex-1 overflow-y-auto pb-6">
        {q.trim() && (
          <>
            <Titulo>RESULTADOS</Titulo>
            {res.map((l, i) => <Fila key={l.id} l={l} icono="pin" primero={i === 0} />)}
            {!cargando && !res.length && <p className="px-5 py-8 text-center text-sm text-ink-2">No encontramos &quot;{q}&quot; en Chihuahua. Prueba con otra palabra.</p>}
          </>
        )}
        <Titulo arriba={q.trim() ? 22 : 16}>RECIENTES</Titulo>
        {recientes.length ? recientes.slice(0, q.trim() ? 3 : 8).map((l) => <Fila key={l.id} l={l} icono="reloj" />) : (
          <p className="px-5 py-3 text-sm text-ink-2">Aquí verás los lugares que busques.</p>
        )}
      </div>
    </div>
  );
}
