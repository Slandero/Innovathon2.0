'use client';
/** Resumen en texto del estado de la ciudad para el asistente y el resumen de IA. */
import { minutosCUU } from '@/lib/data/infra';
import { pctOcupacion } from '@/lib/data/camiones';
import { useApp } from '@/lib/store';

const NOMBRE_INC: Record<string, string> = {
  accidente: 'Choque', cierre: 'Cierre de vía', obra: 'Obra', congestion: 'Congestión', peligro: 'Peligro', evento: 'Evento', otro: 'Incidente',
};
export const nombreIncidente = (tipo: string) => NOMBRE_INC[tipo] || 'Incidente';

/** Horas pico de Chihuahua (minutos del día). */
const PICOS = [[7 * 60, 9 * 60], [13 * 60, 15 * 60], [18 * 60, 20 * 60]];
const CORREDORES = ['Av. Universidad', 'Periférico de la Juventud', 'Av. Tecnológico'];

/** Pronóstico sencillo por horario: la próxima hora pico y el corredor que más se carga. */
export function pronosticoHorario(fecha = new Date()): { titulo: string; sub: string; pesado: boolean } {
  const m = minutosCUU(fecha);
  const corredor = CORREDORES[Math.floor(m / 60) % CORREDORES.length];
  for (const [a, b] of PICOS) {
    if (m >= a && m < b) return { titulo: `Hora pico: ${corredor} viene cargada`, sub: `Pronóstico por horario · mejora después de las ${String(b / 60).padStart(2, '0')}:00`, pesado: true };
    if (m >= a - 45 && m < a) return { titulo: `En ${a - m} min se pone pesado ${corredor}`, sub: 'Pronóstico por horario', pesado: true };
  }
  return { titulo: 'Tráfico normal las próximas horas', sub: 'Pronóstico por horario', pesado: false };
}

export function hechosCiudad(): string {
  const s = useApp.getState();
  const l: string[] = [];
  const incs = s.incidentes.filter((i) => i.estado === 'activo');
  if (incs.length) {
    for (const i of incs.slice(0, 8)) {
      const carriles = i.carril_bloqueado?.length ? `, carril ${i.carril_bloqueado.join(' y ')} cerrado` : '';
      l.push(`${nombreIncidente(i.tipo)} en ${i.calle || 'la ciudad'}${carriles}, +${i.retraso_min ?? '?'} min de retraso`);
    }
  } else l.push('Sin incidentes activos en la ciudad');
  for (const o of s.obras) {
    l.push(`Obra: ${o.nombre} (${o.calle}). ${o.afectacion}.${o.fin ? ` Hasta aprox. ${o.fin}.` : ''} Impacto +${o.impacto_min} min.${o.desvios.length ? ` Desvíos: ${o.desvios.map((d) => d.titulo).join('; ')}.` : ''}${o.alternas_saturadas.length ? ` Alternas saturadas: ${o.alternas_saturadas.join(', ')}.` : ''}`);
  }
  const rep = s.reportes.slice(0, 5);
  if (rep.length) l.push(`Reportes ciudadanos recientes: ${rep.map((r) => `${r.titulo || r.tipo} (${r.votos} votos)`).join('; ')}`);
  const cams = Object.values(s.camiones);
  for (const r of s.rutasCamion.slice(0, 6)) {
    const us = cams.filter((c) => c.ruta_id === r.id);
    if (!us.length) continue;
    const prom = Math.round(us.reduce((a, c) => a + pctOcupacion(c), 0) / us.length);
    l.push(`${r.nombre}: ${us.length} unidades, ${prom}% de ocupación promedio`);
  }
  if (s.emergencia && (s.emergencia.estado === 'solicitada' || s.emergencia.estado === 'en_camino')) l.push(`Emergencia en curso: ${s.emergencia.tipo} en camino`);
  const p = pronosticoHorario();
  l.push(`${p.titulo} (${p.sub})`);
  if (s.motorVivo) l.push(`${s.nVehiculos} vehículos simulados en circulación`);
  if (s.temperatura != null) l.push(`Temperatura: ${s.temperatura} °C`);
  return l.join('\n');
}

export function haceTexto(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return 'ahora';
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `${d} días`;
}
