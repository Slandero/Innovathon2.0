'use client';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';

export function Splash() {
  const [fase, setFase] = useState<'visible' | 'saliendo' | 'fuera'>('visible');
  const [progreso, setProgreso] = useState(8);
  useEffect(() => {
    const p = setTimeout(() => setProgreso(100), 30);
    const a = setTimeout(() => setFase('saliendo'), 1100);
    const b = setTimeout(() => setFase('fuera'), 1450);
    return () => { clearTimeout(p); clearTimeout(a); clearTimeout(b); };
  }, []);
  if (fase === 'fuera') return null;
  return (
    <div className={`fixed inset-0 z-[100] bg-white transition-opacity duration-300 ${fase === 'saliendo' ? 'opacity-0' : 'opacity-100'}`}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5">
        <div className="flex h-[88px] w-[88px] items-center justify-center rounded-[26px] bg-futuro shadow-[0_10px_30px_rgba(124,92,255,.35)]">
          <Icon name="location_on" size={52} fill weight={600} className="text-white" />
        </div>
        <Logo className="mt-2 text-[44px] tracking-[-1.5px]" />
        <p className="text-[15px] text-ink-2">Chihuahua en vivo, en una sola app.</p>
      </div>
      <div className="absolute bottom-[72px] left-1/2 h-1 w-[120px] -translate-x-1/2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-futuro transition-[width] duration-1000 ease-out" style={{ width: `${progreso}%` }} />
      </div>
    </div>
  );
}
