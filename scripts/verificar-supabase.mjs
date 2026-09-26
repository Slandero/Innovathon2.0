// Verifica que Supabase tenga el esquema de ViveCUU y prueba el flujo completo contra la app.
// Uso: node scripts/verificar-supabase.mjs [URL de la app, por defecto http://localhost:3000]
// Lee las llaves de .env.local (nunca las imprime).
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !K) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
const APP = process.argv[2] || 'http://localhost:3000';
const h = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const rest = async (path, init = {}) => {
  const r = await fetch(`${U}/rest/v1/${path}`, { ...init, headers: { ...h, ...(init.headers || {}) } });
  const t = await r.text();
  return { ok: r.ok, status: r.status, data: t ? JSON.parse(t) : null };
};
let fallas = 0;
const ok = (b, msg, extra = '') => { console.log(`${b ? '✓' : '✗'} ${msg}${extra ? ` · ${extra}` : ''}`); if (!b) fallas++; };

console.log(`\n── Esquema en ${U}`);
const TABLAS = {
  infra: 'osm_id', incidentes: 'inicio,retraso_min,votos,origen,created_at', alertas: 'payload,meta,incidente_id',
  overrides_semaforo: 'osm_id,semaforo_id,lat,lng', reportes: 'resumen_ia,estado', emergencias: 'amb_lat,semaforos_verdes',
  camiones: 'ocupacion', rutas_camion: 'trazo', sim_control: 'hora_pico', estado_ciudad: 'corredores',
};
for (const [t, cols] of Object.entries(TABLAS)) {
  const r = await rest(`${t}?select=${cols}&limit=1`);
  ok(r.ok, `tabla ${t}`, r.ok ? '' : `falta o está incompleta (${r.data?.message || r.status})`);
}
const inf = await rest('infra?select=id&tipo=eq.semaforo', { headers: { Prefer: 'count=exact', Range: '0-0' } });
const sem = await fetch(`${U}/rest/v1/infra?select=id&tipo=eq.semaforo`, { headers: { ...h, Prefer: 'count=exact', Range: '0-0' } });
const nSem = Number(sem.headers.get('content-range')?.split('/')[1] || 0);
ok(inf.ok && nSem > 500, 'semáforos reales cargados', `${nSem}`);
const rpc = await rest('rpc/semaforo_cercano', { method: 'POST', body: JSON.stringify({ lat: 28.611, lng: -106.10542 }) });
ok(rpc.ok && rpc.data?.[0]?.osm_id, 'rpc semaforo_cercano', rpc.ok ? `osm ${rpc.data?.[0]?.osm_id}` : rpc.data?.message);

if (fallas) {
  console.log(`\n${fallas} problema(s). Corre supabase/instalar_todo.sql en el SQL Editor y vuelve a probar.`);
  process.exit(1);
}

console.log(`\n── Flujo completo contra la app (${APP})`);
const antes = new Date().toISOString();
const d = await fetch(`${APP}/api/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'accidente', calle: 'Av. Tecnológico', carril: 2 }) })
  .then((r) => r.json()).catch((e) => ({ ok: false, error: e.message }));
ok(d.ok && d.persistido, 'botón secreto → guardado en Supabase', d.mensaje || d.error || '');
await new Promise((r) => setTimeout(r, 1500));
const inc = await rest(`incidentes?select=id,calle,carril_bloqueado,severidad,lat,lng,origen&created_at=gte.${antes}&order=id.desc&limit=1`);
const i = inc.data?.[0];
ok(Boolean(i), 'incidente creado', i ? `#${i.id} ${i.calle} carril ${i.carril_bloqueado} sev ${i.severidad} (${i.lat}, ${i.lng})` : '');
const al = await rest(`alertas?select=tipo,titulo&created_at=gte.${antes}&order=id.asc`);
ok((al.data || []).length >= 3, 'alertas (911 simulado, familiar, desvío)', (al.data || []).map((a) => a.tipo).join(', '));
const ov = await rest(`overrides_semaforo?select=osm_id,estado&created_at=gte.${antes}`);
ok((ov.data || []).some((o) => o.estado === 'rojo'), 'semáforo más cercano en rojo', (ov.data || []).map((o) => o.osm_id).join(', '));

const s = await fetch(`${APP}/api/sos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'crear', tipo: 'ambulancia', lat: 28.635, lng: -106.089 }) }).then((r) => r.json()).catch(() => ({}));
ok(s.ok && s.persistido && s.emergencia?.id, 'SOS → emergencia guardada', s.folio || '');
if (s.emergencia?.id) await fetch(`${APP}/api/sos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'cancelar', id: s.emergencia.id }) });

const rp = await fetch(`${APP}/api/reportes/clasificar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nota: 'Bache grande en el carril derecho', tipo: 'bache', lat: 28.6401, lng: -106.0702, calle: 'Prueba' }) }).then((r) => r.json()).catch(() => ({}));
ok(rp.ok && rp.persistido && rp.reporte?.id, 'reporte ciudadano guardado', rp.folio || (rp.duplicado ? 'ya existía, sumó voto' : ''));

const l = await fetch(`${APP}/api/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'limpiar' }) }).then((r) => r.json()).catch(() => ({}));
ok(l.ok && l.persistido, 'limpiar ciudad (deja todo listo para el demo)');

console.log(fallas ? `\n${fallas} problema(s).` : '\nTodo el flujo funciona de punta a punta ✔');
process.exit(fallas ? 1 : 0);
