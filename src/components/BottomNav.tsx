'use client';
import { useApp, type Tab } from '@/lib/store';
import { Icon } from './ui/Icon';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'mapa', label: 'Mapa', icon: 'map' },
  { id: 'camiones', label: 'Camiones', icon: 'directions_bus' },
  { id: 'quepasa', label: 'Qué pasa', icon: 'notifications' },
  { id: 'asistente', label: 'Asistente', icon: 'forum' },
];

export const ALTO_NAV = 72;
/** Alto real de la barra (incluye el área segura del iPhone). */
export const ALTO_NAV_CSS = 'calc(64px + max(8px, env(safe-area-inset-bottom)))';

export function BottomNav() {
  const tab = useApp((s) => s.tab);
  const set = useApp((s) => s.set);
  return (
    <nav className="absolute inset-x-0 bottom-0 z-40 border-t border-[#ECEEF1] bg-white pb-[max(8px,env(safe-area-inset-bottom))]">
      <div className="mx-auto grid h-16 max-w-[480px] grid-cols-4 px-2 pt-2">
        {TABS.map(({ id, label, icon }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              onClick={() => set({ tab: id, hoja: null, rutaCamionSel: id === 'camiones' ? useApp.getState().rutaCamionSel : null })}
              className={`flex flex-col items-center gap-1 text-xs ${on ? 'font-bold text-primary' : 'font-medium text-ink-2'}`}
            >
              <span className={`flex h-[30px] w-14 items-center justify-center rounded-full transition-colors ${on ? 'bg-[#ECEEFF]' : ''}`}>
                <Icon name={icon} size={22} fill={on} />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
