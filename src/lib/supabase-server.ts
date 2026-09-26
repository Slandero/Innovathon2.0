import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cliente: SupabaseClient | null | undefined;

/** Cliente con service role. SOLO servidor (API routes). */
export function supabaseAdmin(): SupabaseClient | null {
  if (cliente !== undefined) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cliente = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cliente;
}

/** POST a un webhook de n8n. Devuelve null si no hay N8N_WEBHOOK_BASE o si falla. */
export async function llamarN8n<T = unknown>(ruta: string, cuerpo: unknown, timeoutMs = 20000): Promise<T | null> {
  const base = process.env.N8N_WEBHOOK_BASE;
  if (!base) return null;
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/${ruta.replace(/^\//, '')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return null;
    const txt = await r.text();
    return (txt ? JSON.parse(txt) : {}) as T;
  } catch {
    return null;
  }
}
