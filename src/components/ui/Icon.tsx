import type { CSSProperties } from 'react';

/** Ícono Material Symbols Rounded (el mismo set del diseño de Claude Design). */
export function Icon({
  name, size = 24, fill = false, weight, className = '', style,
}: { name: string; size?: number; fill?: boolean; weight?: number; className?: string; style?: CSSProperties }) {
  const fvs = [`'FILL' ${fill ? 1 : 0}`, weight ? `'wght' ${weight}` : null].filter(Boolean).join(', ');
  return (
    <span
      aria-hidden
      className={`material-symbols-rounded inline-block shrink-0 select-none leading-none ${className}`}
      style={{ fontSize: size, width: size, height: size, fontVariationSettings: fvs, ...style }}
    >
      {name}
    </span>
  );
}
