import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const MODELO = 'claude-opus-5';
let cliente: Anthropic | null | undefined;

function claude(): Anthropic | null {
  if (cliente !== undefined) return cliente;
  cliente = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  return cliente;
}

export const hayClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);

/**
 * Una llamada corta a Claude. Devuelve el texto, o null si no hay llave, falla o se niega:
 * quien llama siempre tiene un respaldo por reglas.
 */
export async function preguntarClaude(o: {
  system: string;
  texto: string;
  imagen?: { base64: string; tipo: 'image/jpeg' | 'image/png' | 'image/webp' };
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string | null> {
  const c = claude();
  if (!c) return null;
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (o.imagen) content.push({ type: 'image', source: { type: 'base64', media_type: o.imagen.tipo, data: o.imagen.base64 } });
  content.push({ type: 'text', text: o.texto });
  try {
    // fallbacks "default": si el modelo se niega por política, el servidor reintenta con otro modelo
    const r = await c.beta.messages.create(
      {
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        model: MODELO,
        max_tokens: o.maxTokens ?? 1024,
        output_config: { effort: 'low' },
        system: o.system,
        messages: [{ role: 'user', content }],
      },
      { timeout: o.timeoutMs ?? 20_000, maxRetries: 1 },
    );
    if (r.stop_reason === 'refusal') return null;
    const texto = r.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    return texto || null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.warn('[claude]', e.status, e.message);
    else console.warn('[claude]', e);
    return null;
  }
}

/** Extrae el primer objeto JSON del texto de Claude. */
export function extraerJson<T>(texto: string | null): T | null {
  if (!texto) return null;
  const i = texto.indexOf('{');
  const f = texto.lastIndexOf('}');
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(texto.slice(i, f + 1)) as T; } catch { return null; }
}
