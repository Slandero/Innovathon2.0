import { NextResponse } from 'next/server';
import { db, respuesta } from '@/lib/server/ciudad';

export const dynamic = 'force-dynamic';

/** Suma un voto a un reporte ("sigue ahí"). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: 'Id inválido' }, { status: 400 });
  const cuerpo = (await req.json().catch(() => ({}))) as { votos?: number };

  const sb = db();
  if (sb) {
    const { error } = await sb.rpc('votar_reporte', { p_id: id });
    if (!error) return NextResponse.json(respuesta(true, []));
    console.warn('[voto reporte]', error.message);
  }
  const votos = (Number(cuerpo.votos) || 1) + 1;
  return NextResponse.json(respuesta(false, [{ t: 'voto_reporte', id, votos }]));
}
