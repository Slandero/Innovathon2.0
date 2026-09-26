'use client';
import { Marker } from 'react-map-gl';
import { useApp } from '@/lib/store';

/** Punto azul con halo y cono de dirección (heading). */
export function UserMarker() {
  const pos = useApp((s) => s.posSim ?? s.ubicacion);
  const navegando = useApp((s) => s.navegando);
  if (!pos) return null;
  const conCono = pos.heading != null && !Number.isNaN(pos.heading);
  return (
    <Marker longitude={pos.lng} latitude={pos.lat} anchor="center" rotationAlignment="map" pitchAlignment="map" rotation={pos.heading ?? 0} style={{ zIndex: 5 }}>
      <div className="relative h-16 w-16 pointer-events-none">
        {conCono && (
          <div
            className="absolute left-1/2 top-0 -translate-x-1/2"
            style={{
              width: 0, height: 0,
              borderLeft: '18px solid transparent', borderRight: '18px solid transparent',
              borderBottom: '32px solid rgba(61,90,254,.28)',
              filter: 'blur(1px)',
            }}
          />
        )}
        {!navegando && <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/40 animate-pulso" />}
        <div className="absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-primary shadow-[0_1px_6px_rgba(0,0,0,.35)]" />
      </div>
    </Marker>
  );
}
