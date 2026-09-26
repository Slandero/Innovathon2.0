'use client';
import { useState } from 'react';
import { haceTexto } from '@/lib/hechos';
import { llamarCiudad } from '@/lib/local/aplicar';
import { useApp } from '@/lib/store';
import { ICONO_TIPO } from '../flows/ReportarFlow';
import { BottomSheet } from '../ui/BottomSheet';
import { Icon } from '../ui/Icon';

export const DEPENDENCIA: Record<string, string> = {
  municipio: 'Municipio', transito: 'Tránsito', jmas: 'JMAS', cfe: 'CFE', ninguna: 'Sin asignar',
};

/** Hoja de un reporte ciudadano: foto, resumen de la IA, severidad, dependencia y "sigue ahí". */
export function ReporteSheet({ id }: { id: number }) {
  const r = useApp((s) => s.reportes.find((x) => x.id === id));
  const set = useApp((s) => s.set);
  const toast = useApp((s) => s.toast);
  const [votado, setVotado] = useState(false);
  if (!r) return null;
  const t = ICONO_TIPO[r.tipo || 'otro'] || ICONO_TIPO.otro;
  const sev = r.severidad ?? 2;
  const colorSev = sev >= 4 ? '#E37400' : sev === 3 ? '#FBBC04' : '#34A853';

  const votar = async () => {
    setVotado(true);
    const res = await llamarCiudad(`/api/reportes/${id}/voto`, { votos: r.votos });
    if (res?.ok) toast({ tipo: 'ok', titulo: 'Sumaste tu voto', texto: 'Entre más votos, más rápido lo atienden.' });
    else { setVotado(false); toast({ tipo: 'info', titulo: 'No se pudo registrar tu voto' }); }
  };

  return (
    <BottomSheet sinCerrar alto="80vh">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface">
            <Icon name={t.icon} size={26} fill style={{ color: t.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[21px] font-bold leading-tight tracking-[-0.3px]">{r.titulo || t.nombre}</h2>
            <p className="mt-0.5 text-[13px] text-ink-2">{t.nombre} · hace {haceTexto(r.created_at)} · {r.votos} voto{r.votos === 1 ? '' : 's'}</p>
          </div>
          <button aria-label="Cerrar" onClick={() => set({ hoja: null })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface active:scale-95">
            <Icon name="close" size={20} />
          </button>
        </div>
        {r.foto_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.foto_url} alt={r.titulo || 'Foto del reporte'} className="h-40 w-full rounded-2xl object-cover" />
        )}
        {r.resumen_ia && (
          <p className="flex gap-2 text-sm text-ink-2"><Icon name="auto_awesome" size={18} fill className="mt-px text-brand" />{r.resumen_ia}</p>
        )}
        <div className="overflow-hidden rounded-[20px] border border-[#E1E4E8]">
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm text-ink-2">Severidad</span>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <span key={n} className="h-2 w-[18px] rounded" style={{ background: n <= sev ? colorSev : '#ECEEF1' }} />)}</div>
              <span className="text-[15px] font-bold">{sev}/5</span>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[#ECEEF1] px-4 py-3.5">
            <span className="text-sm text-ink-2">Le toca a:</span>
            <span className="text-[15px] font-bold">{DEPENDENCIA[r.dependencia || 'ninguna']}</span>
          </div>
        </div>
        <button disabled={votado} onClick={votar}
          className="flex h-[52px] items-center justify-center gap-1.5 rounded-full bg-primary text-[15px] font-bold text-white active:scale-[.98] disabled:opacity-60">
          <Icon name="thumb_up" size={20} fill /> Sigue ahí ({r.votos})
        </button>
      </div>
    </BottomSheet>
  );
}
