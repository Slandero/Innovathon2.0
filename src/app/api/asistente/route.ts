import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hayClaude, preguntarClaude } from '@/lib/server/claude';

export const dynamic = 'force-dynamic';

/**
 * Asistente de texto. El cliente ya resolvió las herramientas (camiones, rutas, tráfico) y manda
 * los `hechos` en vivo; Claude solo redacta la respuesta. Sin llave, regresa texto null y el
 * cliente usa su respuesta armada con reglas.
 */
const Entrada = z.object({
  pregunta: z.string().min(1).max(500),
  historial: z.array(z.object({ rol: z.enum(['usuario', 'asistente']), texto: z.string().max(1200) })).max(12).default([]),
  hechos: z.string().max(6000).default(''),
});

const SYSTEM = `Eres ViveCUU, el asistente de movilidad de Chihuahua, México.
Contestas corto (máx. 2-3 oraciones), claro y en español mexicano cercano.
Usa solo los datos en vivo que te doy; si no sabes algo, dilo. Da una recomendación accionable.
El 911 en esta app es siempre simulado: si hay una emergencia, sugiere el botón SOS y llamar al 911 desde su teléfono.`;

export async function POST(req: Request) {
  const p = Entrada.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, texto: null }, { status: 400 });
  if (!hayClaude()) return NextResponse.json({ ok: true, texto: null });
  const { pregunta, historial, hechos } = p.data;
  const conv = historial.map((m) => `${m.rol === 'usuario' ? 'Usuario' : 'ViveCUU'}: ${m.texto}`).join('\n');
  const texto = await preguntarClaude({
    system: SYSTEM,
    texto: `Datos en vivo de la ciudad:\n${hechos || '(sin datos)'}\n\n${conv ? `Conversación previa:\n${conv}\n\n` : ''}Pregunta: ${pregunta}`,
    maxTokens: 500,
    timeoutMs: 15_000,
  });
  return NextResponse.json({ ok: true, texto });
}
