export type LngLat = [number, number];

export interface Lugar {
  id: string;
  nombre: string;
  direccion: string;
  lng: number;
  lat: number;
}

export interface Paso {
  instruccion: string;
  calle: string;
  distancia: number; // m hasta la siguiente maniobra
  tipo: string;
  modificador?: string;
  ubicacion: LngLat;
  kmEnRuta?: number; // km desde el inicio de la ruta
}

export interface Ruta {
  geometry: GeoJSON.LineString;
  duracion: number; // s
  distancia: number; // m
  pasos: Paso[];
  resumen: string; // "Av. Universidad"
  fuente: 'mapbox' | 'osrm' | 'local';
}

export type TipoInfra = 'semaforo' | 'alto' | 'tope' | 'cruce' | 'escuela' | 'hospital' | 'parada';

export interface AlertaRuta {
  tipo: TipoInfra | 'zona_escolar' | 'incidente' | 'reporte';
  km: number; // distancia desde el inicio de la ruta
  lng: number;
  lat: number;
  osm_id?: number;
  titulo: string;
  ref?: number | string;
}

export interface Incidente {
  id: number;
  tipo: string;
  descripcion: string | null;
  calle: string | null;
  carril_bloqueado: number[] | null;
  carriles_totales: number | null;
  severidad: number | null;
  retraso_min: number | null;
  votos?: number | null;
  origen?: string | null;
  estado: 'activo' | 'resuelto';
  inicio: string;
  lat: number;
  lng: number;
}

export interface Reporte {
  id: number;
  tipo: string | null;
  severidad: number | null;
  titulo: string | null;
  descripcion: string | null;
  resumen_ia: string | null;
  dependencia: string | null;
  confianza: number | null;
  foto_url: string | null;
  votos: number;
  estado: string;
  lat: number;
  lng: number;
  created_at: string;
}

export interface AlertaN8n {
  id: number;
  tipo: '911_simulado' | 'familiar' | 'desvio' | 'dependencia' | 'resumen' | 'zona_escolar';
  titulo: string | null;
  mensaje: string | null;
  payload: Record<string, unknown> | null;
  incidente_id: number | null;
  created_at: string;
}

export interface Parada {
  nombre: string;
  lat: number;
  lng: number;
  km: number;
}

export interface RutaCamion {
  id: string;
  nombre: string;
  color: string;
  trazo: GeoJSON.LineString;
  paradas: Parada[];
}

export interface Camion {
  id: string;
  ruta_id: string;
  capacidad: number;
  ocupacion: number;
  proxima_parada: string | null;
  eta_min: number | null;
  fuente: 'sim' | 'iot';
  lat: number | null;
  lng: number | null;
  heading?: number | null;
  updated_at: string;
}

export interface Emergencia {
  id: number;
  tipo: string;
  estado: 'solicitada' | 'en_camino' | 'en_sitio' | 'cancelada';
  hospital_id: number | null;
  hospital_nombre?: string | null;
  lat: number;
  lng: number;
  ruta: GeoJSON.LineString | null;
  amb_lat?: number | null;
  amb_lng?: number | null;
  eta_seg: number | null;
  semaforos_verdes: number;
  created_at: string;
}

/** Obra vial activa (public/data/obras.json, fuentes oficiales y prensa local). */
export interface Obra {
  id: string;
  nombre: string;
  calle: string;
  lng: number;
  lat: number;
  afectacion: string;
  sin_afectacion: string | null;
  motivo: string;
  carriles: { total: number; cerrados: number[] } | null;
  inicio: string | null; // YYYY-MM-DD
  fin: string | null; // estimado
  duracion: string;
  impacto_min: number;
  recomendaciones: string[];
  fuente: { nombre: string; url: string | null };
  cierre: GeoJSON.LineString;
  desvios: { titulo: string; texto: string; geometry: GeoJSON.LineString }[];
  alternas_saturadas: string[];
  colonias: string[];
  corredores: GeoJSON.LineString[];
}
