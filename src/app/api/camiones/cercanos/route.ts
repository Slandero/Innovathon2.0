import { NextResponse } from 'next/server';
import { CENTRO_CUU } from '@/lib/config';
import { fraseSugerencia, paradaMasCercana, proximasLlegadas, sugerirRutas } from '@/lib/data/camiones';
import { geocodificar } from '@/lib/geocode-server';
import { supabaseAdmin } from '@/lib/supabase-server';
import type { Camion, RutaCamion } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Herramienta buscar_camion del copiloto.
 * GET /api/camiones/cercanos?destino=Centro&lat=28.64&lng=-106.08 → { texto, ... }
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get('lat')) || CENTRO_CUU.lat;
  const lng = Number(u.searchParams.get('lng')) || CENTRO_CUU.lng;
  const destino = (u.searchParams.get('destino') || '').trim();

  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ texto: 'Ahorita no tengo datos de camiones, intenta en un momento.' });
  const [{ data: rutas }, { data: camiones }] = await Promise.all([
    sb.from('rutas_camion').select('*'),
    sb.from('camiones').select('*'),
  ]);
  const R = (rutas || []) as RutaCamion[];
  const Cm = (camiones || []) as Camion[];
  if (!R.length) return NextResponse.json({ texto: 'Todavía no hay rutas de camión cargadas.' });

  if (destino) {
    const lugar = await geocodificar(destino, [lng, lat]);
    if (!lugar) return NextResponse.json({ texto: `No encontré "${destino}" en Chihuahua.` });
    let sug = sugerirRutas(R, Cm, [lng, lat], [lugar.lng, lugar.lat]);
    if (!sug.length) sug = sugerirRutas(R, Cm, [lng, lat], [lugar.lng, lugar.lat], 900);
    if (!sug.length) {
      return NextResponse.json({ texto: `Ninguna de nuestras rutas pasa cerca de ti y de ${lugar.nombre}. Te conviene ir en carro o combinar rutas.`, destino: lugar });
    }
    const s = sug[0];
    return NextResponse.json({
      texto: fraseSugerencia(s),
      destino: lugar,
      ruta: { id: s.ruta.id, nombre: s.ruta.nombre, color: s.ruta.color },
      parada: s.subir.parada, distancia_m: Math.round(s.subir.distancia_m),
      eta_min: s.llegada?.eta_min ?? null, ocupacion_pct: s.llegada?.pct ?? null,
      alternativas: sug.slice(1, 3).map((x) => x.ruta.nombre),
    });
  }

  const p = paradaMasCercana(R, lng, lat);
  if (!p) return NextResponse.json({ texto: 'No encontré paradas cerca.' });
  const ll = proximasLlegadas(p.ruta, p.parada, Cm);
  const nombre = p.ruta.nombre.split('·')[0].trim();
  const texto = ll[0]
    ? `Tu parada más cercana es ${p.parada.nombre}, a ${Math.round(p.distancia_m / 10) * 10} metros. La ${nombre} llega en ${ll[0].eta_min} minutos y viene ${ll[0].pct}% lleno.`
    : `Tu parada más cercana es ${p.parada.nombre}, a ${Math.round(p.distancia_m / 10) * 10} metros, de la ${nombre}.`;
  return NextResponse.json({ texto, ruta: { id: p.ruta.id, nombre: p.ruta.nombre }, parada: p.parada, llegadas: ll.slice(0, 2).map((x) => ({ id: x.camion.id, eta_min: x.eta_min, pct: x.pct })) });
}
