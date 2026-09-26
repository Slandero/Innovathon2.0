import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extraerJson, preguntarClaude } from '@/lib/server/claude';
import { crearAlertas, crearIncidente, db, idLocal, respuesta } from '@/lib/server/ciudad';
import { llamarN8n } from '@/lib/supabase-server';
import type { EventoCiudad } from '@/lib/eventos';
import type { Reporte } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const TIPOS = ['bache', 'tope', 'semaforo_fallando', 'obra', 'accidente', 'basura', 'luminaria', 'fuga_agua', 'otro'] as const;
const DEPS = ['municipio', 'transito', 'jmas', 'cfe', 'ninguna'] as const;
const DEP_POR_TIPO: Record<string, (typeof DEPS)[number]> = {
  bache: 'municipio', tope: 'municipio', obra: 'municipio', basura: 'municipio', semaforo_fallando: 'transito',
  accidente: 'transito', luminaria: 'cfe', fuga_agua: 'jmas', otro: 'municipio',
};
const NOMBRE: Record<string, string> = {
  bache: 'Bache', tope: 'Tope', semaforo_fallando: 'Semáforo fallando', obra: 'Obra', accidente: 'Accidente',
  basura: 'Basura', luminaria: 'Luminaria', fuga_agua: 'Fuga de agua', otro: 'Reporte',
};
const NOMBRE_DEP: Record<string, string> = { municipio: 'Municipio', transito: 'Tránsito', jmas: 'JMAS', cfe: 'CFE', ninguna: 'Sin asignar' };

const Entrada = z.object({
  foto: z.string().max(3_000_000).nullish(), // data URL JPEG (el cliente la reduce a ~900 px)
  nota: z.string().max(600).default(''),
  tipo: z.enum(TIPOS).nullish(),
  calle: z.string().max(160).nullish(),
  lat: z.number().min(28.4).max(28.9),
  lng: z.number().min(-106.4).max(-105.8),
});

const Clasif = z.object({
  es_valido: z.boolean().default(true),
  tipo: z.enum(TIPOS).catch('otro'),
  severidad: z.coerce.number().int().min(1).max(5).catch(3),
  titulo: z.string().max(80).catch(''),
  resumen: z.string().max(300).catch(''),
  dependencia: z.enum(DEPS).catch('municipio'),
  confianza: z.coerce.number().min(0).max(1).catch(0.6),
});
type Clasif = z.infer<typeof Clasif>;

const PROMPT = `Eres el clasificador de reportes urbanos de ViveCUU, en Chihuahua, México.
Recibes una foto (puede faltar) y una nota opcional de un ciudadano, y el tipo que el ciudadano eligió.
Responde SOLO con JSON válido, sin texto extra, con esta forma:
{"es_valido": boolean, "tipo": "bache|tope|semaforo_fallando|obra|accidente|basura|luminaria|fuga_agua|otro", "severidad": 1-5, "titulo": "máx. 8 palabras", "resumen": "1-2 oraciones claras para otros ciudadanos", "dependencia": "municipio|transito|jmas|cfe|ninguna", "confianza": 0.0-1.0}
Criterios: bache profundo en carril de alta velocidad = 4-5; fuga de agua = jmas; luminaria o cables = cfe; semáforo o accidente = transito; baches, topes, basura, obra = municipio.`;

function porReglas(nota: string, elegido?: string | null): Clasif {
  const t = nota.toLowerCase();
  const tipo = (elegido as Clasif['tipo']) || (
    /bache|hoyo|agujero/.test(t) ? 'bache' : /fuga|agua|tubo/.test(t) ? 'fuga_agua' : /sem[aá]foro/.test(t) ? 'semaforo_fallando'
      : /obra|zanja|trabaj/.test(t) ? 'obra' : /basura/.test(t) ? 'basura' : /luminaria|poste|luz|cable/.test(t) ? 'luminaria'
        : /choque|accidente/.test(t) ? 'accidente' : 'otro');
  const grave = /grande|profund|peligro|ponch|enorme|herid|inund|cay[oó]|muy/.test(t);
  const severidad = tipo === 'accidente' ? 4 : tipo === 'semaforo_fallando' ? 4 : grave ? 4 : tipo === 'fuga_agua' ? 3 : 3;
  const resumen = nota.trim() ? nota.trim().charAt(0).toUpperCase() + nota.trim().slice(1) : `${NOMBRE[tipo]} reportado por un ciudadano.`;
  return { es_valido: true, tipo, severidad, titulo: NOMBRE[tipo], resumen, dependencia: DEP_POR_TIPO[tipo], confianza: 0.55 };
}

async function clasificar(foto: string | null | undefined, nota: string, elegido?: string | null): Promise<Clasif> {
  const m = foto?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  const texto = `Tipo elegido por el ciudadano: ${elegido || 'ninguno'}\nNota: ${nota || '(sin nota)'}`;
  const r = await preguntarClaude({
    system: PROMPT, texto, maxTokens: 600, timeoutMs: 20_000,
    imagen: m ? { tipo: m[1] as 'image/jpeg', base64: m[2] } : undefined,
  });
  const j = Clasif.safeParse(extraerJson(r));
  if (!j.success) return porReglas(nota, elegido);
  // Respeta el tipo que eligió el ciudadano si la IA no está segura
  if (elegido && j.data.confianza < 0.6) j.data.tipo = elegido as Clasif['tipo'];
  return j.data;
}

export async function POST(req: Request) {
  const p = Entrada.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, error: 'Datos inválidos', eventos: [], persistido: false }, { status: 400 });
  const { foto, nota, tipo: elegido, lat, lng, calle } = p.data;

  const c = await clasificar(foto, nota, elegido);
  const titulo = c.titulo || `${NOMBRE[c.tipo]}${calle ? ` · ${calle.split(' y ')[0]}` : ''}`;
  const sb = db();

  // Duplicado: mismo tipo a < 30 m en 48 h → suma voto
  if (sb) {
    const { data: previo } = await sb.rpc('reportes_cercanos', { p_lat: lat, p_lng: lng, p_tipo: c.tipo });
    const r0 = (previo as Reporte[] | null)?.[0];
    if (r0) {
      await sb.rpc('votar_reporte', { p_id: r0.id });
      return NextResponse.json({ ...respuesta(true, []), duplicado: true, reporte: { ...r0, votos: r0.votos + 1 }, clasificacion: c });
    }
  }

  // Foto a Storage (bucket público "reportes"); sin Supabase se queda como data URL local
  let foto_url: string | null = foto || null;
  if (sb && foto?.startsWith('data:image/')) {
    const [cab, b64] = foto.split(',');
    const tipoImg = cab.match(/data:(image\/\w+)/)?.[1] || 'image/jpeg';
    const ruta = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${tipoImg.split('/')[1]}`;
    const up = await sb.storage.from('reportes').upload(ruta, Buffer.from(b64, 'base64'), { contentType: tipoImg });
    foto_url = up.error ? null : sb.storage.from('reportes').getPublicUrl(ruta).data.publicUrl;
  }

  const fila = {
    tipo: c.tipo, severidad: c.severidad, titulo, descripcion: nota || null, resumen_ia: c.resumen,
    dependencia: c.dependencia, confianza: c.confianza, foto_url, votos: 1, estado: 'abierto', lat, lng,
  };
  const eventos: EventoCiudad[] = [];
  let reporte: Reporte | null = null;
  if (sb) {
    const { data, error } = await sb.from('reportes').insert(fila).select().single();
    if (!error && data) reporte = data as Reporte;
    else console.warn('[reporte]', error?.message);
  }
  const persistido = Boolean(reporte);
  if (!reporte) {
    reporte = { ...fila, id: idLocal(), created_at: new Date().toISOString() };
    eventos.push({ t: 'reporte', reporte });
  }
  const folioR = `CUU-R-${String(reporte.id).slice(-5).padStart(5, '0')}`;

  // F2: n8n lo turna a la dependencia; si no hay n8n, dejamos constancia en el feed
  const n8n = persistido ? await llamarN8n('vivecuu/reporte', { reporte_id: reporte.id, ...fila }, 8000) : null;
  if (!n8n) {
    const a = await crearAlertas([{
      tipo: 'dependencia', titulo: `Reporte turnado a ${NOMBRE_DEP[c.dependencia]}`,
      mensaje: `${NOMBRE[c.tipo]} · severidad ${c.severidad}/5 · ${folioR}`, payload: { reporte_id: reporte.id }, incidente_id: null,
    }]);
    eventos.push(...a.eventos);
  }
  // Un accidente grave también dispara el flujo de incidente
  if (c.tipo === 'accidente' && c.severidad >= 4) {
    const inc = await crearIncidente({ origen: 'reporte', texto: nota || 'Accidente reportado con foto', tipo: 'accidente', severidad: c.severidad, calle, lat, lng });
    eventos.push(...inc.eventos);
  }

  return NextResponse.json({
    ...respuesta(persistido, eventos), duplicado: false, reporte, folio: folioR, clasificacion: c,
    dependencia: NOMBRE_DEP[c.dependencia], nombre_tipo: NOMBRE[c.tipo],
  });
}
