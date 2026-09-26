'use client';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { LayerChips } from './LayerChips';
import { LivePill } from './LivePill';
import { Icon } from './ui/Icon';

export function TopBar() {
  const set = useApp((s) => s.set);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto w-full max-w-[480px] bg-gradient-to-b from-[#F1F0EC]/80 to-transparent pt-[max(12px,env(safe-area-inset-top))]">
      <div className="px-3">
        <div className="pointer-events-auto flex h-[52px] items-center gap-3 rounded-full bg-white pl-[18px] pr-2 shadow-float">
          <button className="flex flex-1 items-center gap-3 text-left" onClick={() => set({ busquedaAbierta: true })}>
            <Icon name="search" className="text-ink-2" />
            <span className="text-base text-ink-2">¿A dónde vas?</span>
          </button>
          <button
            aria-label="Copiloto de voz"
            onClick={() => set({ flujo: 'copiloto' })}
            className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-surface active:scale-95"
          >
            <Icon name="mic" fill />
          </button>
          <Link href="/demo" className="flex h-9 w-9 items-center justify-center rounded-full bg-futuro text-[15px] font-bold text-white transition hover:scale-105 active:scale-95" title="Abrir panel Admin">
            A
          </Link>
        </div>
      </div>
      <LayerChips />
      <div className="mt-3 px-3">
        <LivePill />
      </div>
    </div>
  );
}
