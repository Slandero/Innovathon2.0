import { colorOcupacion } from '@/lib/data/camiones';

export function BarraOcupacion({ pct, alto = 8, fondo = '#ECEEF1' }: { pct: number; alto?: number; fondo?: string }) {
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height: alto, background: fondo }}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, pct)}%`, background: colorOcupacion(pct) }} />
    </div>
  );
}

/** Cuadro de la ruta con su número (R2 → "2"). */
export function InsigniaRuta({ id, color, tam = 40, radio = 12, texto = 15 }: { id: string; color: string; tam?: number; radio?: number; texto?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center font-extrabold text-white" style={{ width: tam, height: tam, borderRadius: radio, background: color, fontSize: texto }}>
      {/^R\d+$/i.test(id) ? id.slice(1) : id}
    </span>
  );
}

/** "Ruta 2 · Centro – Tec" → "Centro – Tec" */
export const nombreCorto = (nombre: string) => nombre.split('·')[1]?.trim() || nombre;
