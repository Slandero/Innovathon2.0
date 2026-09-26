import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CENTRO_CUU } from '@/lib/config';
import { CALLES_DEMO, type EventoCiudad } from '@/lib/eventos';
import { crearAlertas, crearEmergencia, crearIncidente, db, respuesta } from '@/lib/server/ciudad';
import { resumirCiudad } from '@/lib/server/resumen';
import { llamarN8n } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Panel /demo ("botón secreto"). Sin n8n inserta incidentes y alertas directo en Supabase;
 * sin Supabase regresa los eventos para que las pestañas abiertas los apliquen.
 */
const Entrada = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('accidente'), calle: z.string().optional(), carril: z.number().int().min(1).max(4).optional(), lat: z.number().optional(), lng: z.number().optional() }),
  z.object({ accion: z.literal('congestion'), calle: z.string() }),
  z.object({ accion: z.literal('cerrar_via'), calle: z.string() }),
  z.object({ accion: z.literal('hora_pico'), activo: z.boolean() }),
  z.object({ accion: z.literal('sos'), lat: z.number().optional(), lng: z.number().optional() }),
  z.object({ accion: z.literal('resumen'), hechos: z.string().max(4000).optional() }),
  z.object({ accion: z.literal('limpiar') }),
]);

const calleDemo = (nombre: string) => CALLES_DEMO.find((c) => c.nombre === nombre) || CALLES_DEMO[0];

export async function POST(req: Request) {
  const p = Entrada.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, error: 'Datos inválidos', eventos: [], persistido: false }, { status: 400 });
  const e = p.data;
  const sb = db();

  switch (e.accion) {
    case 'accidente': {
      let lat = e.lat;
      let lng = e.lng;
      let nombreCalle = 'Ubicación seleccionada (Pin)';
      let carriles_totales = 2;
      let carril = e.carril || 1;
      
      if (!lat || !lng) {
        const c = calleDemo(e.calle || '');
        lat = c.lat;
        lng = c.lng;
        nombreCalle = c.nombre;
        carriles_totales = c.carriles;
        carril = Math.min(e.carril || 1, c.carriles);
      }
      
      const r = await crearIncidente({
        origen: 'boton_secreto', texto: `Choque en ${nombreCalle}`, tipo: 'accidente', severidad: 5,
        calle: nombreCalle, carril, carriles_totales, lat, lng,
      });
      return NextResponse.json({ ...r, mensaje: r.mensaje_voz });
    }
    case 'congestion': {
      const c = calleDemo(e.calle);
      if (sb) {
        const hasta = new Date(Date.now() + 10 * 60_000).toISOString();
        await sb.from('sim_control').update({ congelar: { lat: c.lat, lng: c.lng, radio_m: 150, hasta }, updated_at: new Date().toISOString() }).eq('id', 1);
      }
      const r = await crearIncidente({
        origen: 'anomalia_celda', texto: `Tráfico detenido en ${c.nombre}`, tipo: 'congestion', severidad: 3,
        calle: c.nombre, carriles_totales: c.carriles, carriles_bloqueados: [], lat: c.lat, lng: c.lng,
      });
      return NextResponse.json({ ...r, mensaje: `Congestión total en ${c.nombre}` });
    }
    case 'cerrar_via': {
      const c = calleDemo(e.calle);
      const r = await crearIncidente({
        origen: 'demo', texto: `Cierre total de ${c.nombre}`, tipo: 'cierre', severidad: 4,
        calle: c.nombre, carriles_totales: c.carriles, lat: c.lat + 0.004, lng: c.lng + 0.003,
      });
      return NextResponse.json({ ...r, mensaje: `${c.nombre} cerrada` });
    }
    case 'hora_pico': {
      let persistido = false;
      if (sb) persistido = !(await sb.from('sim_control').update({ hora_pico: e.activo, updated_at: new Date().toISOString() }).eq('id', 1)).error;
      // el tráfico de hora pico se pinta local si no hay motor (el cliente decide)
      return NextResponse.json(respuesta(persistido, [{ t: 'hora_pico', activo: e.activo }], { mensaje: e.activo ? 'Hora pico activada' : 'Hora pico desactivada' }));
    }
    case 'sos': {
      const r = await crearEmergencia('ambulancia', e.lat ?? CENTRO_CUU.lat, e.lng ?? CENTRO_CUU.lng, true);
      return NextResponse.json({ ...r, mensaje: `SOS de prueba · ${r.folio}` });
    }
    case 'resumen': {
      // F3 de n8n si existe; si no, Claude/reglas y se publica en el feed
      if (sb && (await llamarN8n('vivecuu/resumen', {}))) return NextResponse.json(respuesta(true, [], { mensaje: 'Resumen pedido a n8n' }));
      const texto = await resumirCiudad(e.hechos || '');
      const a = await crearAlertas([{ tipo: 'resumen', titulo: 'Resumen de la ciudad', mensaje: texto, payload: null, incidente_id: null }]);
      return NextResponse.json(respuesta(a.persistido, a.eventos, { mensaje: texto }));
    }
    case 'limpiar': {
      let persistido = false;
      if (sb) {
        const ahora = new Date().toISOString();
        const rs = await Promise.all([
          sb.from('incidentes').update({ estado: 'resuelto', fin: ahora }).eq('estado', 'activo'),
          sb.from('emergencias').update({ estado: 'cancelada' }).in('estado', ['solicitada', 'en_camino']),
          sb.from('sim_control').update({ congelar: null, hora_pico: false, updated_at: ahora }).eq('id', 1),
          sb.from('overrides_semaforo').delete().gte('osm_id', 0),
          sb.from('alertas').delete().gte('id', 0),
        ]);
        persistido = rs.every((r) => !r.error);
      }
      const eventos: EventoCiudad[] = [{ t: 'limpiar' }];
      return NextResponse.json(respuesta(persistido, eventos, { mensaje: 'Ciudad limpia' }));
    }
  }
}
