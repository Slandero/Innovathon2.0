// Prueba de humo de la app corriendo: páginas, datos estáticos y TODAS las API routes.
// Funciona en modo local (sin llaves) y conectado. Uso: node scripts/probar-app.mjs [http://localhost:3000] [--limpiar]
// --limpiar corre también "Limpiar" de /demo: con Supabase BORRA las alertas y resuelve incidentes.
const APP = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'http://localhost:3000';
const LIMPIAR = process.argv.includes('--limpiar');
let fallas = 0;
const ok = (b, msg, extra = '') => { console.log(`${b ? '✓' : '✗'} ${msg}${extra ? ` · ${extra}` : ''}`); if (!b) fallas++; };
const post = (ruta, cuerpo) => fetch(APP + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
  .then(async (r) => ({ status: r.status, ...(await r.json()) })).catch((e) => ({ ok: false, error: e.message }));
const tipos = (j) => (j.eventos || []).map((e) => e.t).join(',');

console.log(`── Páginas y datos (${APP})`);
for (const p of ['/', '/demo', '/manifest.webmanifest', '/data/infra.geojson', '/data/tramos.geojson', '/data/rutas_camion.json', '/data/obras.json', '/data/zonas_escolares.geojson']) {
  const r = await fetch(APP + p).catch(() => null);
  ok(r?.ok, `GET ${p}`, r ? String(r.status) : 'sin respuesta');
}

console.log('── Incidentes (F1)');
const voz = await post('/api/incidente', { origen: 'voz', texto: 'Hay un choque fuerte en Av. Tecnológico, carril de en medio', calle: 'Av. Tecnológico' });
const inc = voz.eventos?.find((e) => e.t === 'incidente')?.incidente;
ok(voz.ok && voz.mensaje_voz, 'copiloto: choque por voz', voz.mensaje_voz);
if (!voz.persistido) ok(inc && Math.abs(inc.lat - 28.68964) < 0.001 && inc.carril_bloqueado?.[0] === 2 && inc.severidad === 5, '  en su coordenada, carril 2, severidad 5', inc ? `${inc.lat},${inc.lng}` : '');
ok(voz.persistido || /alerta.*alerta.*alerta/.test(tipos(voz)), '  911 simulado + familiar + desvío', voz.persistido ? 'en Supabase' : tipos(voz));
const invalido = await post('/api/incidente', { lat: 99 });
ok(invalido.status === 400, 'rechaza datos inválidos', String(invalido.status));
if (inc) {
  const v = await post(`/api/incidente/${inc.id}/voto`, { accion: 'sigue', votos: 1 });
  ok(v.ok, 'voto "sigue ahí"', tipos(v) || 'Supabase');
}

console.log('── Botón secreto (/demo)');
for (const [accion, extra] of [['accidente', { calle: 'Periférico de la Juventud', carril: 2 }], ['congestion', { calle: 'Av. Universidad' }], ['cerrar_via', { calle: 'Av. Independencia' }], ['hora_pico', { activo: true }], ['sos', {}], ['resumen', { hechos: 'Choque en Av. Tecnológico\nObra en Teófilo Borunda' }], ['hora_pico', { activo: false }], ...(LIMPIAR ? [['limpiar', {}]] : [])]) {
  const r = await post('/api/demo', { accion, ...extra });
  ok(r.ok, `demo: ${accion}`, (r.mensaje || '').split('\n')[0].slice(0, 70) || tipos(r));
}

console.log('── SOS');
const sos = await post('/api/sos', { accion: 'crear', tipo: 'ambulancia', lat: 28.635, lng: -106.089 });
ok(sos.ok && sos.emergencia?.id, 'pedir ambulancia', sos.folio);
ok((await post('/api/sos', { accion: 'llamar911', id: sos.emergencia?.id || 1 })).ok, 'llamar 911 (simulado)');
ok((await post('/api/sos', { accion: 'cancelar', id: sos.emergencia?.id || 1 })).ok, 'cancelar');

console.log('── Reportes');
const rep = await post('/api/reportes/clasificar', { nota: 'Bache grande en el carril derecho, ya se ponchó una llanta', tipo: 'bache', lat: 28.6401, lng: -106.0702, calle: 'Calle de prueba' });
ok(rep.ok && rep.reporte, 'reporte clasificado', `${rep.nombre_tipo || rep.reporte?.tipo} · sev ${rep.reporte?.severidad} · ${rep.dependencia || rep.reporte?.dependencia} · ${rep.folio || ''}`);
if (rep.reporte) ok((await post(`/api/reportes/${rep.reporte.id}/voto`, { votos: 1 })).ok, 'voto a reporte');

console.log('── IA (con llave de Claude usa IA; sin llave, reglas)');
const a = await post('/api/asistente', { pregunta: '¿Cómo está el tráfico?', hechos: 'Sin incidentes' });
ok(a.ok, 'asistente', a.texto ? 'respondió Claude' : 'sin llave → respuesta por reglas en el cliente');
const res = await post('/api/resumen', { hechos: 'Choque en Av. Tecnológico\nObra en Borunda' });
ok(res.ok && res.texto, 'resumen de la ciudad', res.texto?.split('\n')[0]);
const cam = await fetch(`${APP}/api/camiones/cercanos?destino=Centro`).then((r) => r.json()).catch(() => ({}));
ok(Boolean(cam.texto), 'camiones cercanos (copiloto)', cam.texto?.slice(0, 70));

console.log(fallas ? `\n${fallas} problema(s)` : '\nTodas las pruebas pasaron ✔');
process.exit(fallas ? 1 : 0);
