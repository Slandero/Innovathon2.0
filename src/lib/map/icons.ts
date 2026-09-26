/**
 * Íconos del mapa dibujados en canvas (sin assets externos) y registrados con map.addImage.
 * Funcionan igual con Mapbox GL y con MapLibre.
 */
import { COLORES } from '@/lib/config';

type Ctx = CanvasRenderingContext2D;
type Dibujo = (c: Ctx, s: number) => void;

const PR = 2; // pixel ratio de los íconos

function sombra(c: Ctx) {
  c.shadowColor = 'rgba(0,0,0,.25)';
  c.shadowBlur = 3;
  c.shadowOffsetY = 1;
}
function sinSombra(c: Ctx) {
  c.shadowColor = 'transparent';
  c.shadowBlur = 0;
  c.shadowOffsetY = 0;
}

function circuloBlanco(c: Ctx, s: number, color: string) {
  sombra(c);
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
  c.fill();
  sinSombra(c);
  c.fillStyle = color;
  c.beginPath();
  c.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
  c.fill();
}

const ICONOS: Record<string, [number, number, Dibujo]> = {
  // Caja del semáforo: pastilla oscura con tres luces apagadas (las luces encendidas son capas circle)
  'semaforo-caja': [14, 34, (c, _s) => {
    sombra(c);
    c.fillStyle = '#2B2F36';
    c.beginPath();
    c.roundRect(1, 1, 12, 32, 6);
    c.fill();
    sinSombra(c);
    for (const y of [8, 17, 26]) {
      c.fillStyle = '#4A505A';
      c.beginPath();
      c.arc(7, y, 3.6, 0, Math.PI * 2);
      c.fill();
    }
  }],
  alto: [26, 26, (c, s) => {
    sombra(c);
    const r = s / 2 - 1.5;
    c.fillStyle = '#fff';
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      c.lineTo(s / 2 + r * Math.cos(a), s / 2 + r * Math.sin(a));
    }
    c.closePath();
    c.fill();
    sinSombra(c);
    c.fillStyle = '#D0021B';
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      c.lineTo(s / 2 + (r - 1.8) * Math.cos(a), s / 2 + (r - 1.8) * Math.sin(a));
    }
    c.closePath();
    c.fill();
    c.fillStyle = '#fff';
    c.font = 'bold 7px Inter, Arial, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('ALTO', s / 2, s / 2 + 0.5);
  }],
  tope: [26, 24, (c) => {
    sombra(c);
    c.fillStyle = '#1F2328';
    c.beginPath();
    c.moveTo(13, 1); c.lineTo(25, 22); c.lineTo(1, 22); c.closePath();
    c.fill();
    sinSombra(c);
    c.fillStyle = '#FBBC04';
    c.beginPath();
    c.moveTo(13, 4.5); c.lineTo(22, 20); c.lineTo(4, 20); c.closePath();
    c.fill();
    c.fillStyle = '#1F2328';
    c.beginPath();
    c.ellipse(13, 16, 5, 2.4, 0, Math.PI, 0);
    c.fill();
  }],
  cruce: [22, 22, (c, s) => {
    circuloBlanco(c, s, '#5F6B7A');
    c.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) c.fillRect(6 + i * 3, 7, 1.8, 8);
  }],
  escuela: [26, 26, (c, s) => {
    circuloBlanco(c, s, COLORES.school);
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(5.5, 11); c.lineTo(13, 7); c.lineTo(20.5, 11); c.lineTo(13, 15); c.closePath();
    c.fill();
    c.fillRect(9, 12.5, 8, 4.5);
    c.fillRect(19.5, 11, 1, 5);
  }],
  hospital: [26, 26, (c, s) => {
    circuloBlanco(c, s, '#fff');
    c.fillStyle = COLORES.sos;
    c.fillRect(11, 6, 4, 14);
    c.fillRect(6, 11, 14, 4);
  }],
  parada: [20, 20, (c, s) => {
    circuloBlanco(c, s, COLORES.primary);
    c.fillStyle = '#fff';
    c.beginPath();
    c.roundRect(6, 5, 8, 9, 2);
    c.fill();
    c.fillStyle = COLORES.primary;
    c.fillRect(7.3, 6.5, 5.4, 3);
  }],
  incidente: [34, 34, (c, s) => {
    sombra(c);
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(s / 2, 1); c.lineTo(s - 1, s / 2); c.lineTo(s / 2, s - 1); c.lineTo(1, s / 2); c.closePath();
    c.fill();
    sinSombra(c);
    c.fillStyle = COLORES.sos;
    c.beginPath();
    c.moveTo(s / 2, 4); c.lineTo(s - 4, s / 2); c.lineTo(s / 2, s - 4); c.lineTo(4, s / 2); c.closePath();
    c.fill();
    c.fillStyle = '#fff';
    c.fillRect(s / 2 - 1.6, 9, 3.2, 10);
    c.fillRect(s / 2 - 1.6, 21.5, 3.2, 3.2);
  }],
  obra: [28, 28, (c, s) => {
    circuloBlanco(c, s, COLORES.heavy);
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(14, 6); c.lineTo(19, 20); c.lineTo(9, 20); c.closePath();
    c.fill();
    c.fillStyle = COLORES.heavy;
    c.fillRect(10.5, 13, 7, 2);
  }],
  reporte: [26, 26, (c, s) => {
    circuloBlanco(c, s, COLORES.brand);
    c.strokeStyle = '#fff';
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(8, 9); c.lineTo(12, 13); c.lineTo(10, 15); c.lineTo(15, 19);
    c.moveTo(14, 8); c.lineTo(16, 12); c.lineTo(19, 13);
    c.stroke();
  }],
  ambulancia: [32, 32, (c, s) => {
    circuloBlanco(c, s, '#fff');
    c.fillStyle = COLORES.sos;
    c.beginPath();
    c.roundRect(6, 10, 20, 11, 2);
    c.fill();
    c.fillStyle = '#fff';
    c.fillRect(13, 12, 2.4, 7);
    c.fillRect(10.6, 14.3, 7.2, 2.4);
    c.fillStyle = '#1F2328';
    c.beginPath(); c.arc(11, 22, 2.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(21, 22, 2.2, 0, Math.PI * 2); c.fill();
  }],
  auto: [12, 16, (c) => {
    sombra(c);
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(6, 1); c.lineTo(11, 15); c.lineTo(6, 12); c.lineTo(1, 15); c.closePath();
    c.fill();
    sinSombra(c);
    c.fillStyle = '#5F6B7A';
    c.beginPath();
    c.moveTo(6, 3.2); c.lineTo(9.3, 13); c.lineTo(6, 10.8); c.lineTo(2.7, 13); c.closePath();
    c.fill();
  }],
};

function crear(ancho: number, alto: number, dibujo: Dibujo): ImageData {
  const cv = document.createElement('canvas');
  cv.width = ancho * PR;
  cv.height = alto * PR;
  const c = cv.getContext('2d')!;
  c.scale(PR, PR);
  dibujo(c, Math.min(ancho, alto));
  return c.getImageData(0, 0, cv.width, cv.height);
}

/** Camión: cápsula con color de ruta y anillo de ocupación. */
export function iconoCamion(color: string, ocupacionPct: number): ImageData {
  return crear(34, 34, (c) => {
    const occ = Math.max(0, Math.min(1, ocupacionPct / 100));
    const colorOcc = occ < 0.5 ? COLORES.free : occ < 0.8 ? COLORES.mod : COLORES.stop;
    sombra(c);
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(17, 17, 15.5, 0, Math.PI * 2); c.fill();
    sinSombra(c);
    c.strokeStyle = '#E3E6EA';
    c.lineWidth = 3;
    c.beginPath(); c.arc(17, 17, 13.5, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = colorOcc;
    c.beginPath(); c.arc(17, 17, 13.5, -Math.PI / 2, -Math.PI / 2 + occ * Math.PI * 2); c.stroke();
    c.fillStyle = color;
    c.beginPath(); c.roundRect(9, 9.5, 16, 15, 4); c.fill();
    c.fillStyle = '#fff';
    c.fillRect(11, 12, 12, 5);
    c.fillStyle = color;
    c.fillRect(16.4, 12, 1.2, 5);
    c.fillStyle = '#1F2328';
    c.beginPath(); c.arc(13, 24.5, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(21, 24.5, 1.6, 0, Math.PI * 2); c.fill();
  });
}

interface MapaConImagenes {
  hasImage(id: string): boolean;
  addImage(id: string, img: ImageData, opts?: { pixelRatio?: number }): void;
  updateImage?(id: string, img: ImageData): void;
}

export function registrarIconos(map: MapaConImagenes) {
  for (const [id, [w, h, d]] of Object.entries(ICONOS)) {
    if (!map.hasImage(id)) map.addImage(id, crear(w, h, d), { pixelRatio: PR });
  }
}

export function registrarIconoCamion(map: MapaConImagenes, id: string, color: string, occ: number) {
  const img = iconoCamion(color, occ);
  if (map.hasImage(id)) map.updateImage?.(id, img);
  else map.addImage(id, img, { pixelRatio: PR });
}
