'use client';
import { useEffect, useRef, useState } from 'react';
import { hablar } from '@/lib/acciones';
import { CENTRO_CUU } from '@/lib/config';
import { llamarCiudad } from '@/lib/local/aplicar';
import { encuadrar } from '@/lib/map/instancia';
import { posicionActual, useApp } from '@/lib/store';
import type { Emergencia } from '@/lib/types';
import type { RespuestaCiudad } from '@/lib/eventos';
import { Icon } from '../ui/Icon';

type Tipo = 'ambulancia' | 'bomberos' | 'policia';
const OPCIONES: { tipo: Tipo; label: string; icon: string; caja: string; icono: string }[] = [
  { tipo: 'ambulancia', label: 'Ambulancia', icon: 'ambulance', caja: 'bg-sos text-white', icono: 'text-white' },
  { tipo: 'bomberos', label: 'Bomberos', icon: 'local_fire_department', caja: 'bg-[#FCE8E6] text-[#8C1D18]', icono: 'text-sos' },
  { tipo: 'policia', label: 'Policía', icon: 'local_police', caja: 'bg-[#ECEEFF] text-[#2A3EC7]', icono: 'text-primary' },
];
const NOMBRE: Record<string, { unidad: string; icon: string; llego: string }> = {
  ambulancia: { unidad: 'Ambulancia', icon: 'ambulance', llego: 'La ambulancia llegó' },
  bomberos: { unidad: 'Bomberos', icon: 'local_fire_department', llego: 'Los bomberos llegaron' },
  policia: { unidad: 'Patrulla', icon: 'local_police', llego: 'La patrulla llegó' },
};

/** B6a · elegir servicio. El 911 es SIEMPRE simulado. */
function Elegir({ onElegir, enviando }: { onElegir: (t: Tipo) => void; enviando: Tipo | null }) {
  const set = useApp((s) => s.set);
  return (
    <div className="absolute inset-0 z-50 flex animate-fade-in flex-col bg-white">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-[18px] px-5 pb-[max(34px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <h2 className="text-[26px] font-extrabold tracking-[-0.5px] text-traffic-stop">SOS</h2>
          <button aria-label="Cerrar" onClick={() => set({ flujo: null })} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink active:scale-95">
            <Icon name="close" size={22} />
          </button>
        </div>
        <p className="text-base text-ink-2">¿Qué necesitas? Enviamos tu ubicación.</p>
        <div className="flex flex-col gap-3">
          {OPCIONES.map((o) => (
            <button
              key={o.tipo}
              disabled={enviando != null}
              onClick={() => onElegir(o.tipo)}
              className={`flex h-[88px] items-center gap-4 rounded-[20px] px-5 text-left transition active:scale-[.98] disabled:opacity-60 ${o.caja}`}
            >
              <Icon name={o.icon} size={36} fill className={o.icono} />
              <span className="flex-1 text-xl font-bold">{o.label}</span>
              {enviando === o.tipo && <Icon name="progress_activity" size={24} className="animate-spin" />}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 rounded-2xl bg-[#FEF4E0] px-4 py-3.5">
          <Icon name="call" size={24} fill className="text-[#B06000]" />
          <span className="text-[15px] font-semibold text-[#6B4400]">Si es grave llama al 911</span>
        </div>
      </div>
    </div>
  );
}

/** B6b · seguimiento de la unidad con ola verde. */
function Seguimiento({ e }: { e: Emergencia }) {
  const set = useApp((s) => s.set);
  const toast = useApp((s) => s.toast);
  const encuadrado = useRef(false);
  const n = NOMBRE[e.tipo] || NOMBRE.ambulancia;
  const llego = e.estado === 'en_sitio';
  const buscando = e.estado === 'solicitada';
  const min = e.eta_seg != null ? Math.max(1, Math.ceil(e.eta_seg / 60)) : null;

  useEffect(() => {
    if (e.ruta && !encuadrado.current) {
      encuadrado.current = true;
      encuadrar(e.ruta.coordinates, { top: 150, bottom: 340, left: 50, right: 50 });
    }
  }, [e.ruta]);

  const llamar911 = async () => {
    // Simulado: jamás se marca a un número real
    const r = await llamarCiudad('/api/sos', { accion: 'llamar911', id: e.id });
    if (!r) toast({ tipo: 'sos', titulo: 'Llamada al 911 (simulada)', texto: 'Te enlazamos con la operadora' });
    hablar('Te enlazamos con el 911. Esta es una simulación.');
  };
  const cancelar = async () => {
    if (!llego) await llamarCiudad('/api/sos', { accion: 'cancelar', id: e.id });
    set({ emergencia: llego ? null : { ...e, estado: 'cancelada' }, flujo: null });
    if (!llego) toast({ tipo: 'info', titulo: 'Cancelamos la solicitud' });
  };

  return (
    <>
      <div className="absolute inset-x-0 top-0 z-50 mx-auto w-full max-w-[480px] animate-fade-in rounded-b-[24px] bg-traffic-stop px-5 pb-4 pt-[max(12px,env(safe-area-inset-top))] text-white shadow-float">
        <div className="flex items-center gap-3 pt-1.5">
          <Icon name={llego ? 'check_circle' : n.icon} size={28} fill />
          <div className="text-[17px] font-bold">{llego ? n.llego : buscando ? `Buscando ${n.unidad.toLowerCase()}…` : `${n.unidad} en camino`}</div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[480px] animate-slide-up rounded-t-[24px] bg-white px-5 pb-[max(34px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-4px_20px_rgba(0,0,0,.10)]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D5DAE0]" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-[40px] font-extrabold leading-none tracking-[-1px] text-traffic-stop">
              {llego ? '¡Aquí!' : min != null ? `${min} min` : '…'}
            </span>
            <span className="text-[15px] text-ink-2">
              {llego ? 'La unidad está contigo' : buscando ? 'Despachando la unidad más cercana' : `desde ${e.hospital_nombre || 'la base más cercana'}`}
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-[#E6F4EA] px-4 py-3.5">
            <div className="flex h-8 w-3.5 flex-col items-center justify-around rounded-[7px] bg-ink py-[3px]">
              <span className="h-[7px] w-[7px] rounded-full bg-[#3A4048]" />
              <span className="h-[7px] w-[7px] rounded-full bg-[#3A4048]" />
              <span className="h-[7px] w-[7px] rounded-full bg-traffic-free" />
            </div>
            <span className="text-[15px] font-semibold text-[#0D652D]">Semáforos en verde en su camino: {e.semaforos_verdes ?? 0}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={llamar911} className="flex h-[52px] items-center justify-center gap-1.5 rounded-full bg-sos text-[15px] font-bold text-white active:scale-[.98]">
              <Icon name="call" size={20} fill /> Llamar 911
            </button>
            <button onClick={cancelar} className="flex h-[52px] items-center justify-center rounded-full border-[1.5px] border-[#D5DAE0] text-[15px] font-bold text-ink active:scale-[.98]">
              {llego ? 'Cerrar' : 'Cancelar'}
            </button>
          </div>
          <p className="-mt-1 text-center text-xs text-ink-2">Demo: el enlace al 911 es simulado.</p>
        </div>
      </div>
    </>
  );
}

export function SosFlow() {
  const e = useApp((s) => s.emergencia);
  const set = useApp((s) => s.set);
  const toast = useApp((s) => s.toast);
  const [enviando, setEnviando] = useState<Tipo | null>(null);
  const activa = e && e.estado !== 'cancelada';

  const elegir = async (tipo: Tipo) => {
    setEnviando(tipo);
    const s = useApp.getState();
    const p = posicionActual(s) ?? { lng: CENTRO_CUU.lng, lat: CENTRO_CUU.lat };
    const r = await llamarCiudad<RespuestaCiudad & { emergencia: Emergencia }>('/api/sos', { accion: 'crear', tipo, lat: p.lat, lng: p.lng });
    setEnviando(null);
    if (!r?.emergencia) {
      toast({ tipo: 'info', titulo: 'No pudimos enviar tu solicitud', texto: 'Si es grave, llama al 911 desde tu teléfono.' });
      return;
    }
    set({ emergencia: r.emergencia, navegando: false, simulando: false });
    hablar(`Listo, pedimos ${tipo === 'policia' ? 'una patrulla' : tipo === 'bomberos' ? 'a los bomberos' : 'una ambulancia'}. Ya va en camino.`);
  };

  return activa ? <Seguimiento e={e} /> : <Elegir onElegir={elegir} enviando={enviando} />;
}
