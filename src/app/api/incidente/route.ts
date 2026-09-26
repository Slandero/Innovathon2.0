import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crearIncidente } from '@/lib/server/ciudad';

export const dynamic = 'force-dynamic';

/**
 * Flujo F1 (incidente). Lo usan el copiloto de voz, el botón secreto y los reportes graves.
 * Con N8N_WEBHOOK_BASE lo orquesta n8n; si no, la app hace lo mismo directo.
 */
const Entrada = z.object({
  origen: z.enum(['voz', 'boton_secreto', 'anomalia_celda', 'reporte', 'demo']).default('voz'),
  texto: z.string().max(500).optional(),
  tipo: z.enum(['accidente', 'congestion', 'cierre', 'obra', 'peligro', 'evento', 'otro']).optional(),
  calle: z.string().max(120).nullish(),
  carril: z.number().int().min(1).max(8).nullish(),
  carriles_totales: z.number().int().min(1).max(8).optional(),
  carriles_bloqueados: z.array(z.number().int().min(1).max(8)).optional(),
  severidad: z.number().int().min(1).max(5).nullish(),
  lat: z.number().min(28.4).max(28.9).nullish(),
  lng: z.number().min(-106.4).max(-105.8).nullish(),
  usuario: z.object({ nombre: z.string().max(60).optional(), eta_destino_min: z.number().nullish() }).optional(),
});

export async function POST(req: Request) {
  const p = Entrada.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, error: 'Datos inválidos', eventos: [], persistido: false }, { status: 400 });
  return NextResponse.json(await crearIncidente(p.data));
}
