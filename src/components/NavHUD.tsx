'use client';
import { fmtDist, horaLlegada, minutos } from '@/lib/acciones';
import { useNav } from '@/lib/hooks/useNavegacion';
import { useApp } from '@/lib/store';
import { Icon } from './ui/Icon';

function iconoManiobra(tipo: string, mod?: string): string {
  if (tipo === 'arrive') return 'sports_score';
  if (tipo === 'roundabout' || tipo === 'rotary') return 'roundabout_right';
  if (mod === 'uturn') return 'u_turn_left';
  if (mod === 'sharp left' || mod === 'left') return 'turn_left';
  if (mod === 'sharp right' || mod === 'right') return 'turn_right';
  if (mod === 'slight left') return 'turn_slight_left';
  if (mod === 'slight right') return 'turn_slight_right';
  if (tipo === 'merge') return 'merge';
  return 'straight';
}

const AVISO_ICONO: Record<string, string> = {
  alto: 'report', tope: 'warning', zona_escolar: 'school', incidente: 'car_crash', reporte: 'campaign', cruce: 'directions_walk',
};

/** "Gire a la derecha en Av. Universidad" → ["gira a la derecha", "Av. Universidad"] */
function partirInstruccion(instr: string, calle: string): [string, string] {
  if (!calle || !instr.includes(calle)) return [instr, ''];
  const accion = instr.replace(calle, '').replace(/\s+(en|hacia|por|sobre|a)\s*$/i, '').replace(/[\s,.]+$/, '').trim();
  const verbo = accion.replace(/^Gire\b/, 'gira').replace(/^Continúe\b/, 'sigue').replace(/^Siga\b/, 'sigue').replace(/^Tome\b/, 'toma').replace(/^Incorpórese\b/, 'incorpórate');
  return [verbo.charAt(0).toLowerCase() + verbo.slice(1), calle];
}

/** Mini semáforo con el foco encendido. */
function MiniSemaforo({ estado }: { estado: 'r' | 'a' | 'g' }) {
  const on = { r: '#EA4335', a: '#FBBC04', g: '#34A853' };
  return (
    <div className="flex h-[30px] w-3.5 flex-col items-center justify-around rounded-[7px] bg-ink py-[3px]">
      {(['r', 'a', 'g'] as const).map((k) => (
        <span key={k} className="h-[7px] w-[7px] rounded-full" style={{ background: estado === k ? on[k] : '#3A4048' }} />
      ))}
    </div>
  );
}

/** Banner verde de maniobra arriba + aviso + barra de ETA abajo (frame 06 del diseño). */
export function NavHUD() {
  const info = useNav((s) => s.info);
  const simulando = useApp((s) => s.simulando);
  const velSim = useApp((s) => s.velSim);
  const rutas = useApp((s) => s.rutas);
  const rutaSel = useApp((s) => s.rutaSel);
  const set = useApp((s) => s.set);
  const toast = useApp((s) => s.toast);
  const salir = () => set({ navegando: false, simulando: false, posSim: null });
  const otraRuta = () => {
    if (rutas.length > 1) {
      const i = (rutaSel + 1) % rutas.length;
      set({ rutaSel: i });
      toast({ tipo: 'desvio', titulo: `Te cambié de ruta, ${minutos(rutas[i].duracion)} min`, texto: rutas[i].resumen ? `Por ${rutas[i].resumen}` : undefined });
    } else toast({ tipo: 'info', titulo: 'Esta es la mejor ruta ahorita' });
  };
  if (!info) return null;

  const [accion, calle] = partirInstruccion(info.instruccion, info.calle);
  const texto = info.esperando || info.aviso;
  const esSemaforo = info.avisoTipo === 'semaforo';
  const estadoSem = texto?.includes('verde') ? 'g' : texto?.includes('ámbar') ? 'a' : 'r';
  const rojo = !esSemaforo && (info.avisoTipo === 'alto' || info.avisoTipo === 'incidente');

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 mx-auto w-full max-w-[480px]">
      <div className="pointer-events-auto rounded-b-[24px] bg-[#137333] px-5 pb-[18px] pt-[max(10px,env(safe-area-inset-top))] text-white shadow-[0_6px_18px_rgba(0,0,0,.18)]">
        <div className="flex items-center gap-4 pt-2.5">
          <Icon name={iconoManiobra(info.tipo, info.modificador)} size={48} weight={600} />
          <div className="flex min-w-0 flex-col gap-0.5">
            {!info.llegaste && <div className="text-[26px] font-extrabold leading-tight tracking-[-0.5px]">En {fmtDist(info.distPaso)}</div>}
            <div className={`${info.llegaste ? 'text-[26px] font-extrabold' : 'text-[17px] font-medium'} leading-snug`}>
              {info.llegaste ? '¡Llegaste!' : <>{accion}{calle && <> · <b>{calle}</b></>}</>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-2 px-3">
        {texto ? (
          <div className={`pointer-events-auto flex h-11 min-w-0 items-center gap-2.5 rounded-full pl-2.5 pr-4 text-[15px] font-semibold shadow-[0_4px_16px_rgba(0,0,0,.12)] ${rojo ? 'bg-sos text-white' : 'bg-white text-ink'}`}>
            {esSemaforo ? <MiniSemaforo estado={estadoSem} /> : <Icon name={AVISO_ICONO[info.avisoTipo ?? ''] ?? 'warning'} size={22} fill className={rojo ? '' : 'text-[#E3A100]'} />}
            <span className="truncate">{texto}</span>
          </div>
        ) : <span />}
        {simulando && (
          <button onClick={() => set({ velSim: velSim === 1 ? 3 : velSim === 3 ? 5 : 1 })} className="pointer-events-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-bold text-primary shadow-[0_4px_16px_rgba(0,0,0,.12)]">
            <Icon name="fast_forward" size={20} fill /> x{velSim} · {info.velKmh} km/h
          </button>
        )}
      </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 z-30 mx-auto flex w-full max-w-[480px] items-end justify-between px-3" style={{ bottom: 'calc(112px + 16px + env(safe-area-inset-bottom))' }}>
        <button
          aria-label="SOS emergencia"
          onClick={() => set({ flujo: 'sos' })}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white bg-sos text-[15px] font-extrabold text-white shadow-[0_6px_18px_rgba(229,37,42,.4)] active:scale-95"
        >
          SOS
        </button>
        <button
          aria-label="Copiloto de voz"
          onClick={() => set({ flujo: 'copiloto' })}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-primary shadow-[0_4px_16px_rgba(0,0,0,.14)] active:scale-95"
        >
          <Icon name="mic" size={26} fill />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[480px] items-center gap-3.5 rounded-t-[24px] bg-white px-5 pb-[max(18px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,.10)]" style={{ minHeight: 112 }}>
        <button aria-label="Salir de navegación" onClick={salir} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink active:scale-95">
          <Icon name="close" />
        </button>
        <div className="flex flex-1 flex-col items-center gap-0.5">
          <div className="text-[26px] font-extrabold leading-tight tracking-[-0.5px] text-[#188038]">{info.llegaste ? '¡Llegaste!' : `${minutos(info.restanteS)} min`}</div>
          <div className="text-sm text-ink-2">{fmtDist(info.restanteM)} · {horaLlegada(info.restanteS)}</div>
        </div>
        <button aria-label="Otra ruta" onClick={otraRuta} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink active:scale-95">
          <Icon name="alt_route" />
        </button>
      </div>
    </>
  );
}
