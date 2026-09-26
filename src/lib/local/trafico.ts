'use client';
/** Tráfico pintado localmente cuando no hay motor de ciudad (congestión, cierres, hora pico de /demo). */
import { aplicarTrafico, traficoVivo } from '@/lib/data/vivo';
import { minutosCUU } from '@/lib/data/infra';
import { useApp } from '@/lib/store';
import type { Obra } from '@/lib/types';

type Tramo = { id: number; clase: string; coords: number[][] };
let tramos: Promise<Tramo[]> | null = null;

function cargarTramos(): Promise<Tramo[]> {
  tramos ??= fetch('/data/tramos.geojson')
    .then((r) => r.json())
    .then((fc: GeoJSON.FeatureCollection<GeoJSON.LineString>) =>
      fc.features.map((f) => ({ id: Number(f.id ?? f.properties?.id), clase: String(f.properties?.clase || ''), coords: f.geometry.coordinates })))
    .catch(() => []);
  return tramos;
}

const metros = (a: number[], lng: number, lat: number) => Math.hypot((a[0] - lng) * 97_700, (a[1] - lat) * 110_900);

/** Puntos pintados por incidentes de demo; la hora pico se dibuja debajo. */
const puntos: { lng: number; lat: number; radio_m: number; nivel: number }[] = [];
/** Zonas de obra: fijas, no se borran con "Limpiar". */
const zonasObra: { lng: number; lat: number; radio_m: number; nivel: number }[] = [];
let horaPico = false;
let base = false;

/** Carga de la ciudad según la hora (1 = hora pico). */
function cargaHorario(): number {
  const m = minutosCUU();
  const pico = [[7 * 60 + 30, 90], [14 * 60, 75], [19 * 60, 90]];
  return Math.max(0.15, ...pico.map(([c, ancho]) => Math.max(0, 1 - Math.abs(m - c) / ancho)));
}

/** Pseudoaleatorio estable por tramo y ventana de tiempo. */
const ruido = (id: number, ventana: number) => ((id * 2654435761 + ventana * 40503) >>> 0) % 1000 / 1000;

async function repintar() {
  if (useApp.getState().motorVivo) return; // el motor manda el tráfico real
  const ts = await cargarTramos();
  traficoVivo.niveles.clear();
  if (base && !horaPico) {
    // Tráfico de fondo que cambia cada ~40 s: casi todo fluido, algo lento, poco pesado
    const carga = cargaHorario();
    const ventana = Math.floor(Date.now() / 40_000);
    for (const t of ts) {
      if (t.clase === 'secondary') continue;
      const r = ruido(t.id, ventana) * 0.35 + ruido(t.id, 0) * 0.65; // cada calle tiene su personalidad
      traficoVivo.niveles.set(t.id, r > 1 - 0.1 * carga ? 2 : r > 1 - 0.32 * carga ? 1 : 0);
    }
  }
  if (horaPico) {
    for (const t of ts) {
      if (t.clase === 'secondary') continue;
      // determinista por id: ~35 % lento, ~20 % pesado, el resto fluido
      const h = (t.id * 2654435761) % 100;
      traficoVivo.niveles.set(t.id, h < 20 ? 2 : h < 55 ? 1 : 0);
    }
  }
  for (const p of [...zonasObra, ...puntos]) {
    for (const t of ts) {
      const d = Math.min(...t.coords.map((c) => metros(c, p.lng, p.lat)));
      if (d <= p.radio_m) traficoVivo.niveles.set(t.id, Math.max(traficoVivo.niveles.get(t.id) ?? 0, d < p.radio_m * 0.5 ? p.nivel : Math.max(1, p.nivel - 1)));
    }
  }
  // quita lo que ya no aplica
  for (const id of traficoVivo.aplicados.keys()) if (!traficoVivo.niveles.has(id)) traficoVivo.niveles.set(id, -1);
  aplicarTrafico();
  for (const [id, n] of traficoVivo.niveles) if (n === -1) { traficoVivo.niveles.delete(id); traficoVivo.aplicados.delete(id); }
}

export function traficoEnPunto(p: { lng: number; lat: number; radio_m: number; nivel: number }) {
  puntos.push(p);
  return repintar();
}

export function traficoHoraPico(activo: boolean) {
  horaPico = activo;
  return repintar();
}

export function limpiarTraficoLocal() {
  puntos.length = 0;
  horaPico = false;
  return repintar();
}

export const horaPicoLocal = () => horaPico;

/** Tráfico pesado sobre el tramo cerrado y cargado alrededor de cada obra. */
export function traficoObras(obras: Obra[]) {
  zonasObra.length = 0;
  for (const o of obras) {
    zonasObra.push({ lng: o.lng, lat: o.lat, radio_m: o.alternas_saturadas.length ? 900 : 550, nivel: 2 });
    const c = o.cierre.coordinates;
    for (let i = 0; i < c.length; i += Math.max(1, Math.floor(c.length / 12))) zonasObra.push({ lng: c[i][0], lat: c[i][1], radio_m: 90, nivel: 3 });
  }
  return repintar();
}

/** Enciende o apaga el tráfico de fondo (lo usa la simulación local cuando no hay motor). */
export function traficoBase(activo: boolean) {
  base = activo;
  return repintar();
}
