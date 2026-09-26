// Toma el flujo "ViveCUU - F1 Incidente (Momento WOW)" exportado de n8n y genera la versión
// compatible con la app y con supabase/schema.sql → n8n/F1-incidente-vivecuu.json
// Uso: node scripts/generar-flujo-n8n.mjs "<ruta al .json exportado>"
// Conserva ids, posiciones y credenciales; corrige cuerpos y agrega el aviso al familiar.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const origen = process.argv[2];
if (!origen) throw new Error('Pasa la ruta del flujo exportado de n8n');
const f = JSON.parse(readFileSync(origen, 'utf8'));
const nodo = (nombre) => {
  const n = f.nodes.find((x) => x.name === nombre);
  if (!n) throw new Error(`No encontré el nodo "${nombre}"`);
  return n;
};
const M = "$('Merge Ramas').item.json";
const INC = "$('Supabase: Insertar Incidente').item.json";

// 1) Normalizar: respeta lo que manda la app (coordenadas reales, tipo, carriles, calle alterna)
nodo('Normalizar Datos').parameters.jsCode = `// Normaliza el payload de la app ViveCUU (copiloto, botón secreto, reportes)
const body = $json.body || $json;
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
return {
  origen: body.origen || 'boton_secreto',
  texto: body.texto || 'Choque en Av. Tecnológico',
  tipo: body.tipo || null,
  calle: body.calle || 'Av. Tecnológico',
  carril: num(body.carril),
  carriles_totales: num(body.carriles_totales) || 3,
  carriles_bloqueados: Array.isArray(body.carriles_bloqueados) ? body.carriles_bloqueados : null,
  severidad: num(body.severidad),
  lat: num(body.lat) ?? 28.6512,
  lng: num(body.lng) ?? -106.0801,
  alterna: body.alterna || 'Av. Universidad',
  retraso_min: num(body.retraso_min),
  usuario: body.usuario || { nombre: 'Demo', eta_destino_min: 14 },
  recibido_en: new Date().toISOString(),
};`;

// 2) Clasificador por reglas (se puede cambiar por un nodo de Claude)
nodo('Clasificar Incidente (IA/Reglas)').parameters.jsCode = `// Clasificador por reglas. Para IA: reemplazar por un nodo Anthropic con el prompt de docs/N8N_FLUJOS.md
const texto = ($json.texto || '').toLowerCase();
const total = $json.carriles_totales || 3;
let tipo = $json.tipo || 'accidente';
let severidad = 3;
let requiere_911 = false;
let carril = $json.carril;
if (/fuerte|herid|volcadura|grave|atropell|incendio/.test(texto)) { severidad = 5; requiere_911 = true; }
else if (/choque|chocaron|accidente|carambola/.test(texto)) { severidad = 4; }
else if (/bache|fuga|lento|trafico|tráfico|obra/.test(texto)) {
  severidad = 2;
  if (!$json.tipo) tipo = /obra/.test(texto) ? 'obra' : 'congestion';
}
if (/cerrad|cierre|bloquead/.test(texto) && !$json.tipo) { tipo = 'cierre'; severidad = Math.max(severidad, 4); }
if (!carril) {
  if (/izquierd|rapido|rápido/.test(texto)) carril = 1;
  else if (/medio|central|enmedio/.test(texto)) carril = Math.ceil(total / 2);
  else if (/derech|lento/.test(texto)) carril = total;
}
return { ...$json, tipo, severidad, carril, resumen: ($json.texto || '').slice(0, 120), requiere_911 };`;

// 3) Insertar incidente (objeto, no texto: soporta comillas en la descripción)
nodo('Supabase: Insertar Incidente').parameters.jsonBody = `={{ {
  tipo: $json.tipo || 'accidente',
  calle: $json.calle,
  carril_bloqueado: $json.carriles_bloqueados || ($json.carril && $json.tipo !== 'congestion' ? [$json.carril] : []),
  carriles_totales: $json.carriles_totales || 3,
  severidad: $json.severidad || 3,
  descripcion: $json.resumen || $json.texto,
  retraso_min: $json.retraso_min || (($json.severidad || 3) >= 4 ? 12 : 6),
  origen: $json.origen,
  estado: 'activo',
  lat: $json.lat,
  lng: $json.lng
} }}`;

// 4) Semáforo real más cercano (el trigger de la base lo elige con lat/lng)
nodo('Supabase: Semáforo a Rojo').parameters.jsonBody = `={{ {
  lat: ${M}.lat,
  lng: ${M}.lng,
  estado: 'rojo',
  motivo: 'Incidente en ' + ${M}.calle
} }}`;

// 5) Alertas con incidente_id y payload (lo que lee la app)
nodo('Supabase: Alerta 911').parameters.jsonBody = `={{ {
  tipo: '911_simulado',
  titulo: 'Enlace 911 (simulado)',
  mensaje: 'Folio CUU-' + $now.toFormat('HHmmss') + ' · ' + ${M}.calle,
  incidente_id: ${INC}.id,
  payload: { folio: 'CUU-' + $now.toFormat('HHmmss'), severidad: ${M}.severidad, lat: ${M}.lat, lng: ${M}.lng }
} }}`;
nodo('Supabase: Alerta Desvío').parameters.jsonBody = `={{ {
  tipo: 'desvio',
  titulo: 'Desvío por ' + ${M}.alterna,
  mensaje: 'Incidente en ' + ${M}.calle + ' · +' + (${M}.retraso_min || 12) + ' min si sigues por ahí',
  incidente_id: ${INC}.id,
  payload: { calle_alterna: ${M}.alterna }
} }}`;

// 6) Nuevo: aviso al contacto (simulado en la app; aquí se puede conectar Telegram/Twilio)
const a911 = nodo('Supabase: Alerta 911');
const familiar = JSON.parse(JSON.stringify(a911));
familiar.id = '5f3c1b8e-6a2d-4f1e-9c7a-0e4b2d9a7f11';
familiar.name = 'Supabase: Aviso Familiar';
familiar.position = [a911.position[0] + 240, a911.position[1]];
familiar.parameters.jsonBody = `={{ {
  tipo: 'familiar',
  titulo: 'Avisamos a tu contacto',
  mensaje: 'Con tu ubicación y hora estimada · simulado',
  incidente_id: ${INC}.id,
  payload: { calle: ${M}.calle, lat: ${M}.lat, lng: ${M}.lng }
} }}`;
f.nodes.push(familiar);
f.connections['Supabase: Alerta 911'] = { main: [[{ node: 'Supabase: Aviso Familiar', type: 'main', index: 0 }]] };
f.connections['Supabase: Aviso Familiar'] = { main: [[{ node: 'Supabase: Alerta Desvío', type: 'main', index: 0 }]] };
const grupo = f.nodeGroups?.find((g) => g.name === 'Avisar emergencia');
if (grupo) { grupo.nodeIds.push(familiar.id); grupo.description = 'Si es grave: enlace 911 simulado con folio y aviso al contacto de emergencia.'; }

// 7) Respuesta para el copiloto (la app la dice en voz)
nodo('Armar Respuesta Voz').parameters.jsCode = `const m = $('Merge Ramas').item.json;
const inc = $('Supabase: Insertar Incidente').item.json;
const grave = (m.severidad || 3) >= 4;
const folio = 'CUU-' + $now.toFormat('HHmmss');
const nombres = { accidente: 'choque', cierre: 'cierre', obra: 'obra', congestion: 'tráfico', peligro: 'peligro' };
const nombre = nombres[m.tipo] || 'incidente';
const carril = m.carril && m.carril < (m.carriles_totales || 3) ? ', carril ' + m.carril : '';
const mensaje_voz = grave
  ? 'Listo. Reporté el ' + nombre + ' en ' + m.calle + carril + '. Avisé a emergencias, simulado, y a tu contacto. Si vas por ahí, toma ' + m.alterna + '.'
  : 'Listo, reporté ' + nombre + ' en ' + m.calle + '. Ya lo ven los demás en el mapa.';
return { ok: true, folio: grave ? folio : null, incidente_id: inc.id || null, calle: m.calle, carril: m.carril, severidad: m.severidad, mensaje_voz };`;

f.name = 'ViveCUU - F1 Incidente (compatible con la app)';
mkdirSync('n8n', { recursive: true });
writeFileSync('n8n/F1-incidente-vivecuu.json', JSON.stringify(f, null, 2));
console.log('n8n/F1-incidente-vivecuu.json →', f.nodes.length, 'nodos:', f.nodes.map((n) => n.name).join(' · '));
