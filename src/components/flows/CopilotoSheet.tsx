'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { hablar, llevarA, minutos } from '@/lib/acciones';
import type { RespuestaCiudad } from '@/lib/eventos';
import { llamarCiudad } from '@/lib/local/aplicar';
import { posicionActual, useApp } from '@/lib/store';
import { Icon } from '../ui/Icon';

/* Web Speech API (respaldo sin ElevenLabs). Tipos mínimos: no vienen en lib.dom. */
interface Reconocimiento {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
}
const crearReconocimiento = (): Reconocimiento | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Reconocimiento; webkitSpeechRecognition?: new () => Reconocimiento };
  const C = w.SpeechRecognition || w.webkitSpeechRecognition;
  return C ? new C() : null;
};

const SUGERENCIAS = ['Llévame al Tec II', 'Hay un choque en Av. Tecnológico', '¿Dónde viene mi camión?'];

/** Interpreta lo que dijo el usuario y ejecuta la acción. Regresa la respuesta hablada. */
async function responder(texto: string): Promise<string> {
  const t = texto.toLowerCase();
  const s = useApp.getState();
  const destino = t.match(/(?:ll[eé]vame|ir|vamos|c[oó]mo llego|ruta)\s+(?:a|al|a la|hacia|para)\s+(.+)/i);
  if (destino) return llevarA(destino[1].replace(/[.?!¿¡]/g, '').trim());

  if (/choque|accidente|chocaron|volcadura|atropell|cerrad|bloquead/.test(t)) {
    // Flujo F1: n8n (o la app) crea el incidente, 911 simulado, aviso al contacto y desvío.
    // RutaController recalcula tu ruta en cuanto el incidente aparece en el mapa.
    const calle = texto.match(/\b(?:en|sobre|por)\s+((?:la\s+)?(?:av\.?|avenida|perif[eé]rico|calle|blvd\.?|boulevard|carretera)\s+[^,.;]+)/i)?.[1]
      ?.replace(/^la\s+/i, '').replace(/\s+(carril|a la altura|cerca|frente).*$/i, '').trim();
    const p = posicionActual(s);
    const r = await llamarCiudad<RespuestaCiudad & { mensaje_voz?: string }>('/api/incidente', {
      origen: 'voz', texto, calle: calle || null,
      lat: calle ? null : p?.lat ?? null, lng: calle ? null : p?.lng ?? null,
      usuario: { nombre: 'Conductor', eta_destino_min: s.rutas[s.rutaSel] ? minutos(s.rutas[s.rutaSel].duracion) : null },
    });
    return r?.mensaje_voz || r?.mensaje || 'No pude reportarlo ahorita. Si hay heridos, llama al 911 desde tu teléfono.';
  }
  if (/cami[oó]n|ruta troncal|parada/.test(t)) {
    s.set({ tab: 'camiones', flujo: null });
    return 'Te muestro los camiones en vivo.';
  }
  if (/report|bache|fuga|sem[aá]foro descompuesto/.test(t)) {
    s.set({ flujo: 'reportar' });
    return 'Va, abre la cámara y toma la foto.';
  }
  if (/emergencia|sos|ayuda|auxilio/.test(t)) {
    s.set({ flujo: 'sos' });
    return 'Abrí el botón de emergencia.';
  }
  return 'Puedo llevarte a un lugar, avisar de un choque o mostrarte los camiones. ¿Qué necesitas?';
}

function Ondas({ activo }: { activo: boolean }) {
  return (
    <div className="flex h-16 items-center gap-1">
      {Array.from({ length: 32 }, (_, i) => (
        <span
          key={i}
          className="w-1 rounded-full"
          style={{
            height: 18 + Math.round(46 * Math.abs(Math.sin(i * 0.55))),
            background: i % 3 === 0 ? '#7C5CFF' : '#3D5AFE',
            transformOrigin: 'center',
            transform: activo ? undefined : 'scaleY(.2)',
            animation: activo ? `cuuwave ${0.9 + (i % 5) * 0.12}s ease-in-out ${i * 0.04}s infinite` : undefined,
            transition: 'transform .3s',
          }}
        />
      ))}
    </div>
  );
}

/** Copiloto de voz (frame 07): escucha, transcribe, actúa y responde en voz es-MX. */
export function CopilotoSheet() {
  const set = useApp((s) => s.set);
  const [estado, setEstado] = useState<'escuchando' | 'pensando' | 'listo'>('listo');
  const [dicho, setDicho] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const rec = useRef<Reconocimiento | null>(null);
  const [soportado, setSoportado] = useState(true);

  const procesar = useCallback(async (texto: string) => {
    setDicho(texto);
    setEstado('pensando');
    let r: string;
    try { r = await responder(texto); } catch { r = 'Uy, algo falló. ¿Lo intentamos otra vez?'; }
    setRespuesta(r);
    setEstado('listo');
    hablar(r);
  }, []);

  const escuchar = useCallback(() => {
    rec.current?.abort();
    const r = crearReconocimiento();
    if (!r) { setSoportado(false); return; }
    r.lang = 'es-MX';
    r.interimResults = true;
    r.continuous = false;
    let final = '';
    r.onresult = (e) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) {
        txt += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = txt;
      }
      setDicho(txt);
    };
    r.onend = () => { if (final.trim()) procesar(final.trim()); else setEstado('listo'); };
    r.onerror = () => setEstado('listo');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) speechSynthesis.cancel();
    setDicho('');
    setRespuesta('');
    setEstado('escuchando');
    rec.current = r;
    try { r.start(); } catch { setEstado('listo'); }
  }, [procesar]);

  useEffect(() => {
    escuchar();
    return () => rec.current?.abort();
  }, [escuchar]);

  const cerrar = () => { rec.current?.abort(); set({ flujo: null }); };
  const titulo = estado === 'escuchando' ? 'escuchando' : estado === 'pensando' ? 'pensando…' : 'listo';

  return (
    <div className="absolute inset-0 z-[55] animate-fade-in">
      <button aria-label="Cerrar copiloto" onClick={cerrar} className="absolute inset-0 bg-[rgba(31,35,40,.38)]" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[480px] animate-slide-up flex-col gap-5 rounded-t-[28px] bg-white px-[22px] pb-[max(36px,env(safe-area-inset-bottom))] pt-2.5">
        <div className="h-1 w-10 self-center rounded-full bg-[#D5DAE0]" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[15px] font-bold text-ink">
            <span className={`h-2 w-2 rounded-full ${estado === 'escuchando' ? 'animate-pulse bg-sos' : 'bg-ink-2'}`} />
            Copiloto · {titulo}
          </div>
          <button aria-label="Cerrar" onClick={cerrar} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink active:scale-95">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="flex h-16 items-center justify-center"><Ondas activo={estado !== 'listo'} /></div>

        {dicho ? (
          <p className="text-[21px] font-semibold leading-[1.35] tracking-[-0.2px] text-ink [text-wrap:pretty]">“{dicho}”</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[21px] font-semibold leading-[1.35] tracking-[-0.2px] text-ink-2">
              {soportado ? '¿A dónde vamos? Dime algo…' : 'Tu navegador no reconoce voz. Toca una opción:'}
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS.map((s) => (
                <button key={s} onClick={() => { rec.current?.abort(); procesar(s); }} className="h-9 rounded-full border border-[#E1E4E8] px-3.5 text-sm font-medium text-ink active:bg-surface">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {respuesta && (
          <div className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-futuro text-white">
              <Icon name="location_on" size={20} fill />
            </div>
            <p className="pt-[5px] text-base leading-[1.4] text-ink">{respuesta}</p>
          </div>
        )}

        <div className="flex justify-center pt-1">
          <button
            aria-label={estado === 'escuchando' ? 'Dejar de escuchar' : 'Hablar'}
            onClick={() => (estado === 'escuchando' ? rec.current?.stop() : escuchar())}
            className={`flex h-[72px] w-[72px] items-center justify-center rounded-full text-white shadow-[0_8px_24px_rgba(61,90,254,.4)] active:scale-95 ${estado === 'escuchando' ? 'bg-sos' : 'bg-primary'}`}
          >
            <Icon name={estado === 'escuchando' ? 'stop' : 'mic'} size={34} fill />
          </button>
        </div>
      </div>
    </div>
  );
}
