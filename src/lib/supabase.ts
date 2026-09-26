import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Cliente de navegador (anon). null si no hay llaves: la UI usa respaldos. */
export const supabase: SupabaseClient | null =
  url && anon
    ? createClient(url, anon, {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 30 } },
      })
    : null;
