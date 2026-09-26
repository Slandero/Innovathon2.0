import { NextResponse } from 'next/server';
import { resumirCiudad } from '@/lib/server/resumen';

export const dynamic = 'force-dynamic';

/** Resumen de "Qué pasa en CUU" (solo para quien lo pide; no se publica en el feed). */
export async function POST(req: Request) {
  const { hechos } = (await req.json().catch(() => ({}))) as { hechos?: string };
  return NextResponse.json({ ok: true, texto: await resumirCiudad(String(hechos || '').slice(0, 4000)) });
}
