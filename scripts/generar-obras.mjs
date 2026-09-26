// Genera public/data/obras.json: obras viales activas en Chihuahua capital con su tramo cerrado,
// desvíos y corredores (para simular el tráfico). Traza todo sobre calles reales con OSRM público.
// Uso: node scripts/generar-obras.mjs
// Fuentes: avisos del Gobierno Municipal de Chihuahua (19 sep 2026) y La Paradoja (sep 2026).
// Coordenadas de los cruces: OpenStreetMap (Overpass). Trazos de desvío aproximados.
import { writeFileSync } from 'node:fs';

const r5 = (x) => Math.round(x * 1e5) / 1e5;
async function trazar(puntos) {
  const url = `https://router.project-osrm.org/route/v1/driving/${puntos.map((p) => p.join(',')).join(';')}?overview=full&geometries=geojson`;
  const j = await (await fetch(url)).json();
  if (j.code !== 'Ok') throw new Error(`OSRM: ${j.code}`);
  return { type: 'LineString', coordinates: j.routes[0].geometry.coordinates.map(([x, y]) => [r5(x), r5(y)]) };
}

// Puntos sobre las avenidas (OSM)
const GAZA = [-106.10542, 28.611];               // Teófilo Borunda × Periférico de la Juventud
const BOR_E700 = [-106.10278, 28.61685], BOR_E1500 = [-106.09678, 28.62215];
const BOR_W400 = [-106.10922, 28.60998], BOR_W1200 = [-106.11672, 28.60691];
const ORTIZ_PERIF = [-106.10742, 28.61199];      // Blvd. Ortiz Mena × Periférico
const ORTIZ_N = [-106.1009, 28.6202];            // Ortiz Mena al norte de Borunda
const SILVESTRE = [-106.0978, 28.6065];          // Av. Silvestre Terrazas
const ZARCO = [-106.08636, 28.62809];            // Av. Zarco cerca de Borunda
const PISTOLAS = [-106.14833, 28.7296];          // Av. Tecnológico × Av. Los Arcos
const TEC_N700 = [-106.15264, 28.73398], TEC_S900 = [-106.14377, 28.72255], TEC_S2000 = [-106.13689, 28.71532];

const obras = [
  {
    id: 'gaza-borunda-periferico',
    nombre: 'Gaza Teófilo Borunda – Periférico de la Juventud',
    calle: 'Av. Teófilo Borunda',
    lng: GAZA[0], lat: GAZA[1],
    afectacion: 'Carriles fuera de servicio · sentido Centro → Reliz',
    sin_afectacion: 'Sentido Reliz → Centro sin afectaciones',
    motivo: 'Instalación de la estructura del soporte norte de la gaza',
    carriles: { total: 2, cerrados: [1, 2] },
    inicio: '2026-09-19', fin: '2026-10-31', duracion: 'aprox. 6 semanas',
    impacto_min: 20,
    recomendaciones: ['Evita circular por la zona de obra', 'Sigue el señalamiento preventivo', 'Anticipa tu salida 20 min'],
    fuente: { nombre: 'Gobierno Municipal de Chihuahua · aviso del 19 sep 2026', url: null },
    cierre: await trazar([BOR_E700, BOR_W400]),
    desvios: [
      {
        titulo: 'De Centro a Reliz',
        texto: 'Toma la rampa a la lateral del Periférico de la Juventud (a la altura de Vialidad y Tránsito), sigue hasta Blvd. Ortiz Mena, retorna al Periférico y baja por la rampa a la Prolongación Teófilo Borunda.',
        geometry: await trazar([BOR_E700, ORTIZ_PERIF, BOR_W1200]),
      },
      {
        titulo: 'De Silvestre Terrazas al norte',
        texto: 'Para tomar los carriles centrales del Periférico rumbo al norte, sigue hasta Teófilo Borunda y sube por Av. Politécnico Nacional o por Ortiz Mena.',
        geometry: await trazar([SILVESTRE, GAZA, ORTIZ_N]),
      },
      {
        titulo: 'A Cuauhtémoc, Zarco y colonias',
        texto: 'Si vas a la salida a Cuauhtémoc, Silvestre Terrazas, Av. Zarco o a Cerro de la Cruz, Los Pinos y Margarita Maza de Juárez, toma la calle 28 rumbo a Av. Zarco.',
        geometry: await trazar([BOR_E1500, ZARCO]),
      },
    ],
    alternas_saturadas: [],
    colonias: ['Cerro de la Cruz', 'Los Pinos', 'Margarita Maza de Juárez', 'Campesina'],
    corredores: [await trazar([BOR_E1500, BOR_W1200]), await trazar([BOR_W1200, BOR_E1500])],
  },
  {
    id: 'paso-pistolas-meneses',
    nombre: 'Paso a desnivel Pistolas Meneses',
    calle: 'Av. Tecnológico y Los Arcos',
    lng: PISTOLAS[0], lat: PISTOLAS[1],
    afectacion: 'Cierre parcial de la circulación en la zona de obra',
    sin_afectacion: null,
    motivo: 'Construcción del paso a desnivel',
    carriles: null,
    inicio: null, fin: null, duracion: 'en obra',
    impacto_min: 35,
    recomendaciones: ['Sal con tiempo: hay trayectos de hasta 45 min para salir de la zona', 'Hay reportes de choques en las rutas alternas', 'En hora pico no siempre hay abanderamiento de tránsito'],
    fuente: { nombre: 'La Paradoja · septiembre 2026', url: 'https://laparadoja.com.mx/2026/09/hasta-45-minutos-de-trayecto-para-salir-de-la-colonia-crece-descontento-por-paso-a-desnivel-de-pistolas-meneses' },
    cierre: await trazar([TEC_S900, TEC_N700]),
    desvios: [],
    alternas_saturadas: ['Los Nogales', 'Av. Tecnológico', 'Desarrollo', 'Hidroeléctrica de Chicoasén', 'Paseo del Real', 'Av. de las Industrias', 'Palma Real', 'Periférico de la Juventud'],
    colonias: ['Villa del Real', 'Chihuahua 2000', 'Villas del Rey', 'Riberas de Sacramento', 'Vistas del Norte', 'Los Olivos', 'Los Arroyos', 'Los Portales', 'Sahuaros', 'Juan Güereca', 'Quintas Quijote', 'Valle de San Pedro', 'Bosques de San Pedro', 'Las Lunas', 'Las Aldabas', 'Quintas Montecarlo', 'Palma Real', 'Molino de Agua'],
    corredores: [await trazar([TEC_S2000, TEC_N700]), await trazar([TEC_N700, TEC_S2000])],
  },
];

writeFileSync('public/data/obras.json', JSON.stringify(obras));
for (const o of obras) console.log(`${o.id}: cierre ${o.cierre.coordinates.length} pts · ${o.desvios.length} desvíos · ${o.corredores.length} corredores`);
console.log('Listo → public/data/obras.json');
