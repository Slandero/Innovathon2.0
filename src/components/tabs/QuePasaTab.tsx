'use client';
import { useEffect, useMemo, useState } from 'react';
import { fechaCorta } from '@/lib/data/obras';
import { haceTexto, hechosCiudad, nombreIncidente, pronosticoHorario } from '@/lib/hechos';
import { volarA } from '@/lib/map/instancia';
import { useApp } from '@/lib/store';
import type { AlertaN8n } from '@/lib/types';
import { ALTO_NAV_CSS } from '../BottomNav';
import { ICONO_TIPO } from '../flows/ReportarFlow';
import { Icon } from '../ui/Icon';

interface Item {
  key: string; icon: string; bg: string; fg: string; titulo: string; sub: string; t: string; ts: number;
  abrir?: () => void;
}

const ESTILO_ALERTA: Record<AlertaN8n['tipo'], { icon: string; bg: string; fg: string }> = {
  '911_simulado': { icon: 'emergency', bg: '#E5252A', fg: '#FFFFFF' },
  familiar: { icon: 'sms', bg: '#ECEEFF', fg: '#3D5AFE' },
  desvio: { icon: 'alt_route', bg: '#3D5AFE', fg: '#FFFFFF' },
  dependencia: { icon: 'send', bg: '#F1EDFF', fg: '#7C5CFF' },
  resumen: { icon: 'summarize', bg: '#F6F7F9', fg: '#5F6B7A' },
  zona_escolar: { icon: 'school', bg: '#F3E9F7', fg: '#8E44AD' },
};
const ESTILO_INC: Record<string, { icon: string; bg: string; fg: string }> = {
  accidente: { icon: 'car_crash', bg: '#FCE8E6', fg: '#C5221F' },
  cierre: { icon: 'block', bg: '#FFF0E0', fg: '#F57C00' },
  obra: { icon: 'construction', bg: '#FFF0E0', fg: '#F57C00' },
  congestion: { icon: 'traffic_jam', bg: '#FEF4E0', fg: '#B06000' },
};

/** B8 · Qué pasa en CUU: alertas de n8n, incidentes, reportes y pronóstico, lo más nuevo arriba. */
export function QuePasaTab() {
  const alertas = useApp((s) => s.alertasN8n);
  const incidentes = useApp((s) => s.incidentes);
  const reportes = useApp((s) => s.reportes);
  const obras = useApp((s) => s.obras);
  const set = useApp((s) => s.set);
  const [, tic] = useState(0);
  const [resumen, setResumen] = useState<{ cargando: boolean; texto: string | null }>({ cargando: false, texto: null });

  useEffect(() => {
    const t = setInterval(() => tic((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const verIncidente = (id: number, lng: number, lat: number) => { set({ tab: 'mapa', hoja: { tipo: 'incidente', id } }); volarA(lng, lat, 16); };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const a of alertas.slice(0, 20)) {
      const e = ESTILO_ALERTA[a.tipo] || ESTILO_ALERTA.resumen;
      const inc = a.incidente_id != null ? incidentes.find((i) => i.id === a.incidente_id) : undefined;
      out.push({
        key: `a${a.id}`, ...e, titulo: a.titulo || 'Alerta', sub: a.tipo === 'resumen' ? (a.mensaje || '').split('\n')[0].replace(/^•\s*/, '') : a.mensaje || '',
        t: haceTexto(a.created_at), ts: Date.parse(a.created_at),
        abrir: inc ? () => verIncidente(inc.id, inc.lng, inc.lat) : undefined,
      });
    }
    for (const i of incidentes.filter((x) => x.estado === 'activo')) {
      const e = ESTILO_INC[i.tipo] || ESTILO_INC.accidente;
      const carriles = i.carril_bloqueado?.length
        ? (i.carril_bloqueado.length >= (i.carriles_totales || 3) ? 'Vía cerrada' : `Carril ${i.carril_bloqueado.join(' y ')} cerrado`)
        : i.descripcion || 'Avanza lento';
      out.push({
        key: `i${i.id}`, ...e, titulo: `${nombreIncidente(i.tipo)} · ${i.calle || 'Chihuahua'}`, sub: `${carriles}${i.retraso_min ? ` · +${i.retraso_min} min` : ''}`,
        t: haceTexto(i.inicio), ts: Date.parse(i.inicio), abrir: () => verIncidente(i.id, i.lng, i.lat),
      });
    }
    for (const r of reportes.slice(0, 10)) {
      const t = ICONO_TIPO[r.tipo || 'otro'] || ICONO_TIPO.otro;
      out.push({
        key: `r${r.id}`, icon: 'add_a_photo', bg: '#F6F7F9', fg: '#5F6B7A', titulo: `Reporte nuevo · ${t.nombre}`,
        sub: `${r.titulo && r.titulo !== t.nombre ? `${r.titulo} · ` : ''}${r.votos} voto${r.votos === 1 ? '' : 's'}`,
        t: haceTexto(r.created_at), ts: Date.parse(r.created_at),
        abrir: () => { set({ tab: 'mapa', hoja: { tipo: 'reporte', id: r.id } }); volarA(r.lng, r.lat, 16); },
      });
    }
    out.sort((a, b) => b.ts - a.ts);
    // Obras vigentes: van justo después de lo más reciente
    const itemsObra: Item[] = obras.map((o) => ({
      key: `o${o.id}`, icon: 'construction', bg: '#FFF0E0', fg: '#F57C00', titulo: `Obra · ${o.nombre}`,
      sub: `${o.afectacion}${o.fin ? ` · hasta ~${fechaCorta(o.fin)}` : ''}`, t: o.inicio ? `desde ${fechaCorta(o.inicio)}` : 'en obra', ts: 0,
      abrir: () => { set({ tab: 'mapa', hoja: { tipo: 'obra', id: o.id }, obraDesvio: null }); },
    }));
    const k = out.findIndex((x) => Date.now() - x.ts > 30 * 60_000);
    out.splice(k === -1 ? out.length : k, 0, ...itemsObra);
    const p = pronosticoHorario();
    const pron: Item = { key: 'pron', icon: p.pesado ? 'trending_up' : 'trending_flat', bg: p.pesado ? '#FEF4E0' : '#E6F4EA', fg: p.pesado ? '#B06000' : '#137333', titulo: p.titulo, sub: p.sub, t: 'ahora', ts: Date.now() };
    // el pronóstico va después de lo que pasó en los últimos 10 min
    const i = out.findIndex((x) => Date.now() - x.ts > 10 * 60_000);
    out.splice(i === -1 ? out.length : i, 0, pron);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertas, incidentes, reportes, obras]);

  const resumir = async () => {
    setResumen({ cargando: true, texto: null });
    try {
      const r = await fetch('/api/resumen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hechos: hechosCiudad() }) });
      const j = await r.json();
      setResumen({ cargando: false, texto: j.texto || null });
    } catch {
      setResumen({ cargando: false, texto: '• No pudimos generar el resumen. Intenta de nuevo.' });
    }
  };

  return (
    <div className="absolute inset-x-0 top-0 z-30 mx-auto flex w-full max-w-[480px] animate-fade-in flex-col bg-surface" style={{ bottom: ALTO_NAV_CSS }}>
      <div className="flex items-center justify-between bg-white px-4 pb-3.5 pt-[max(14px,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-extrabold tracking-[-0.4px]">Qué pasa en CUU</h1>
        <button onClick={resumir} disabled={resumen.cargando} className="flex h-9 items-center gap-1.5 rounded-full bg-[#ECEEFF] pl-2.5 pr-3.5 text-[13px] font-bold text-primary active:scale-95 disabled:opacity-60">
          <Icon name={resumen.cargando ? 'progress_activity' : 'auto_awesome'} size={18} fill className={resumen.cargando ? 'animate-spin' : ''} /> Resumen
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3.5">
        {resumen.texto && (
          <div className="mb-2 rounded-2xl border border-[#D5DBFF] bg-white p-3.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-primary"><Icon name="auto_awesome" size={16} fill /> Resumen de la ciudad</span>
              <button aria-label="Cerrar resumen" onClick={() => setResumen({ cargando: false, texto: null })} className="text-ink-2"><Icon name="close" size={18} /></button>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{resumen.texto}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {items.map((f) => (
            <button key={f.key} onClick={f.abrir} disabled={!f.abrir}
              className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-left shadow-[0_1px_4px_rgba(0,0,0,.04)] active:bg-surface disabled:active:bg-white">
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]" style={{ background: f.bg, color: f.fg }}>
                <Icon name={f.icon} size={21} fill />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">{f.titulo}</span>
                {f.sub && <span className="mt-0.5 block truncate text-[12.5px] text-ink-2">{f.sub}</span>}
              </span>
              <span className="shrink-0 self-start whitespace-nowrap pt-0.5 text-[11.5px] text-ink-2">{f.t}</span>
            </button>
          ))}
        </div>
        {items.length <= 1 && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-ink-2">
            <Icon name="notifications" size={36} className="text-[#D5DAE0]" />
            Todo tranquilo por ahora. Aquí verás choques, desvíos, reportes y avisos en cuanto pasen.
          </div>
        )}
      </div>
    </div>
  );
}
