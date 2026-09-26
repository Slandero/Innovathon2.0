'use client';
import { useEffect, useRef, useState } from 'react';
import { length, lineString } from '@turf/turf';
import { fmtDist, horaLlegada, llevarA, minutos, origenActual } from '@/lib/acciones';
import { colorTextoOcupacion, sugerirRutas, type Sugerencia } from '@/lib/data/camiones';
import { hechosCiudad, nombreIncidente } from '@/lib/hechos';
import { encuadrar } from '@/lib/map/instancia';
import { buscarLugares } from '@/lib/map/mapbox';
import { useApp } from '@/lib/store';
import { ALTO_NAV_CSS } from '../BottomNav';
import { Icon } from '../ui/Icon';
import { InsigniaRuta } from '../ui/Ocupacion';

type Tarjeta =
  | { tipo: 'camion'; s: Sugerencia; destino: string; caminar: number; viaje: number }
  | { tipo: 'ruta'; destino: string; min: number; km: string; llegada: string };
interface Mensaje { id: number; rol: 'usuario' | 'asistente'; texto: string; tarjeta?: Tarjeta; pensando?: boolean }

const SUGERENCIAS = ['¿Cómo está el tráfico?', '¿Qué camión me lleva al Centro?', '¿Qué obras hay?', 'Llévame al Tec II', '¿Qué pasa en la ciudad?'];
const VEL_CAMION_KMH = 24;
// La conversación sobrevive al cambiar de pestaña
let historia: Mensaje[] = [];
let seq = 1;

/** Destinos que la gente dice corto → búsqueda que sí encuentra el lugar. */
const ALIAS: Record<string, string> = {
  centro: 'Plaza de Armas Chihuahua', 'el centro': 'Plaza de Armas Chihuahua', tec: 'Instituto Tecnológico de Chihuahua',
  'tec ii': 'Instituto Tecnológico de Chihuahua II', 'tec 2': 'Instituto Tecnológico de Chihuahua II', uach: 'Universidad Autónoma de Chihuahua Campus II',
};
function alias(texto: string): string {
  const limpio = texto.replace(/[?¿!.,]/g, '').trim();
  const clave = limpio.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/^(el|la|los|las)\s+/, '');
  return ALIAS[clave] || ALIAS[`el ${clave}`] || limpio;
}

/** Herramientas locales: resuelven con los datos en vivo y regresan hechos + respuesta por reglas. */
async function resolver(pregunta: string): Promise<{ hechos: string; texto: string; tarjeta?: Tarjeta }> {
  const t = pregunta.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const s = useApp.getState();

  // ¿Qué camión me lleva a X?
  const cam = t.match(/camion.*?\b(?:al|a la|a|hacia|para)\s+(.+)/);
  if (/camion|ruta de camion|transporte/.test(t) && cam) {
    const destino = alias(cam[1]);
    if (!s.rutasCamion.length) return { hechos: 'No hay rutas de camión cargadas.', texto: 'Ahorita no tengo las rutas de camión en vivo. Intenta en un momento.' };
    const [l] = await buscarLugares(destino, origenActual());
    if (!l) return { hechos: `No se encontró "${destino}".`, texto: `No encontré "${destino}" en Chihuahua. ¿Me lo dices de otra forma?` };
    const cams = Object.values(s.camiones);
    let sug = sugerirRutas(s.rutasCamion, cams, origenActual(), [l.lng, l.lat]);
    if (!sug.length) sug = sugerirRutas(s.rutasCamion, cams, origenActual(), [l.lng, l.lat], 900);
    if (!sug.length) return { hechos: `Ninguna ruta pasa cerca del usuario y de ${l.nombre}.`, texto: `Ninguna de las rutas que tengo pasa cerca de ti y de ${l.nombre}. Te conviene ir en carro o combinar rutas.` };
    const x = sug[0];
    const total = length(lineString(x.ruta.trazo.coordinates), { units: 'kilometers' });
    const km = ((x.bajar.parada.km - x.subir.parada.km) % total + total) % total;
    const viaje = Math.max(3, Math.round((km / VEL_CAMION_KMH) * 60));
    const nombre = x.ruta.nombre.split('·')[0].trim();
    const lleg = x.llegada ? `llega en ${x.llegada.eta_min} min y viene ${x.llegada.pct}% lleno` : 'ahorita no veo unidades cerca';
    return {
      hechos: `Sugerencia: ${x.ruta.nombre}. Subir en ${x.subir.parada.nombre} a ${Math.round(x.subir.distancia_m)} m (${x.subir.caminar_min} min caminando); ${lleg}. Bajar en ${x.bajar.parada.nombre}. Viaje en camión ~${viaje} min hasta ${l.nombre}.`,
      texto: `Toma la ${nombre} en ${x.subir.parada.nombre}, a ${fmtDist(x.subir.distancia_m)} de ti. ${lleg.charAt(0).toUpperCase()}${lleg.slice(1)}.`,
      tarjeta: { tipo: 'camion', s: x, destino: l.nombre, caminar: x.subir.caminar_min, viaje },
    };
  }

  // Llévame a X
  const ir = t.match(/\b(?:llevame|llegar|llego|ir|vamos|ruta)\s+(?:al|a la|a|hacia|para)\s+(.+)/);
  if (ir) {
    const destino = alias(pregunta.slice(t.indexOf(ir[1])));
    const texto = await llevarA(destino);
    const r = useApp.getState().rutas[useApp.getState().rutaSel];
    const lugar = useApp.getState().lugar;
    return {
      hechos: texto, texto,
      tarjeta: r && lugar ? { tipo: 'ruta', destino: lugar.nombre, min: minutos(r.duracion), km: fmtDist(r.distancia), llegada: horaLlegada(r.duracion) } : undefined,
    };
  }

  // Obras
  if (/obra|construc|cerrad|gaza|paso a desnivel|desvio|borunda|pistolas/.test(t)) {
    if (!s.obras.length) return { hechos: 'Sin obras registradas.', texto: 'No tengo obras viales activas registradas ahorita.' };
    const texto = s.obras.map((o) => `${o.nombre}: ${o.afectacion.toLowerCase()}${o.desvios.length ? `. Desvío: ${o.desvios[0].texto}` : o.alternas_saturadas.length ? `. Ojo, las alternas van saturadas (${o.alternas_saturadas.slice(0, 3).join(', ')})` : ''}.`).join('\n\n');
    return { hechos: hechosCiudad(), texto };
  }

  // Tráfico / qué pasa
  if (/trafico|como esta|como va|embotell|choque|accidente|que pasa|ciudad/.test(t)) {
    const incs = s.incidentes.filter((i) => i.estado === 'activo');
    const texto = incs.length
      ? `Hay ${incs.length} incidente${incs.length > 1 ? 's' : ''}: ${incs.slice(0, 3).map((i) => `${nombreIncidente(i.tipo).toLowerCase()} en ${i.calle || 'la ciudad'} (+${i.retraso_min ?? '?'} min)`).join(', ')}. Si vas por ahí, busca otra ruta.`
      : 'Todo fluye bien ahorita, sin choques ni cierres reportados. Buen momento para moverte.';
    return { hechos: hechosCiudad(), texto };
  }

  return { hechos: hechosCiudad(), texto: 'Puedo decirte qué camión te lleva, trazarte una ruta o contarte cómo está el tráfico. ¿Qué necesitas?' };
}

function TarjetaCamion({ c }: { c: Extract<Tarjeta, { tipo: 'camion' }> }) {
  const set = useApp((s) => s.set);
  const { s } = c;
  const verMapa = () => { set({ tab: 'camiones', rutaCamionSel: s.ruta.id }); encuadrar(s.ruta.trazo.coordinates, { top: 130, bottom: 170, left: 40, right: 40 }); };
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#E1E4E8] p-3">
      <div className="flex items-center gap-2.5">
        <InsigniaRuta id={s.ruta.id} color={s.ruta.color} tam={32} radio={9} texto={14} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{s.ruta.nombre}</div>
          <div className="text-xs text-ink-2">
            {s.llegada ? <>Llega en {s.llegada.eta_min} min · <span style={{ color: colorTextoOcupacion(s.llegada.pct) }}>{s.llegada.pct}% lleno</span></> : 'Sin unidades cerca'}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
        <Icon name="directions_walk" size={16} />{c.caminar} min<Icon name="chevron_right" size={14} />
        <Icon name="directions_bus" size={16} fill style={{ color: s.ruta.color }} />{c.viaje} min<Icon name="chevron_right" size={14} />
        <Icon name="flag" size={16} /><span className="truncate">{c.destino}</span>
      </div>
      <button onClick={verMapa} className="flex h-[38px] items-center justify-center rounded-full bg-[#ECEEFF] text-sm font-bold text-primary active:scale-[.98]">Ver en el mapa</button>
    </div>
  );
}

function TarjetaRuta({ c }: { c: Extract<Tarjeta, { tipo: 'ruta' }> }) {
  const set = useApp((s) => s.set);
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#E1E4E8] p-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-primary text-white"><Icon name="directions_car" size={20} fill /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{c.destino}</div>
          <div className="text-xs text-ink-2"><b className="text-[#188038]">{c.min} min</b> · {c.km} · llegas {c.llegada}</div>
        </div>
      </div>
      <button onClick={() => set({ tab: 'mapa' })} className="flex h-[38px] items-center justify-center rounded-full bg-[#ECEEFF] text-sm font-bold text-primary active:scale-[.98]">Ver en el mapa</button>
    </div>
  );
}

/** B7 · Asistente de texto (y voz para dictar). */
export function AsistenteTab() {
  const [msgs, setMsgs] = useState<Mensaje[]>(historia);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [dictando, setDictando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => { historia = msgs; fin.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);

  const enviar = async (pregunta: string) => {
    const q = pregunta.trim();
    if (!q || ocupado) return;
    setTexto('');
    setOcupado(true);
    const previos = msgs.filter((m) => !m.pensando).slice(-8).map((m) => ({ rol: m.rol, texto: m.texto }));
    const idP = seq++;
    setMsgs((m) => [...m, { id: seq++, rol: 'usuario', texto: q }, { id: idP, rol: 'asistente', texto: '', pensando: true }]);
    let res: Awaited<ReturnType<typeof resolver>>;
    try { res = await resolver(q); } catch { res = { hechos: '', texto: 'Uy, algo falló. ¿Lo intentamos otra vez?' }; }
    let final = res.texto;
    try {
      const r = await fetch('/api/asistente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pregunta: q, historial: previos, hechos: res.hechos }) });
      const j = (await r.json()) as { texto: string | null };
      if (j.texto) final = j.texto;
    } catch { /* respuesta por reglas */ }
    setMsgs((m) => m.map((x) => (x.id === idP ? { id: idP, rol: 'asistente', texto: final, tarjeta: res.tarjeta } : x)));
    setOcupado(false);
  };

  const dictar = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!C) { useApp.getState().set({ flujo: 'copiloto' }); return; }
    const r = new C();
    r.lang = 'es-MX';
    r.interimResults = true;
    let dicho = '';
    r.onresult = (e) => { dicho = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(''); setTexto(dicho); };
    r.onend = () => { setDictando(false); if (dicho.trim()) enviar(dicho); };
    r.onerror = () => setDictando(false);
    setDictando(true);
    try { r.start(); } catch { setDictando(false); }
  };

  return (
    <div className="absolute inset-x-0 top-0 z-30 mx-auto flex w-full max-w-[480px] animate-fade-in flex-col bg-surface" style={{ bottom: ALTO_NAV_CSS }}>
      <div className="flex items-center gap-2.5 border-b border-[#ECEEF1] bg-white px-4 pb-3.5 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-futuro text-white"><Icon name="location_on" size={22} fill /></div>
        <h1 className="flex-1 text-lg font-bold">Asistente</h1>
        {msgs.length > 0 && (
          <button aria-label="Nueva conversación" onClick={() => setMsgs([])} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 active:bg-surface"><Icon name="edit_square" size={20} /></button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4">
        {!msgs.length && (
          <div className="flex flex-col items-center gap-2 px-6 pt-10 text-center">
            <Icon name="forum" size={40} className="text-[#D5DAE0]" />
            <p className="text-base font-semibold">¿En qué te ayudo?</p>
            <p className="text-sm text-ink-2">Pregúntame por camiones, rutas o cómo está el tráfico en Chihuahua.</p>
          </div>
        )}
        {msgs.map((m) => m.rol === 'usuario' ? (
          <div key={m.id} className="max-w-[78%] self-end rounded-[20px_20px_6px_20px] bg-primary px-4 py-3 text-[15px] text-white">{m.texto}</div>
        ) : (
          <div key={m.id} className="flex max-w-[86%] flex-col gap-2.5 self-start rounded-[20px_20px_20px_6px] bg-white px-3.5 py-3 shadow-[0_1px_4px_rgba(0,0,0,.05)]">
            {m.pensando
              ? <span className="flex gap-1 py-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-ink-2/50" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
              : <p className="whitespace-pre-line text-[15px] leading-[1.4]">{m.texto}</p>}
            {m.tarjeta?.tipo === 'camion' && <TarjetaCamion c={m.tarjeta} />}
            {m.tarjeta?.tipo === 'ruta' && <TarjetaRuta c={m.tarjeta} />}
          </div>
        ))}
        <div ref={fin} />
      </div>

      <div className="flex flex-col gap-2.5 border-t border-[#ECEEF1] bg-white px-3 pb-3 pt-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {SUGERENCIAS.map((s) => (
            <button key={s} onClick={() => enviar(s)} disabled={ocupado} className="flex h-[34px] shrink-0 items-center rounded-full border border-[#E1E4E8] px-3.5 text-[13px] font-semibold active:bg-surface disabled:opacity-50">{s}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} className="flex items-center gap-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={dictando ? 'Te escucho…' : 'Pregunta lo que sea'} enterKeyHint="send"
            className="h-12 min-w-0 flex-1 rounded-full bg-surface px-4 text-[15px] outline-none placeholder:text-ink-2" />
          {texto.trim() && !dictando ? (
            <button type="submit" aria-label="Enviar" disabled={ocupado} className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white active:scale-95 disabled:opacity-60"><Icon name="send" size={22} fill /></button>
          ) : (
            <button type="button" aria-label="Dictar" onClick={dictar} className={`flex h-12 w-12 items-center justify-center rounded-full text-white active:scale-95 ${dictando ? 'animate-pulse bg-sos' : 'bg-primary'}`}><Icon name="mic" size={24} fill /></button>
          )}
        </form>
      </div>
    </div>
  );
}

interface SpeechRec {
  lang: string; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null; start: () => void;
}
