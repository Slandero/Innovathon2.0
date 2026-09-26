import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * Ingesta de sensores de conteo de pasajeros (APC). Mismo contrato para los camiones
 * virtuales del motor y para un ESP32 real:
 *   POST /api/iot/ingest   x-iot-token: <token>
 *   {"device_id":"esp32-01","camion_id":"R1-01","suben":1,"bajan":0}
 */
const Lectura = z.object({
  device_id: z.string().min(1).max(64),
  camion_id: z.string().min(1).max(32),
  ruta_id: z.string().max(16).optional(),
  suben: z.number().int().min(0).max(200).default(0),
  bajan: z.number().int().min(0).max(200).default(0),
  ocupacion: z.number().int().min(0).max(300).optional(),
  capacidad: z.number().int().min(1).max(300).optional(),
  lat: z.number().min(28.4).max(28.9).optional(),
  lng: z.number().min(-106.4).max(-105.8).optional(),
  heading: z.number().min(0).max(360).optional(),
  proxima_parada: z.string().max(120).optional(),
  eta_min: z.number().int().min(0).max(240).optional(),
  ts: z.string().optional(),
});

export async function POST(req: Request) {
  const token = process.env.IOT_INGEST_TOKEN;
  if (token && req.headers.get('x-iot-token') !== token) {
    return NextResponse.json({ ok: false, error: 'token inválido' }, { status: 401 });
  }
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }
  const p = Lectura.safeParse(cuerpo);
  if (!p.success) return NextResponse.json({ ok: false, error: p.error.flatten() }, { status: 422 });
  const l = p.data;

  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase no configurado' }, { status: 503 });

  // Si el sensor solo manda suben/bajan (ESP32), la ocupación se acumula sobre la última conocida
  let ocupacion = l.ocupacion;
  let ruta_id = l.ruta_id;
  if (ocupacion === undefined || !ruta_id) {
    const { data } = await sb.from('camiones').select('ocupacion, ruta_id').eq('id', l.camion_id).maybeSingle();
    ocupacion ??= Math.max(0, (data?.ocupacion ?? 0) + l.suben - l.bajan);
    ruta_id ??= data?.ruta_id ?? undefined;
  }

  const fila: Record<string, unknown> = {
    id: l.camion_id,
    ocupacion,
    fuente: l.device_id.startsWith('apc-') ? 'sim' : 'iot',
    updated_at: new Date().toISOString(),
  };
  if (ruta_id) fila.ruta_id = ruta_id;
  if (l.capacidad) fila.capacidad = l.capacidad;
  if (l.lat !== undefined && l.lng !== undefined) { fila.lat = l.lat; fila.lng = l.lng; }
  if (l.heading !== undefined) fila.heading = l.heading;
  if (l.proxima_parada) fila.proxima_parada = l.proxima_parada;
  if (l.eta_min !== undefined) fila.eta_min = l.eta_min;

  const up = await sb.from('camiones').upsert(fila, { onConflict: 'id' });
  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  const ins = await sb.from('lecturas_iot').insert({
    device_id: l.device_id, camion_id: l.camion_id, suben: l.suben, bajan: l.bajan, ocupacion,
    lat: l.lat, lng: l.lng, ts: l.ts || new Date().toISOString(),
  });
  if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ocupacion });
}
