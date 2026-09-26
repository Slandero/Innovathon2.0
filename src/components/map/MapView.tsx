'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Source, type LayerProps, type MapLayerMouseEvent, type MapRef } from 'react-map-gl';
import { CENTRO_CUU, COLORES, ESTILO_MAPBOX, ESTILO_RESPALDO, MAPBOX_TOKEN, USA_MAPBOX } from '@/lib/config';
import { cargarInfra, cargarZonas, zonaActiva, type InfraFC, type ZonasFC } from '@/lib/data/infra';
import { aplicarTrafico, ambulanciasVivas, autos, traficoVivo } from '@/lib/data/vivo';
import { registrarIconoCamion, registrarIconos } from '@/lib/map/icons';
import { getMapa, setDatos, setMapa, type Mapa } from '@/lib/map/instancia';
import { estadoSemaforo } from '@/lib/map/semaforos';
import { useApp } from '@/lib/store';
import { UserMarker } from './UserMarker';

const VACIA: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const ESTADO_NUM = { verde: 0, ambar: 1, rojo: 2 } as const;
const vis = (b: boolean) => (b ? 'visible' : 'none') as 'visible' | 'none';

// ── Prefetch: arranca las descargas de GeoJSON INMEDIATAMENTE al importar el módulo,
// en paralelo con la carga del mapa (no esperamos a onLoad/onStyleData).
let prefetchTramos: Promise<GeoJSON.FeatureCollection> | null = null;
let prefetchInfra: ReturnType<typeof cargarInfra> | null = null;
let prefetchZonas: ReturnType<typeof cargarZonas> | null = null;
if (typeof window !== 'undefined') {
  prefetchTramos = fetch('/data/tramos.geojson').then(r => r.json()).catch(() => VACIA);
  prefetchInfra = cargarInfra();
  // Zonas escolares se difieren un poco: no son críticas para el primer paint
  prefetchZonas = new Promise(resolve => setTimeout(() => resolve(cargarZonas()), 800)).then(p => p as Awaited<ReturnType<typeof cargarZonas>>);
}

// ───────────── Estilos de capas
const traficoLinea: LayerProps = {
  id: 'trafico-l', type: 'line', source: 'trafico',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': ['match', ['coalesce', ['feature-state', 'n'], -1], 0, COLORES.free, 1, COLORES.mod, 2, COLORES.heavy, 3, COLORES.stop, 'rgba(0,0,0,0)'],
    'line-width': ['interpolate', ['linear'], ['zoom'], 11, ['case', ['==', ['get', 'clase'], 'secondary'], 1.5, 2.5], 14, 4.5, 17, 8],
    'line-opacity': ['match', ['coalesce', ['feature-state', 'n'], -1], -1, 0, 0, 0.55, 0.9],
  },
};
const celdasFill: LayerProps = {
  id: 'celdas-f', type: 'fill', source: 'celdas', minzoom: 13,
  paint: {
    'fill-color': ['interpolate', ['linear'], ['get', 'vel'], 0, COLORES.stop, 10, COLORES.heavy, 25, COLORES.mod, 40, COLORES.free],
    'fill-opacity': ['case', ['boolean', ['get', 'anomalia'], false], 0.55, 0.18],
  },
};
const zonasFill: LayerProps = {
  id: 'zonas-f', type: 'fill', source: 'zonas', minzoom: 12,
  paint: { 'fill-color': COLORES.school, 'fill-opacity': 0.16 },
};
const zonasLinea: LayerProps = {
  id: 'zonas-l', type: 'line', source: 'zonas', minzoom: 12,
  paint: { 'line-color': COLORES.school, 'line-width': 1.5, 'line-dasharray': [2, 1.5], 'line-opacity': 0.8 },
};
const rutaAlt: LayerProps = {
  id: 'ruta-alt', type: 'line', source: 'rutas', filter: ['!', ['get', 'sel']],
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': '#9AA0A6', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 5, 16, 9], 'line-opacity': 0.9 },
};
const rutaBorde: LayerProps = {
  id: 'ruta-borde', type: 'line', source: 'rutas', filter: ['get', 'sel'],
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': '#2A3EC7', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 8, 16, 14] },
};
const rutaMain: LayerProps = {
  id: 'ruta-main', type: 'line', source: 'rutas', filter: ['get', 'sel'],
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': COLORES.primary, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 5, 16, 10] },
};
const autosCapa: LayerProps = {
  id: 'autos', type: 'symbol', source: 'autos', minzoom: 11,
  layout: {
    'icon-image': 'auto', 'icon-rotate': ['get', 'h'], 'icon-rotation-alignment': 'map',
    'icon-allow-overlap': true, 'icon-ignore-placement': true,
    'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.55, 15, 0.9, 18, 1.2],
  },
};
const semPunto: LayerProps = {
  id: 'sem-punto', type: 'circle', source: 'infra', maxzoom: 14.5, filter: ['==', ['get', 'tipo'], 'semaforo'],
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 14.5, 4.5],
    'circle-color': ['match', ['coalesce', ['feature-state', 'e'], 0], 2, COLORES.stop, 1, COLORES.mod, COLORES.free],
    'circle-stroke-color': '#fff', 'circle-stroke-width': 1,
  },
};
const semCaja: LayerProps = {
  id: 'sem-caja', type: 'symbol', source: 'infra', minzoom: 14.5, filter: ['==', ['get', 'tipo'], 'semaforo'],
  layout: { 'icon-image': 'semaforo-caja', 'icon-allow-overlap': true, 'icon-ignore-placement': true },
};
const luz = (id: string, estado: number, dy: number, color: string): LayerProps => ({
  id, type: 'circle', source: 'infra', minzoom: 14.5, filter: ['==', ['get', 'tipo'], 'semaforo'],
  paint: {
    'circle-radius': 3.8, 'circle-color': color, 'circle-translate': [0, dy], 'circle-translate-anchor': 'viewport',
    'circle-pitch-alignment': 'viewport', 'circle-blur': 0.15,
    'circle-opacity': ['case', ['==', ['coalesce', ['feature-state', 'e'], -1], estado], 1, 0],
  },
});
const iconosInfra = (id: string, tipos: string[], minzoom: number, visible = true): LayerProps => ({
  id, type: 'symbol', source: 'infra', minzoom, filter: ['in', ['get', 'tipo'], ['literal', tipos]],
  layout: {
    'icon-image': ['get', 'tipo'], 'icon-allow-overlap': true,
    'icon-size': ['interpolate', ['linear'], ['zoom'], minzoom, 0.75, 17, 1.05],
    visibility: vis(visible),
  },
});
const incidentesCapa: LayerProps = {
  id: 'incidentes', type: 'symbol', source: 'incidentes',
  layout: {
    'icon-image': ['match', ['get', 'tipo'], ['obra', 'cierre'], 'obra', 'incidente'],
    'icon-allow-overlap': true, 'icon-ignore-placement': true,
    'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 15, 1.1],
  },
};
const incidentesHalo: LayerProps = {
  id: 'incidentes-halo', type: 'circle', source: 'incidentes',
  paint: { 'circle-radius': 24, 'circle-color': COLORES.sos, 'circle-opacity': 0.15, 'circle-stroke-color': COLORES.sos, 'circle-stroke-width': 1, 'circle-stroke-opacity': 0.4 },
};
const reportesCapa: LayerProps = {
  id: 'reportes', type: 'symbol', source: 'reportes', minzoom: 11,
  layout: { 'icon-image': 'reporte', 'icon-allow-overlap': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 16, 1] },
};
const camionRutas: LayerProps = {
  id: 'camion-rutas', type: 'line', source: 'camion-rutas',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': ['get', 'color'],
    'line-width': ['case', ['get', 'sel'], 6, 3],
    'line-opacity': ['case', ['get', 'sel'], 0.95, 0.45],
  },
};
const camionParadas: LayerProps = {
  id: 'camion-paradas', type: 'circle', source: 'camion-paradas', minzoom: 14,
  paint: { 'circle-radius': 4.5, 'circle-color': '#fff', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2.5 },
};
const camionesCapa: LayerProps = {
  id: 'camiones', type: 'symbol', source: 'camiones',
  layout: {
    'icon-image': ['get', 'icono'], 'icon-allow-overlap': true, 'icon-ignore-placement': true,
    'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 16, 1.05],
  },
};
const emergRuta: LayerProps = {
  id: 'emerg-ruta', type: 'line', source: 'emerg-ruta',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': COLORES.sos, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 9], 'line-opacity': 0.9 },
};
const ambHalo: LayerProps = {
  id: 'amb-halo', type: 'circle', source: 'ambulancia',
  paint: { 'circle-radius': ['get', 'r'], 'circle-color': COLORES.sos, 'circle-opacity': ['get', 'o'] },
};
const ambIcono: LayerProps = {
  id: 'amb-icono', type: 'symbol', source: 'ambulancia',
  layout: { 'icon-image': 'ambulancia', 'icon-allow-overlap': true, 'icon-ignore-placement': true },
};

// Obras: tramo cerrado con franjas rojo/blanco (como las infografías del municipio) y desvíos punteados en verde
const obraBase: LayerProps = {
  id: 'obras-cierre-base', type: 'line', source: 'obras-cierre',
  layout: { 'line-cap': 'butt', 'line-join': 'round' },
  paint: { 'line-color': '#E5252A', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 5, 16, 16], 'line-opacity': 0.55 },
};
const obraRayas: LayerProps = {
  id: 'obras-cierre-rayas', type: 'line', source: 'obras-cierre',
  layout: { 'line-cap': 'butt', 'line-join': 'round' },
  paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 10], 'line-dasharray': [0.5, 0.9], 'line-opacity': 0.9 },
};
const obraDesvio: LayerProps = {
  id: 'obras-desvio', type: 'line', source: 'obras-desvio',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': '#34A853', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 8],
    'line-dasharray': [0.01, 2], 'line-opacity': ['case', ['get', 'tenue'], 0.25, 1],
  },
};
const obraIcono: LayerProps = {
  id: 'obras-icono', type: 'symbol', source: 'obras-punto',
  layout: { 'icon-image': 'obra', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.9, 15, 1.3] },
};

const CAPAS_TRAFICO_MAPBOX = /traffic/i;

export default function MapView() {
  const ref = useRef<MapRef>(null);
  const capas = useApp((s) => s.capas);
  const rutas = useApp((s) => s.rutas);
  const rutaSel = useApp((s) => s.rutaSel);
  const incidentes = useApp((s) => s.incidentes);
  const reportes = useApp((s) => s.reportes);
  const rutasCamion = useApp((s) => s.rutasCamion);
  const rutaCamionSel = useApp((s) => s.rutaCamionSel);
  const forzarZonas = useApp((s) => s.forzarZonas);
  const emergencia = useApp((s) => s.emergencia);
  const obras = useApp((s) => s.obras);
  const obraDesvioSel = useApp((s) => s.obraDesvio);
  const hoja = useApp((s) => s.hoja);
  const [infra, setInfra] = useState<InfraFC | null>(null);
  const [zonas, setZonas] = useState<ZonasFC | null>(null);
  const [minuto, setMinuto] = useState(0);
  const [tramos, setTramos] = useState<GeoJSON.FeatureCollection | null>(null);
  const semIds = useRef<number[]>([]);
  const semEstado = useRef(new globalThis.Map<number, number>());

  const mapLib = useMemo(() => (USA_MAPBOX ? import('mapbox-gl') : import('maplibre-gl')), []);

  // Respaldo sin token: Carto Positron como default inmediato (sin fetch bloqueante),
  // luego intenta cargar OpenFreeMap "liberty" para mejorar la estética.
  const CARTO_FALLBACK = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
  const [estilo, setEstilo] = useState<string | object | null>(USA_MAPBOX ? ESTILO_MAPBOX : CARTO_FALLBACK);
  useEffect(() => {
    if (USA_MAPBOX) return;
    // Intentar reemplazar con OpenFreeMap (más bonito) de forma no-bloqueante
    fetch(ESTILO_RESPALDO)
      .then((r) => r.json())
      .then((st: { sources: Record<string, { type: string }>; layers: { source?: string }[] }) => {
        const raster = Object.keys(st.sources).filter((k) => st.sources[k].type.startsWith('raster'));
        for (const k of raster) delete st.sources[k];
        st.layers = st.layers.filter((l) => !l.source || !raster.includes(l.source));
        setEstilo(st);
      })
      .catch(() => { /* Ya tenemos Carto cargado, no hacer nada */ });
  }, []);

  // ── Carga de mapa. Se inicializa con el primer 'styledata' (no con 'load': una fuente
  // lenta del estilo base puede retrasar 'load' varios segundos).
  const iniciado = useRef(false);
  const onLoad = useCallback(() => {
    const m = ref.current?.getMap() as unknown as Mapa | undefined;
    if (!m || iniciado.current) return;
    iniciado.current = true;
    setMapa(m);
    if (process.env.NODE_ENV === 'development') (window as unknown as { __mapa: unknown }).__mapa = m;
    registrarIconos(m);
    m.on('styleimagemissing', () => registrarIconos(m));
    // Usar los prefetches que ya están en vuelo (no vuelve a hacer fetch)
    (prefetchTramos || fetch('/data/tramos.geojson').then(r => r.json()).catch(() => VACIA)).then(setTramos);
    (prefetchInfra || cargarInfra()).then(i => {
      semIds.current = i.features.filter((f) => f.properties.tipo === 'semaforo').map((f) => f.properties.osm_id);
      semEstado.current.clear();
      setInfra(i);
    });
    (prefetchZonas || cargarZonas()).then(z => setZonas(z));
  }, []);

  // Al desmontar (cambio de página, recarga en caliente) suelta la referencia global
  useEffect(() => () => { setMapa(null); iniciado.current = false; }, []);

  // Al cargar la geometría de tramos, re-aplica los niveles recibidos
  useEffect(() => {
    if (!tramos) return;
    traficoVivo.aplicados.clear();
    const t = setTimeout(aplicarTrafico, 300);
    return () => clearTimeout(t);
  }, [tramos]);

  // ── Zonas escolares: solo las activas por horario (se reevalúa cada minuto)
  useEffect(() => {
    const t = setInterval(() => setMinuto((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  const zonasFC = useMemo<GeoJSON.FeatureCollection>(() => (
    zonas ? { type: 'FeatureCollection', features: zonas.features.filter((f) => zonaActiva(f.properties.horarios, forzarZonas)) } : VACIA
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [zonas, forzarZonas, minuto]);

  // ── Semáforos: feature-state cada 500 ms, sin recrear la capa
  useEffect(() => {
    const t = setInterval(() => {
      const m = getMapa();
      try { if (!m || !m.getSource('infra')) return; } catch { return; }
      const ahora = Date.now();
      const ov = useApp.getState().overrides;
      for (const id of semIds.current) {
        const e = ESTADO_NUM[estadoSemaforo(id, ahora, ov[id])];
        if (semEstado.current.get(id) !== e) {
          semEstado.current.set(id, e);
          try { m.setFeatureState({ source: 'infra', id }, { e }); } catch { /* fuente aún cargando */ }
        }
      }
    }, 500);
    return () => clearInterval(t);
  }, []);

  // ── Tráfico real de Mapbox (capas del estilo navigation-day)
  useEffect(() => {
    const m = ref.current?.getMap();
    if (!m || !USA_MAPBOX) return;
    const aplicar = () => {
      for (const l of m.getStyle()?.layers || []) {
        if (CAPAS_TRAFICO_MAPBOX.test(l.id)) m.setLayoutProperty(l.id, 'visibility', vis(capas.trafico));
      }
    };
    if (m.isStyleLoaded()) aplicar();
    else m.once('styledata', aplicar);
  }, [capas.trafico]);

  // ── Animación: autos, camiones y ambulancia interpolados (~30 fps)
  useEffect(() => {
    let raf = 0;
    let ultimo = 0;
    const camPrev = new globalThis.Map<string, { de: [number, number]; a: [number, number]; t: number; h: number }>();
    const iconosCamion = new globalThis.Map<string, string>();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - ultimo < 33) return;
      ultimo = t;
      const m = getMapa();
      if (!m) return;
      try { cuadro(m, t); } catch { /* mapa desmontándose */ }
    };
    const cuadro = (m: Mapa, t: number) => {
      // Autos del motor
      const f = autos.tNext ? Math.min(1, (performance.now() - autos.tNext) / autos.dt) : 1;
      const feats: GeoJSON.Feature[] = [];
      for (const [id, n] of autos.next) {
        const p = autos.prev.get(id) || n;
        feats.push({
          type: 'Feature', id,
          geometry: { type: 'Point', coordinates: [p[0] + (n[0] - p[0]) * f, p[1] + (n[1] - p[1]) * f] },
          properties: { h: n[2] },
        });
      }
      setDatos('autos', { type: 'FeatureCollection', features: feats });

      // Camiones (posiciones cada ~3 s desde /api/iot/ingest → tabla camiones)
      const s = useApp.getState();
      const rutasPorId = Object.fromEntries(s.rutasCamion.map((r) => [r.id, r]));
      const cams: GeoJSON.Feature[] = [];
      for (const c of Object.values(s.camiones)) {
        if (c.lat == null || c.lng == null) continue;
        if (s.rutaCamionSel && c.ruta_id !== s.rutaCamionSel) continue;
        const destino: [number, number] = [c.lng, c.lat];
        let e = camPrev.get(c.id);
        if (!e) { e = { de: destino, a: destino, t: performance.now(), h: c.heading || 0 }; camPrev.set(c.id, e); }
        if (e.a[0] !== destino[0] || e.a[1] !== destino[1]) {
          const k = Math.min(1, (performance.now() - e.t) / 3000);
          e.de = [e.de[0] + (e.a[0] - e.de[0]) * k, e.de[1] + (e.a[1] - e.de[1]) * k];
          e.a = destino;
          e.t = performance.now();
        }
        const k = Math.min(1, (performance.now() - e.t) / 3000);
        const color = rutasPorId[c.ruta_id]?.color || COLORES.primary;
        const occ = Math.round((c.ocupacion / Math.max(1, c.capacidad)) * 100);
        const icono = `camion-${c.id}`;
        const clave = `${color}-${Math.round(occ / 5)}`;
        if (iconosCamion.get(icono) !== clave) { registrarIconoCamion(m, icono, color, occ); iconosCamion.set(icono, clave); }
        cams.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [e.de[0] + (e.a[0] - e.de[0]) * k, e.de[1] + (e.a[1] - e.de[1]) * k] },
          properties: { id: c.id, icono },
        });
      }
      setDatos('camiones', { type: 'FeatureCollection', features: cams });

      // Ambulancia: del motor (broadcast) o de la emergencia local
      const pulso = (t % 1600) / 1600;
      // Incidentes: halo que late para que se note el choque
      if (s.incidentes.length && m.getLayer('incidentes-halo')) {
        m.setPaintProperty?.('incidentes-halo', 'circle-radius', 14 + pulso * 26);
        m.setPaintProperty?.('incidentes-halo', 'circle-opacity', 0.35 * (1 - pulso));
        m.setPaintProperty?.('incidentes-halo', 'circle-stroke-opacity', 0.6 * (1 - pulso));
      }
      const amb: GeoJSON.Feature[] = [];
      const lista = ambulanciasVivas.lista.length
        ? ambulanciasVivas.lista.map(([, lat, lng]) => [lng, lat])
        : s.emergencia?.amb_lng != null && s.emergencia.estado === 'en_camino' ? [[s.emergencia.amb_lng, s.emergencia.amb_lat!]] : [];
      for (const c of lista) {
        amb.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { r: 14 + pulso * 26, o: 0.35 * (1 - pulso) } });
      }
      setDatos('ambulancia', { type: 'FeatureCollection', features: amb });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Datos declarativos
  const rutasFC = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    // la seleccionada al final para que quede encima
    features: rutas
      .map((r, i) => ({ type: 'Feature' as const, geometry: r.geometry, properties: { idx: i, sel: i === rutaSel } }))
      .sort((a, b) => Number(a.properties.sel) - Number(b.properties.sel)),
  }), [rutas, rutaSel]);

  const incidentesFC = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: incidentes.filter((i) => i.estado === 'activo').map((i) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [i.lng, i.lat] }, properties: { id: i.id, tipo: i.tipo },
    })),
  }), [incidentes]);

  const reportesFC = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: reportes.map((r) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [r.lng, r.lat] }, properties: { id: r.id, tipo: r.tipo },
    })),
  }), [reportes]);

  const camionRutasFC = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: rutasCamion
      .filter((r) => !rutaCamionSel || r.id === rutaCamionSel)
      .map((r) => ({ type: 'Feature', geometry: r.trazo, properties: { id: r.id, color: r.color, sel: r.id === rutaCamionSel } })),
  }), [rutasCamion, rutaCamionSel]);

  const paradasFC = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: rutasCamion
      .filter((r) => !rutaCamionSel || r.id === rutaCamionSel)
      .flatMap((r) => (r.paradas || []).map((p) => ({
        type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] }, properties: { color: r.color, nombre: p.nombre },
      }))),
  }), [rutasCamion, rutaCamionSel]);

  const obrasCierreFC = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: obras.map((o) => ({ type: 'Feature', geometry: o.cierre, properties: { id: o.id } })),
  }), [obras]);
  const obrasPuntoFC = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: obras.map((o) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [o.lng, o.lat] }, properties: { id: o.id } })),
  }), [obras]);
  // Desvíos: solo de la obra abierta en la hoja
  const obraAbierta = hoja?.tipo === 'obra' ? obras.find((o) => o.id === hoja.id)
    : hoja?.tipo === 'incidente' && hoja.id < 0 ? obras[-hoja.id - 1] : undefined;
  const obrasDesvioFC = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: (obraAbierta?.desvios || []).map((d, i) => ({
      type: 'Feature', geometry: d.geometry, properties: { i, tenue: obraDesvioSel != null && obraDesvioSel !== i },
    })),
  }), [obraAbierta, obraDesvioSel]);

  const emergRutaFC = useMemo<GeoJSON.FeatureCollection>(() => (
    emergencia?.ruta && emergencia.estado !== 'cancelada'
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: emergencia.ruta, properties: {} }] }
      : VACIA
  ), [emergencia]);

  // ── Clics
  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    const s = useApp.getState();
    if (!f) return;
    const capa = f.layer?.id;
    if (capa === 'ruta-alt') s.set({ rutaSel: Number(f.properties?.idx) });
    else if (capa === 'incidentes') s.set({ hoja: { tipo: 'incidente', id: Number(f.properties?.id) } });
    else if (capa === 'reportes') s.set({ hoja: { tipo: 'reporte', id: Number(f.properties?.id) } });
    else if (capa === 'camiones') s.set({ hoja: { tipo: 'camion', id: String(f.properties?.id) } });
    else if (capa === 'obras-icono' || capa === 'obras-cierre-base') s.set({ hoja: { tipo: 'obra', id: String(f.properties?.id) }, obraDesvio: null });
    else if (capa === 'sem-caja' || capa === 'sem-punto') {
      const id = Number(f.properties?.osm_id);
      const est = estadoSemaforo(id, Date.now(), s.overrides[id]);
      s.toast({ tipo: 'info', titulo: `Semáforo en ${est === 'ambar' ? 'ámbar' : est}`, texto: s.overrides[id] ? 'Controlado por ViveCUU' : 'Ciclo 90 s · sincronizado con el motor' });
    } else if (capa?.startsWith('infra-')) {
      const nombre = f.properties?.nombre;
      const tipo = String(f.properties?.tipo);
      const nombres: Record<string, string> = { alto: 'Alto', tope: 'Tope', cruce: 'Cruce peatonal', escuela: 'Escuela', hospital: 'Hospital', parada: 'Parada de camión' };
      s.toast({ tipo: 'info', titulo: nombre || nombres[tipo] || tipo, texto: nombre ? nombres[tipo] : 'Dato de OpenStreetMap' });
    }
  }, []);

  const interactivos = ['obras-icono', 'obras-cierre-base', 'ruta-alt', 'incidentes', 'reportes', 'camiones', 'sem-caja', 'sem-punto', 'infra-altos', 'infra-escuelas', 'infra-hospital', 'infra-paradas'];

  if (!estilo) return null;
  return (
    <Map
      ref={ref}
      mapLib={mapLib as never}
      mapboxAccessToken={USA_MAPBOX ? MAPBOX_TOKEN : undefined}
      mapStyle={estilo as string}
      initialViewState={{ longitude: CENTRO_CUU.lng, latitude: CENTRO_CUU.lat, zoom: 13 }}
      style={{ position: 'absolute', inset: 0 }}
      attributionControl={false}
      interactiveLayerIds={interactivos}
      onClick={onClick}
      onLoad={onLoad}
      onStyleData={onLoad}
      onError={(e) => console.warn('mapa', e.error?.message || e)}
      dragRotate
      maxPitch={70}
    >
      <Source id="zonas" type="geojson" data={zonasFC}>
        <Layer {...zonasFill} layout={{ visibility: vis(capas.escuelas) }} />
        <Layer {...zonasLinea} layout={{ visibility: vis(capas.escuelas) }} />
      </Source>
      <Source id="celdas" type="geojson" data={VACIA}>
        <Layer {...celdasFill} layout={{ visibility: vis(capas.trafico) }} />
      </Source>
      <Source id="trafico" type="geojson" data={tramos || VACIA} promoteId="id">
        <Layer {...traficoLinea} layout={{ ...traficoLinea.layout, visibility: vis(capas.trafico) }} />
      </Source>
      <Source id="camion-rutas" type="geojson" data={camionRutasFC}>
        <Layer {...camionRutas} layout={{ ...camionRutas.layout, visibility: vis(capas.camiones) }} />
      </Source>
      <Source id="obras-cierre" type="geojson" data={obrasCierreFC}>
        <Layer {...obraBase} layout={{ ...obraBase.layout, visibility: vis(capas.obras) }} />
        <Layer {...obraRayas} layout={{ ...obraRayas.layout, visibility: vis(capas.obras) }} />
      </Source>
      <Source id="obras-desvio" type="geojson" data={obrasDesvioFC}>
        <Layer {...obraDesvio} />
      </Source>
      <Source id="rutas" type="geojson" data={rutasFC}>
        <Layer {...rutaAlt} />
        <Layer {...rutaBorde} />
        <Layer {...rutaMain} />
      </Source>
      <Source id="emerg-ruta" type="geojson" data={emergRutaFC}>
        <Layer {...emergRuta} />
      </Source>
      <Source id="camion-paradas" type="geojson" data={paradasFC}>
        <Layer {...camionParadas} layout={{ visibility: vis(capas.camiones) }} />
      </Source>
      <Source id="autos" type="geojson" data={VACIA}>
        <Layer {...autosCapa} layout={{ ...autosCapa.layout, visibility: vis(capas.trafico) }} />
      </Source>
      <Source id="infra" type="geojson" data={infra || VACIA} promoteId="osm_id">
        <Layer {...iconosInfra('infra-cruces', ['cruce'], 16, capas.altos)} />
        <Layer {...iconosInfra('infra-paradas', ['parada'], 14, capas.camiones)} />
        <Layer {...iconosInfra('infra-escuelas', ['escuela'], 13, capas.escuelas)} />
        <Layer {...iconosInfra('infra-hospital', ['hospital'], 11)} />
        <Layer {...iconosInfra('infra-altos', ['alto', 'tope'], 13.5, capas.altos)} />
        <Layer {...semPunto} layout={{ visibility: vis(capas.semaforos) }} />
        <Layer {...semCaja} layout={{ ...semCaja.layout, visibility: vis(capas.semaforos) }} />
        <Layer {...luz('sem-rojo', 2, -9, '#FF3B30')} layout={{ visibility: vis(capas.semaforos) }} />
        <Layer {...luz('sem-ambar', 1, 0, '#FFC400')} layout={{ visibility: vis(capas.semaforos) }} />
        <Layer {...luz('sem-verde', 0, 9, '#2BD15A')} layout={{ visibility: vis(capas.semaforos) }} />
      </Source>
      <Source id="reportes" type="geojson" data={reportesFC}>
        <Layer {...reportesCapa} layout={{ ...reportesCapa.layout, visibility: vis(capas.reportes) }} />
      </Source>
      <Source id="obras-punto" type="geojson" data={obrasPuntoFC}>
        <Layer {...obraIcono} layout={{ ...obraIcono.layout, visibility: vis(capas.obras) }} />
      </Source>
      <Source id="incidentes" type="geojson" data={incidentesFC}>
        <Layer {...incidentesHalo} />
        <Layer {...incidentesCapa} />
      </Source>
      <Source id="camiones" type="geojson" data={VACIA}>
        <Layer {...camionesCapa} layout={{ ...camionesCapa.layout, visibility: vis(capas.camiones) }} />
      </Source>
      <Source id="ambulancia" type="geojson" data={VACIA}>
        <Layer {...ambHalo} />
        <Layer {...ambIcono} />
      </Source>
      <UserMarker />
    </Map>
  );
}
