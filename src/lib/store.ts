'use client';
import { create } from 'zustand';
import type { ResumenAlertas } from '@/lib/map/alertas';
import type { Override } from '@/lib/map/semaforos';
import type {
  AlertaN8n, AlertaRuta, Camion, Emergencia, Incidente, Lugar, Obra, Reporte, Ruta, RutaCamion,
} from '@/lib/types';

export type Capa = 'trafico' | 'camiones' | 'semaforos' | 'altos' | 'escuelas' | 'obras' | 'reportes';
export type Tab = 'mapa' | 'camiones' | 'quepasa' | 'asistente';
export type Hoja =
  | { tipo: 'incidente'; id: number }
  | { tipo: 'reporte'; id: number }
  | { tipo: 'camion'; id: string }
  | { tipo: 'obra'; id: string }
  | null;
export type Flujo = 'reportar' | 'sos' | 'copiloto' | null;

export interface Ubicacion { lng: number; lat: number; heading: number | null; precision?: number }
export interface Toast { id: string; tipo: 'sos' | 'info' | 'ok' | 'desvio' | 'familiar' | 'dependencia'; titulo: string; texto?: string }

interface Estado {
  tab: Tab;
  capas: Record<Capa, boolean>;
  ubicacion: Ubicacion | null;
  permiso: 'pendiente' | 'si' | 'no';
  busquedaAbierta: boolean;
  lugar: Lugar | null;
  rutas: Ruta[];
  rutaSel: number;
  alertas: AlertaRuta[];
  resumen: ResumenAlertas | null;
  cargandoRuta: boolean;
  navegando: boolean;
  simulando: boolean;
  posSim: Ubicacion | null;
  velSim: 1 | 3 | 5;
  hoja: Hoja;
  flujo: Flujo;
  toasts: Toast[];
  // datos vivos
  incidentes: Incidente[];
  obras: Obra[];
  /** Desvío resaltado en el mapa (índice) de la obra abierta. */
  obraDesvio: number | null;
  reportes: Reporte[];
  alertasN8n: AlertaN8n[];
  overrides: Record<number, Override>;
  nVehiculos: number;
  motorVivo: boolean;
  /** Sin motor: la app simula autos y tráfico por su cuenta. */
  simLocal: boolean;
  temperatura: number | null;
  forzarZonas: boolean;
  rutasCamion: RutaCamion[];
  camiones: Record<string, Camion>;
  rutaCamionSel: string | null;
  emergencia: Emergencia | null;
  /** "Avísame cuando esté cerca": camión y parada que vigilamos. */
  avisoCamion: { camionId: string; rutaId: string; parada: string } | null;

  set: (p: Partial<Estado>) => void;
  toggleCapa: (c: Capa) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  quitarToast: (id: string) => void;
  limpiarRuta: () => void;
}

const leerCapas = (): Record<Capa, boolean> => {
  const base = { trafico: true, camiones: true, semaforos: true, altos: true, escuelas: true, obras: true, reportes: true };
  try {
    const g = typeof window !== 'undefined' ? localStorage.getItem('vivecuu:capas') : null;
    return g ? { ...base, ...JSON.parse(g) } : base;
  } catch {
    return base;
  }
};

export const useApp = create<Estado>((set, get) => ({
  tab: 'mapa',
  capas: leerCapas(),
  ubicacion: null,
  permiso: 'pendiente',
  busquedaAbierta: false,
  lugar: null,
  rutas: [],
  rutaSel: 0,
  alertas: [],
  resumen: null,
  cargandoRuta: false,
  navegando: false,
  simulando: false,
  posSim: null,
  velSim: 1,
  hoja: null,
  flujo: null,
  toasts: [],
  incidentes: [],
  obras: [],
  obraDesvio: null,
  reportes: [],
  alertasN8n: [],
  overrides: {},
  nVehiculos: 0,
  motorVivo: false,
  simLocal: false,
  temperatura: null,
  forzarZonas: false,
  rutasCamion: [],
  camiones: {},
  rutaCamionSel: null,
  emergencia: null,
  avisoCamion: null,

  set: (p) => set(p),
  toggleCapa: (c) => {
    const capas = { ...get().capas, [c]: !get().capas[c] };
    try { localStorage.setItem('vivecuu:capas', JSON.stringify(capas)); } catch { /* sin storage */ }
    set({ capas });
  },
  toast: (t) => {
    const id = Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    setTimeout(() => get().quitarToast(id), t.tipo === 'sos' ? 9000 : 6000);
  },
  quitarToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  limpiarRuta: () => set({ rutas: [], rutaSel: 0, alertas: [], resumen: null, navegando: false, simulando: false, posSim: null }),
}));

/** Posición efectiva del usuario: la simulada si hay viaje simulado. */
export const posicionActual = (s: Pick<Estado, 'posSim' | 'ubicacion'>) => s.posSim ?? s.ubicacion;
