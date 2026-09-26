'use client';
import { useEffect } from 'react';
import { useApp } from '@/lib/store';
import { getMapa, volarA } from '@/lib/map/instancia';

/** watchPosition de alta precisión; al primer fix hace flyTo zoom 15. */
export function useUbicacion() {
  useEffect(() => {
    const { set, toast } = useApp.getState();
    if (!('geolocation' in navigator)) {
      set({ permiso: 'no' });
      return;
    }
    let primero = true;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const { heading, latitude, longitude, accuracy } = p.coords;
        const prev = useApp.getState().ubicacion;
        set({
          permiso: 'si',
          ubicacion: { lng: longitude, lat: latitude, heading: heading ?? prev?.heading ?? null, precision: accuracy },
        });
        if (primero) {
          primero = false;
          // Espera a que el mapa exista
          const intentar = (n: number) => {
            if (useApp.getState().navegando) return;
            if (getMapa()) volarA(longitude, latitude, 15);
            else if (n > 0) setTimeout(() => intentar(n - 1), 400);
          };
          intentar(15);
        }
      },
      () => {
        set({ permiso: 'no' });
        toast({ tipo: 'info', titulo: 'Activa tu ubicación para rutas', texto: 'Mientras, te mostramos el Centro de Chihuahua.' });
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );

    // Brújula del teléfono para el cono de dirección
    const onOrient = (e: DeviceOrientationEvent) => {
      const w = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
      const h = w.webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null);
      const u = useApp.getState().ubicacion;
      if (h != null && u && Math.abs((u.heading ?? 0) - h) > 4) set({ ubicacion: { ...u, heading: h } });
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => {
      navigator.geolocation.clearWatch(id);
      window.removeEventListener('deviceorientation', onOrient);
    };
  }, []);
}
