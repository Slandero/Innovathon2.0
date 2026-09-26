'use client';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

/** Hoja inferior redondeada con animación de entrada. */
export function BottomSheet({
  children, onClose, className = '', sinCerrar = false, alto,
}: { children: ReactNode; onClose?: () => void; className?: string; sinCerrar?: boolean; alto?: string }) {
  return (
    <div
      className={`pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] animate-slide-up rounded-t-[24px] bg-white shadow-[0_-4px_20px_rgba(0,0,0,.10)] ${className}`}
      style={alto ? { maxHeight: alto } : undefined}
    >
      <div className="flex justify-center pt-2.5">
        <div className="h-1 w-10 rounded-full bg-[#D5DAE0]" />
      </div>
      {!sinCerrar && onClose && (
        <button onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-2 active:scale-95">
          <Icon name="close" size={20} />
        </button>
      )}
      <div className="overflow-y-auto overscroll-contain px-5 pb-[max(34px,env(safe-area-inset-bottom))] pt-3.5" style={alto ? { maxHeight: `calc(${alto} - 20px)` } : undefined}>
        {children}
      </div>
    </div>
  );
}
