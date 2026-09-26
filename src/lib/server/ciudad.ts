import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CENTRO_CUU } from '@/lib/config';
import { CALLES_DEMO, alternaDe, type EventoCiudad, type RespuestaCiudad } from '@/lib/eventos';
import { geocodificar } from '@/lib/geocode-server';
import { extraerJson, preguntarClaude } from '@/lib/server/claude';
import { llamarN8n, supabaseAdmin } from '@/lib/supabase-server';
import type { AlertaN8n, Emergencia, Incidente } from '@/lib/types';

/** Id para filas que no pasan por Supabase (modo local). */
let seq = 0;
export const idLocal = () => Math.floor(Date.now() / 100) % 1e9 * 10 + (seq++ % 10);

export const folio = () => `CUU-${new Date().toLocaleTimeString('es-MX', { hour12: false, timeZone: 'America/Chihuahua' }).replace(/:/g, '')}`;

/** El cliente solo puede confiar en Realtime si él también tiene Supabase. */
const clienteConSupabase = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const db = () => (clienteConSupabase() ? supabaseAdmin() : null);

export const respuesta = (persistido: boolean, eventos: EventoCiudad[], extra: Partial<RespuestaCiudad> = {}): RespuestaCiudad =>
  ({ ok: true, persistido, eventos, ...extra });

// ───────────── Alertas (bitácora de automatización: 911 simulado, familiar, desvío…)
export async function crearAlertas(filas: Omit<AlertaN8n, 'id' | 'created_at'>[]): Promise<{ persistido: boolean; eventos: EventoCiudad[] }> {
  const sb = db();
  if (sb) {
    const { error } = await sb.from('alertas').insert(filas);
    if (!error) return { persistido: true, eventos: [] };
    console.warn('[alertas]', error.message);
  }
  const ahora = new Date().toISOString();
  return { persistido: false, eventos: filas.map((f) => ({ t: 'alerta', alerta: { ...f, id: idLocal(), created_at: ahora } })) };
}

// ───────────── Semáforo más cercano (de public/data/infra.geojson si no hay PostGIS)
let semaforos: { osm_id: number; lng: number; lat: number }[] | null = null;
async function semaforoCercano(lng: number, lat: number): Promise<number | null> {
  const sb = db();
  if (sb) {
    const { data } = await sb.rpc('semaforo_cercano', { lat, lng });
    const f = (data as { osm_id: number; distancia_m: number }[] | null)?.[0];
    if (f && f.distancia_m < 400) return f.osm_id;
  }
  if (!semaforos) {
    try {
      const fc = JSON.parse(await readFile(path.join(process.cwd(), 'public/data/infra.geojson'), 'utf8')) as GeoJSON.FeatureCollection<GeoJSON.Point>;
      semaforos = fc.features
        .filter((f) => f.properties?.tipo === 'semaforo')
        .map((f) => ({ osm_id: Number(f.properties?.osm_id), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
    } catch { semaforos = []; }
  }
  let mejor: number | null = null, dMin = 400;
  for (const s of semaforos) {
    const d = Math.hypot((s.lng - lng) * 97_700, (s.lat - lat) * 110_900);
    if (d < dMin) { dMin = d; mejor = s.osm_id; }
  }
  return mejor;
}

// ───────────── Clasificación de incidentes (Claude si hay llave, reglas si no)
interface Clasif { tipo: string; severidad: number; carril: number | null; resumen: string; requiere_911: boolean }

const PROMPT_INCIDENTE = `Eres el clasificador de incidentes viales de ViveCUU, Chihuahua.
Del texto del conductor extrae y responde SOLO JSON:
{"tipo":"accidente|congestion|cierre|obra|peligro|otro","severidad":1-5,"carril":número o null,"resumen":"máx. 20 palabras","requiere_911":boolean}
Choque "fuerte", heridos, volcadura o atropellamiento = severidad 5 y requiere_911 true.
"Carril de en medio" en vía de 3 carriles = 2; "izquierdo/rápido" = 1; "derecho/lento" = total.`;

export function clasificarPorReglas(texto: string, carriles = 3): Clasif {
  const t = texto.toLowerCase();
  const tipo = /choque|chocaron|accidente|volcadura|atropell|carambola/.test(t) ? 'accidente'
    : /cerrad|cierre|bloquead/.test(t) ? 'cierre'
      : /obra|trabajos|construcci/.test(t) ? 'obra'
        : /tr[aá]fico|embotell|atorad|congest/.test(t) ? 'congestion'
          : /peligro|bache|inundad|animal|objeto/.test(t) ? 'peligro' : 'accidente';
  const grave = /fuerte|herid|volcadura|atropell|sangre|inconsciente|fuego|incendio/.test(t);
  const severidad = grave ? 5 : tipo === 'accidente' ? 4 : tipo === 'cierre' ? 4 : 3;
  const carril = /en medio|central|de enmedio/.test(t) ? Math.ceil(carriles / 2)
    : /izquierd|r[aá]pido/.test(t) ? 1
      : /derech|lento/.test(t) ? carriles
        : (t.match(/carril\s*(\d)/)?.[1] ? Number(t.match(/carril\s*(\d)/)![1]) : null);
  const resumen = texto.trim().replace(/^copiloto,?\s*/i, '').slice(0, 120) || 'Incidente reportado';
  return { tipo, severidad, carril, resumen: resumen.charAt(0).toUpperCase() + resumen.slice(1), requiere_911: severidad >= 5 };
}

async function clasificar(texto: string, carriles: number): Promise<Clasif> {
  const j = extraerJson<Partial<Clasif>>(await preguntarClaude({ system: PROMPT_INCIDENTE, texto: `Texto: ${texto}`, maxTokens: 400, timeoutMs: 12_000 }));
  const base = clasificarPorReglas(texto, carriles);
  if (!j) return base;
  const TIPOS = ['accidente', 'congestion', 'cierre', 'obra', 'peligro', 'otro'];
  return {
    tipo: TIPOS.includes(String(j.tipo)) ? String(j.tipo) : base.tipo,
    severidad: Math.min(5, Math.max(1, Number(j.severidad) || base.severidad)),
    carril: typeof j.carril === 'number' ? j.carril : base.carril,
    resumen: j.resumen || base.resumen,
    requiere_911: Boolean(j.requiere_911),
  };
}

// ───────────── Flujo F1 (incidente) sin n8n: lo mismo que hace n8n, directo en la app
export interface EntradaIncidente {
  origen: 'voz' | 'boton_secreto' | 'anomalia_celda' | 'reporte' | 'demo';
  texto?: string;
  tipo?: string;
  calle?: string | null;
  carril?: number | null;
  carriles_totales?: number;
  carriles_bloqueados?: number[];
  severidad?: number | null;
  lat?: number | null;
  lng?: number | null;
  usuario?: { nombre?: string; eta_destino_min?: number | null };
}

const NOMBRE_TIPO: Record<string, string> = {
  accidente: 'Choque', cierre: 'Cierre de vía', obra: 'Obra', congestion: 'Congestión', peligro: 'Peligro', evento: 'Evento', otro: 'Incidente',
};

export async function crearIncidente(e: EntradaIncidente): Promise<RespuestaCiudad & { mensaje_voz: string; folio?: string }> {
  // 1) n8n es el orquestador si está configurado (él escribe en Supabase)
  if (db()) {
    const r = await llamarN8n<{ mensaje_voz?: string; folio?: string; incidente_id?: number }>('vivecuu/incidente', e);
    if (r) return { ...respuesta(true, []), mensaje_voz: r.mensaje_voz || 'Listo, ya quedó reportado.', folio: r.folio };
  }

  const carriles = e.carriles_totales || 3;
  const texto = e.texto || `${e.tipo || 'accidente'} en ${e.calle || 'la vía'}`;
  const c = e.severidad && e.tipo
    ? { tipo: e.tipo, severidad: e.severidad, carril: e.carril ?? null, resumen: texto, requiere_911: e.severidad >= 5 }
    : await clasificar(texto, carriles);
  if (e.tipo && !e.severidad) c.tipo = e.tipo;
  if (e.carril) c.carril = e.carril;

  let { lat, lng } = e;
  let calle = e.calle || null;
  if ((lat == null || lng == null) && calle) {
    // Avenidas conocidas: coordenadas sobre la vía, sin depender del geocodificador
    const clave = calle.toLowerCase().replace(/^av(enida)?\.?\s+/, '');
    const conocida = CALLES_DEMO.find((c) => clave.includes(c.nombre.toLowerCase().replace(/^av\.\s+/, '')));
    if (conocida) { lat = conocida.lat; lng = conocida.lng; calle = conocida.nombre; }
  }
  if ((lat == null || lng == null) && calle) {
    const g = await geocodificar(calle, [CENTRO_CUU.lng, CENTRO_CUU.lat]);
    if (g) { lat = g.lat; lng = g.lng; }
  }
  if (lat == null || lng == null) { lat = CENTRO_CUU.lat; lng = CENTRO_CUU.lng; }
  if (!calle) calle = 'tu zona';

  const bloqueados = e.carriles_bloqueados ?? (c.carril ? [c.carril] : c.tipo === 'cierre' ? Array.from({ length: carriles }, (_, i) => i + 1) : []);
  const retraso = c.tipo === 'cierre' ? 15 : c.severidad >= 4 ? 12 : c.severidad === 3 ? 6 : 3;
  const fila = {
    tipo: c.tipo, descripcion: c.resumen, calle, carril_bloqueado: bloqueados, carriles_totales: carriles,
    severidad: c.severidad, retraso_min: retraso, votos: 1, origen: e.origen, estado: 'activo' as const, lat, lng,
  };

  const eventos: EventoCiudad[] = [];
  let persistido = false;
  let incidente: Incidente | null = null;
  const sb = db();
  if (sb) {
    const { data, error } = await sb.from('incidentes').insert(fila).select().single();
    if (!error && data) { incidente = data as Incidente; persistido = true; }
    else console.warn('[incidente]', error?.message);
  }
  if (!incidente) {
    incidente = { ...fila, id: idLocal(), inicio: new Date().toISOString() };
    eventos.push({ t: 'incidente', incidente });
  }

  // 2) Protocolo de desvío: semáforo más cercano a rojo 5 min
  const osm = await semaforoCercano(lng, lat);
  if (osm != null) {
    const expira = Date.now() + 5 * 60_000;
    if (persistido && sb) {
      await sb.from('overrides_semaforo').upsert({ osm_id: osm, estado: 'rojo', motivo: 'incidente', expira: new Date(expira).toISOString() });
    } else eventos.push({ t: 'semaforo', osm_id: osm, estado: 'rojo', expira });
  }
  if (!persistido && (c.tipo === 'accidente' || c.tipo === 'cierre' || c.tipo === 'congestion')) {
    eventos.push({ t: 'trafico', lng, lat, radio_m: c.tipo === 'congestion' ? 250 : 150, nivel: 3 });
  }

  // 3) Alertas según severidad (el 911 es SIEMPRE simulado)
  const f = folio();
  const nombre = NOMBRE_TIPO[c.tipo] || 'Incidente';
  const alterna = alternaDe(calle);
  const alertas: Omit<AlertaN8n, 'id' | 'created_at'>[] = [];
  if (c.severidad >= 4) {
    alertas.push({ tipo: '911_simulado', titulo: 'Enlace 911 (simulado)', mensaje: `Folio ${f}`, payload: { folio: f, calle, severidad: c.severidad, lat, lng }, incidente_id: persistido ? incidente.id : null });
    alertas.push({ tipo: 'familiar', titulo: 'Avisamos a tu contacto', mensaje: 'Con tu ubicación y hora estimada · simulado', payload: { calle }, incidente_id: persistido ? incidente.id : null });
  }
  if (c.severidad >= 3) {
    alertas.push({ tipo: 'desvio', titulo: `Desvío por ${alterna}`, mensaje: `${nombre} en ${calle} · +${retraso} min si sigues por ahí`, payload: { alterna }, incidente_id: persistido ? incidente.id : null });
  }
  if (alertas.length) {
    const a = await crearAlertas(alertas);
    eventos.push(...a.eventos);
  }

  const carrilTxt = bloqueados.length && bloqueados.length < carriles ? `, carril ${bloqueados.join(' y ')}` : '';
  const mensaje_voz = c.severidad >= 4
    ? `Listo. Reporté el ${nombre.toLowerCase()} en ${calle}${carrilTxt}. Avisé a emergencias, simulado, y a tu contacto. Si vas por ahí, toma ${alterna}.`
    : `Listo, reporté ${nombre.toLowerCase()} en ${calle}. Ya lo ven los demás en el mapa.`;
  return { ...respuesta(persistido, eventos), mensaje_voz, folio: c.severidad >= 4 ? f : undefined };
}

// ───────────── SOS: emergencia + 911 simulado + aviso a contacto
const SERVICIO: Record<string, string> = { ambulancia: 'Ambulancia', bomberos: 'Bomberos', policia: 'Policía' };

export async function crearEmergencia(tipo: string, lat: number, lng: number, demo = false): Promise<RespuestaCiudad & { emergencia: Emergencia; folio: string }> {
  const t = SERVICIO[tipo] ? tipo : 'ambulancia';
  const fila = { tipo: t, estado: 'solicitada' as const, lat, lng, semaforos_verdes: 0 };
  const sb = db();
  let emergencia: Emergencia | null = null;
  if (sb) {
    const { data, error } = await sb.from('emergencias').insert(fila).select().single();
    if (!error && data) emergencia = data as Emergencia;
    else console.warn('[sos]', error?.message);
  }
  const persistido = Boolean(emergencia);
  const eventos: EventoCiudad[] = [];
  if (!emergencia) {
    emergencia = { ...fila, id: idLocal(), hospital_id: null, ruta: null, eta_seg: null, created_at: new Date().toISOString() };
  }
  eventos.push({ t: 'emergencia', emergencia });
  const f = folio();
  const a = await crearAlertas([
    { tipo: '911_simulado', titulo: 'Enlace 911 (simulado)', mensaje: `Folio ${f} · ${SERVICIO[t]}${demo ? ' · prueba' : ''}`, payload: { folio: f, tipo: t, lat, lng, emergencia_id: emergencia.id }, incidente_id: null },
    { tipo: 'familiar', titulo: 'Avisamos a tu contacto', mensaje: 'Con tu ubicación en vivo · simulado', payload: { lat, lng }, incidente_id: null },
  ]);
  eventos.push(...a.eventos);
  return { ...respuesta(persistido, eventos), emergencia, folio: f };
}
