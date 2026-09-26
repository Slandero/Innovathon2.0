import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, respuesta } from '@/lib/server/ciudad';
import type { EventoCiudad } from '@/lib/eventos';

export const dynamic = 'force-dynamic';

/** "Sigue ahí" suma un voto; con 3 votos de "Ya no está" (netos) el incidente se resuelve. */
const Entrada = z.object({ accion: z.enum(['sigue', 'ya_no']), votos: z.number().int().min(0).optional() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const p = Entrada.safeParse(await req.json().catch(() => null));
  if (!Number.isFinite(id) || !p.success) return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 });
  const { accion } = p.data;

  const sb = db();
  if (sb) {
    const { data } = await sb.from('incidentes').select('id, votos').eq('id', id).maybeSingle();
    if (data) {
      const votos = Math.max(0, (data.votos ?? 1) + (accion === 'sigue' ? 1 : -1));
      const cambio = votos === 0 ? { votos, estado: 'resuelto', fin: new Date().toISOString() } : { votos };
      const { error } = await sb.from('incidentes').update(cambio).eq('id', id);
      if (!error) return NextResponse.json(respuesta(true, [], { mensaje: votos === 0 ? 'resuelto' : undefined }));
    }
  }
  // Modo local: el cliente manda los votos que conoce
  const votos = Math.max(0, (p.data.votos ?? 1) + (accion === 'sigue' ? 1 : -1));
  const eventos: EventoCiudad[] = votos === 0 ? [{ t: 'resolver_incidentes', ids: [id] }] : [{ t: 'voto_incidente', id, votos }];
  return NextResponse.json(respuesta(false, eventos, { mensaje: votos === 0 ? 'resuelto' : undefined }));
}
