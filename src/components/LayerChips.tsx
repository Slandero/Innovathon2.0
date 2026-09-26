'use client';
import { useApp, type Capa } from '@/lib/store';
import { Icon } from './ui/Icon';

const CHIPS: { id: Capa; label: string; icon: string }[] = [
  { id: 'trafico', label: 'Tráfico', icon: 'speed' },
  { id: 'camiones', label: 'Camiones', icon: 'directions_bus' },
  { id: 'semaforos', label: 'Semáforos', icon: 'traffic' },
  { id: 'altos', label: 'Altos y topes', icon: 'report' },
  { id: 'escuelas', label: 'Escuelas', icon: 'school' },
  { id: 'obras', label: 'Obras', icon: 'construction' },
  { id: 'reportes', label: 'Reportes', icon: 'campaign' },
];

export function LayerChips() {
  const capas = useApp((s) => s.capas);
  const toggle = useApp((s) => s.toggleCapa);
  return (
    <div className="no-scrollbar pointer-events-auto mt-2.5 flex gap-2 overflow-x-auto px-3 pb-1">
      {CHIPS.map(({ id, label, icon }) => {
        const on = capas[id];
        return (
          <button
            key={id}
            onClick={() => toggle(id)}
            aria-pressed={on}
            className={`flex h-[34px] shrink-0 items-center gap-1.5 rounded-full pl-2.5 pr-3.5 text-sm shadow-[0_2px_8px_rgba(0,0,0,.08)] transition-colors active:scale-95 ${
              on ? 'bg-[#ECEEFF] font-semibold text-primary' : 'bg-white font-medium text-ink'
            }`}
          >
            <Icon name={icon} size={18} fill={on} className={on ? '' : 'text-ink-2'} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
