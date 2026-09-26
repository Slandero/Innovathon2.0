// Genera supabase/seed_infra.sql desde public/data/infra.geojson (semáforos, altos, topes,
// cruces, escuelas, hospitales y paradas reales de OSM) para pegarlo en el SQL Editor de Supabase
// sin tener que correr Python. Uso: node scripts/generar-seed-sql.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const fc = JSON.parse(readFileSync('public/data/infra.geojson', 'utf8'));
const esc = (s) => (s == null || s === '' ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const filas = fc.features.map((f) => {
  const { osm_id, tipo, nombre } = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  return `(${Number(osm_id)},'${tipo}',${esc(nombre)},${lat.toFixed(6)},${lng.toFixed(6)})`;
});

const bloques = [];
for (let i = 0; i < filas.length; i += 400) {
  bloques.push(`insert into infra (osm_id, tipo, nombre, lat, lng) values\n${filas.slice(i, i + 400).join(',\n')}\non conflict (osm_id, tipo) do nothing;`);
}
const sql = `-- ViveCUU · infraestructura real de OpenStreetMap (${filas.length} puntos).
-- Ejecutar DESPUÉS de supabase/schema.sql. Generado con scripts/generar-seed-sql.mjs.
${bloques.join('\n\n')}
`;
writeFileSync('supabase/seed_infra.sql', sql);
const porTipo = fc.features.reduce((a, f) => ({ ...a, [f.properties.tipo]: (a[f.properties.tipo] || 0) + 1 }), {});
console.log('supabase/seed_infra.sql →', filas.length, 'puntos', porTipo);
