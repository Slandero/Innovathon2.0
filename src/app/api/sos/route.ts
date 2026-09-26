import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crearAlertas, crearEmergencia, db, folio, respuesta } from '@/lib/server/ciudad';

export const dynamic = 'force-dynamic';

/**
 * SOS. El 911 es SIEMPRE simulado: nunca se marca ni se manda nada a números reales.
 *  - crear: registra la emergencia (el motor o la app despachan la unidad con ola verde)
 *  - llamar911: deja constancia de la llamada simulada
 *  - cancelar: cancela la emergencia
 */
const Entrada = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('crear'), tipo: z.enum(['ambulancia', 'bomberos', 'policia']), lat: z.number().min(28.4).max(28.9), lng: z.number().min(-106.4).max(-105.8) }),
  z.object({ accion: z.literal('llamar911'), id: z.number() }),
  z.object({ accion: z.literal('cancelar'), id: z.number() }),
]);

export async function POST(req: Request) {
  const p = Entrada.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, error: 'Datos inválidos', eventos: [], persistido: false }, { status: 400 });
  const e = p.data;

  if (e.accion === 'crear') return NextResponse.json(await crearEmergencia(e.tipo, e.lat, e.lng));

  if (e.accion === 'llamar911') {
    const f = folio();
    const a = await crearAlertas([{ tipo: '911_simulado', titulo: 'Llamada al 911 (simulada)', mensaje: `Folio ${f} · te enlazamos con la operadora`, payload: { emergencia_id: e.id }, incidente_id: null }]);
    return NextResponse.json(respuesta(a.persistido, a.eventos, { mensaje: f }));
  }

  const sb = db();
  if (sb) {
    const { error } = await sb.from('emergencias').update({ estado: 'cancelada' }).eq('id', e.id);
    if (!error) return NextResponse.json(respuesta(true, []));
  }
  return NextResponse.json(respuesta(false, []));
}
