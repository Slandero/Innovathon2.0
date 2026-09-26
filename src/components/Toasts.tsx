'use client';
import { useApp, type Toast } from '@/lib/store';
import { Icon } from './ui/Icon';

/** Estilo de tarjeta por tipo (frame 08 · Alertas de n8n). */
const ESTILO: Record<Toast['tipo'], { caja: string; icon: string }> = {
  sos: { caja: 'bg-sos text-white', icon: 'emergency' },
  familiar: { caja: 'bg-[#ECEEFF] text-primary', icon: 'sms' },
  desvio: { caja: 'bg-primary text-white', icon: 'alt_route' },
  dependencia: { caja: 'bg-[#F1EDFF] text-brand', icon: 'send' },
  ok: { caja: 'bg-[#E6F4EA] text-[#188038]', icon: 'check_circle' },
  info: { caja: 'bg-surface text-ink-2', icon: 'info' },
};

export function Toasts({ top }: { top?: number | string }) {
  const toasts = useApp((s) => s.toasts);
  const quitar = useApp((s) => s.quitarToast);
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-[60] mx-auto flex w-full max-w-[480px] flex-col gap-2 px-3"
      style={{ top: top ?? 'calc(max(6px, env(safe-area-inset-top)) + 6px)' }}
    >
      {toasts.map((t) => {
        const { caja, icon } = ESTILO[t.tipo];
        return (
          <button key={t.id} onClick={() => quitar(t.id)} className="pointer-events-auto flex animate-toast-in items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-left shadow-[0_6px_20px_rgba(0,0,0,.12)]">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${caja}`}>
              <Icon name={icon} size={22} fill className={t.tipo === 'sos' ? 'animate-pulse' : ''} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-ink">{t.titulo}</span>
              {t.texto && <span className="mt-0.5 block text-[13px] text-ink-2">{t.texto}</span>}
            </span>
            <span className="shrink-0 self-start pt-0.5 text-xs text-ink-2">ahora</span>
          </button>
        );
      })}
    </div>
  );
}
