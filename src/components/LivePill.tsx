'use client';
import { useApp } from '@/lib/store';

export function LivePill() {
  const n = useApp((s) => s.nVehiculos);
  const vivo = useApp((s) => s.motorVivo || (s.simLocal && s.nVehiculos > 0));
  const temp = useApp((s) => s.temperatura);
  return (
    <div className="pointer-events-auto inline-flex h-[30px] items-center gap-[7px] rounded-full bg-white px-3 text-[12.5px] font-semibold text-ink shadow-float">
      <span className={`h-2 w-2 rounded-full ${vivo ? 'bg-traffic-free shadow-[0_0_0_3px_rgba(52,168,83,.2)]' : 'bg-gray-400'}`} />
      {vivo ? <>En vivo · {n} vehículos</> : <>Semáforos en vivo</>}
      {temp != null && <> · {temp} °C</>}
    </div>
  );
}
