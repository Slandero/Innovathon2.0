// Genera public/data/rutas_camion.json (respaldo sin Supabase) con las mismas rutas que sim/rutas.py.
// Traza cada ruta sobre calles reales con OSRM público, ida y vuelta, y pone paradas cada ~400 m.
// Uso: node scripts/generar-rutas-camion.mjs
import { writeFileSync } from 'node:fs';

// Nombres reales de rutas de Chihuahua; trazos APROXIMADOS por sus avenidas principales (no oficiales).
const RUTAS = [
  { id: 'BI', nombre: 'Bowí ITCH II · Circuito Universitario', color: '#0E9F8E', puntos: [[-106.0767, 28.6364], [-106.0769, 28.6542], [-106.0917, 28.6672], [-106.1106, 28.6836], [-106.1077, 28.7084]] },
  { id: 'BU', nombre: 'Bowí UACH II · Circuito Universitario', color: '#3D5AFE', puntos: [[-106.0767, 28.6364], [-106.0776, 28.6436], [-106.0887, 28.6539], [-106.0913, 28.6563], [-106.1253, 28.6447]] },
  { id: 'C1', nombre: 'Circunvalación 1 · Sube Zarco', color: '#8E44AD', puntos: [[-106.0767, 28.6364], [-106.0776, 28.6436], [-106.0769, 28.6542], [-106.0659, 28.6734], [-106.0527, 28.64], [-106.062, 28.6212]] },
  { id: 'C2', nombre: 'Circunvalación 2 · Baja Mirador', color: '#7C5CFF', puntos: [[-106.0767, 28.6364], [-106.0822, 28.6311], [-106.1146, 28.6245], [-106.1253, 28.6447], [-106.0913, 28.6563]] },
  { id: 'T2', nombre: 'Tec II · Colón', color: '#C5221F', puntos: [[-106.0659, 28.6734], [-106.0769, 28.6542], [-106.0917, 28.6672], [-106.1177, 28.6957], [-106.1077, 28.7084]] },
  { id: '15', nombre: 'Ruta 15 · Villa Juárez – Reloj', color: '#34A853', puntos: [[-106.088, 28.592], [-106.085, 28.61], [-106.08, 28.625], [-106.0767, 28.6364]] },
  { id: 'PA', nombre: 'Panamericana · San Felipe', color: '#D81B60', puntos: [[-106.0406, 28.623], [-106.0452, 28.6358], [-106.0527, 28.64], [-106.0767, 28.6364]] },
  { id: 'MV', nombre: 'Mármol · Vistas Cerro Grande', color: '#7B61FF', puntos: [[-106.0541, 28.5918], [-106.062, 28.6212], [-106.0722, 28.6269], [-106.0767, 28.6364]] },
  { id: 'RS', nombre: 'Riberas del Sacramento · Directo', color: '#6D4C41', puntos: [[-106.105, 28.715], [-106.096, 28.695], [-106.086, 28.67], [-106.0769, 28.6542], [-106.0767, 28.6364]] },
];
const PARADA_CADA_M = 400;

const hav = (a, b) => {
  const R = 6371000, t = (x) => (x * Math.PI) / 180;
  const s = Math.sin(t(b[1] - a[1]) / 2) ** 2 + Math.cos(t(a[1])) * Math.cos(t(b[1])) * Math.sin(t(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const r5 = (x) => Math.round(x * 1e5) / 1e5;

async function trazar(puntos) {
  const url = `https://router.project-osrm.org/route/v1/driving/${puntos.map((p) => p.join(',')).join(';')}?overview=full&geometries=geojson&steps=true`;
  const j = await (await fetch(url)).json();
  if (j.code !== 'Ok') throw new Error(`OSRM: ${j.code}`);
  // calle por tramo: cada paso de OSRM cubre una porción de la geometría
  const tramos = j.routes[0].legs.flatMap((l) => l.steps).map((s) => ({ nombre: s.name || '', coords: s.geometry.coordinates }));
  return tramos;
}

const salida = [];
for (const r of RUTAS) {
  const ida = await trazar(r.puntos);
  const vuelta = await trazar([...r.puntos].reverse());
  const tramos = [...ida, ...vuelta];
  const xy = [];
  const calle = [];
  tramos.forEach((t, ti) => {
    for (const c of t.coords) {
      const prev = xy[xy.length - 1];
      if (prev && prev[0] === c[0] && prev[1] === c[1]) continue;
      xy.push(c);
      calle.push(ti);
    }
  });
  const cum = [0];
  for (let i = 1; i < xy.length; i++) cum.push(cum[i - 1] + hav(xy[i - 1], xy[i]));
  const paradas = [];
  let siguiente = 150;
  for (let i = 0; i < xy.length; i++) {
    if (cum[i] < siguiente) continue;
    siguiente = cum[i] + PARADA_CADA_M;
    const t = calle[i];
    const aqui = tramos[t].nombre;
    const cruce = tramos.slice(t + 1, t + 4).map((x) => x.nombre).find((n) => n && n !== aqui) || '';
    const base = aqui || 'Calle';
    paradas.push({ nombre: cruce ? `${base} y ${cruce}` : `${base} #${paradas.length + 1}`, lng: r5(xy[i][0]), lat: r5(xy[i][1]), km: Math.round(cum[i]) / 1000 });
  }
  salida.push({
    id: r.id, nombre: r.nombre, color: r.color,
    trazo: { type: 'LineString', coordinates: xy.map(([x, y]) => [r5(x), r5(y)]) },
    paradas,
  });
  console.log(`${r.id}: ${(cum[cum.length - 1] / 1000).toFixed(1)} km · ${paradas.length} paradas`);
}
writeFileSync('public/data/rutas_camion.json', JSON.stringify(salida));
console.log('Listo → public/data/rutas_camion.json');
