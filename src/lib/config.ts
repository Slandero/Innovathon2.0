export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
export const USA_MAPBOX = MAPBOX_TOKEN.startsWith('pk.');

export const ESTILO_MAPBOX = 'mapbox://styles/mapbox/navigation-day-v1';
export const ESTILO_RESPALDO = 'https://tiles.openfreemap.org/styles/liberty';

export const CENTRO_CUU = { lat: 28.635, lng: -106.089 };
/** oeste, sur, este, norte */
export const BBOX_CUU: [number, number, number, number] = [-106.2, 28.55, -105.95, 28.76];

export const ELEVENLABS_AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '';

export const COLORES = {
  brand: '#7C5CFF',
  primary: '#3D5AFE',
  sos: '#E5252A',
  free: '#34A853',
  mod: '#FBBC04',
  heavy: '#F57C00',
  stop: '#C5221F',
  school: '#8E44AD',
  text: '#1F2328',
  text2: '#5F6B7A',
};
