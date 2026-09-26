'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CENTRO_CUU } from '@/lib/config';
import type { RespuestaCiudad } from '@/lib/eventos';
import { llamarCiudad } from '@/lib/local/aplicar';
import { getMapa, volarA } from '@/lib/map/instancia';
import { direccionEn } from '@/lib/map/mapbox';
import { posicionActual, useApp } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import type { Reporte } from '@/lib/types';
import { Icon } from '../ui/Icon';

type Paso = 'camara' | 'pin' | 'nota' | 'ia' | 'listo' | 'duplicado';
type TipoChip = 'bache' | 'semaforo_fallando' | 'fuga_agua' | 'obra';

const CHIPS: { tipo: TipoChip; label: string; icon: string }[] = [
  { tipo: 'bache', label: 'Bache', icon: 'warning' },
  { tipo: 'semaforo_fallando', label: 'Semáforo', icon: 'traffic' },
  { tipo: 'fuga_agua', label: 'Fuga de agua', icon: 'water_drop' },
  { tipo: 'obra', label: 'Obra', icon: 'construction' },
];
export const ICONO_TIPO: Record<string, { icon: string; color: string; nombre: string }> = {
  bache: { icon: 'warning', color: '#F57C00', nombre: 'Bache' },
  tope: { icon: 'warning', color: '#E3A100', nombre: 'Tope' },
  semaforo_fallando: { icon: 'traffic', color: '#C5221F', nombre: 'Semáforo fallando' },
  obra: { icon: 'construction', color: '#F57C00', nombre: 'Obra' },
  accidente: { icon: 'car_crash', color: '#C5221F', nombre: 'Accidente' },
  basura: { icon: 'delete', color: '#5F6B7A', nombre: 'Basura' },
  luminaria: { icon: 'lightbulb', color: '#E3A100', nombre: 'Luminaria' },
  fuga_agua: { icon: 'water_drop', color: '#3D5AFE', nombre: 'Fuga de agua' },
  otro: { icon: 'campaign', color: '#5F6B7A', nombre: 'Reporte' },
};
const DEP: Record<string, string> = { municipio: 'Municipio', transito: 'Tránsito', jmas: 'JMAS', cfe: 'CFE', ninguna: 'Sin asignar' };
const PIN_SHEET = 210; // alto de la hoja del paso 2; el centro del mapa queda arriba de ella

/** Reduce la foto a ~900 px en JPEG para mandarla rápido. */
function reducir(fuente: CanvasImageSource, w: number, h: number): string {
  const k = Math.min(1, 900 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext('2d')!.drawImage(fuente, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
function leerArchivo(f: File): Promise<string> {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { ok(reducir(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(url); };
    img.onerror = mal;
    img.src = url;
  });
}
const Rayas = ({ className = '', texto }: { className?: string; texto?: string }) => (
  <div className={`flex items-center justify-center bg-[repeating-linear-gradient(135deg,#ECEEF1_0_8px,#F6F7F9_8px_16px)] font-mono text-[10px] text-ink-2 ${className}`}>{texto}</div>
);

// ─────────────── B5a · Cámara
function Camara({ onFoto, onCerrar }: { onFoto: (f: string | null) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const [frontal, setFrontal] = useState(false);
  const [flash, setFlash] = useState(false);
  const [estado, setEstado] = useState<'abriendo' | 'lista' | 'sin_camara'>('abriendo');
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    let vivo = true;
    setEstado('abriendo');
    if (!navigator.mediaDevices?.getUserMedia) { setEstado('sin_camara'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: frontal ? 'user' : 'environment', width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (!vivo) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); }
        setEstado('lista');
      })
      .catch(() => vivo && setEstado('sin_camara'));
    return () => { vivo = false; stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  }, [frontal]);

  const alternarFlash = async () => {
    const t = stream.current?.getVideoTracks()[0];
    const nuevo = !flash;
    setFlash(nuevo);
    try { await t?.applyConstraints({ advanced: [{ torch: nuevo } as MediaTrackConstraintSet] }); } catch { /* sin linterna */ }
  };
  const disparar = () => {
    const v = video.current;
    if (estado !== 'lista' || !v || !v.videoWidth) { archivo.current?.click(); return; }
    onFoto(reducir(v, v.videoWidth, v.videoHeight));
  };

  const boton = 'flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white active:scale-95';
  return (
    <div className="absolute inset-0 z-50 animate-fade-in bg-[#111418]">
      <video ref={video} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${estado === 'lista' ? '' : 'hidden'}`} />
      {estado !== 'lista' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[repeating-linear-gradient(135deg,#1B1F24_0_14px,#20252B_14px_28px)] px-10 text-center">
          <span className="font-mono text-xs text-[#8A939C]">{estado === 'abriendo' ? 'abriendo cámara…' : 'vista de cámara'}</span>
          {estado === 'sin_camara' && (
            <>
              <p className="text-sm text-white/80">No pudimos abrir la cámara. Elige una foto de tu galería.</p>
              <button onClick={() => onFoto(null)} className="text-sm font-semibold text-white/70 underline">Seguir sin foto</button>
            </>
          )}
        </div>
      )}
      <div className="absolute inset-x-4 flex items-center justify-between" style={{ top: 'max(16px, env(safe-area-inset-top))' }}>
        <button aria-label="Cerrar" onClick={onCerrar} className={boton}><Icon name="close" /></button>
        <div className="flex h-8 items-center rounded-full bg-black/45 px-3.5 text-[13px] font-semibold text-white">Paso 1 de 3 · Foto</div>
        <button aria-label="Flash" onClick={alternarFlash} className={boton}><Icon name={flash ? 'flash_on' : 'flash_off'} size={22} /></button>
      </div>
      <div className="pointer-events-none absolute inset-x-10 top-[27%] h-[36%] rounded-3xl border-2 border-white/70" />
      <p className="absolute inset-x-0 top-[65%] text-center text-[15px] font-medium text-white">Toma una foto de lo que quieres reportar</p>
      <div className="absolute inset-x-0 flex items-center justify-around px-10" style={{ bottom: 'max(48px, env(safe-area-inset-bottom))' }}>
        <button aria-label="Elegir de la galería" onClick={() => archivo.current?.click()} className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-white bg-[#3A4048] text-white/80">
          <Icon name="photo_library" size={22} />
        </button>
        <button aria-label="Tomar foto" onClick={disparar} className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white active:scale-95">
          <span className="h-[62px] w-[62px] rounded-full bg-white" />
        </button>
        <button aria-label="Cambiar cámara" onClick={() => setFrontal((f) => !f)} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[.18] text-white">
          <Icon name="flip_camera_android" />
        </button>
      </div>
      <input ref={archivo} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={async (ev) => { const f = ev.target.files?.[0]; if (f) onFoto(await leerArchivo(f).catch(() => null)); }} />
    </div>
  );
}

// ─────────────── B5b · Pin en el mapa
function Pin({ onConfirmar, onAtras }: { onConfirmar: (p: { lng: number; lat: number; calle: string; zona: string }) => void; onAtras: () => void }) {
  const [dir, setDir] = useState<{ calle: string; zona: string } | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  const centro = useRef({ lng: CENTRO_CUU.lng, lat: CENTRO_CUU.lat });

  useEffect(() => {
    const m = getMapa();
    if (!m) return;
    const u = posicionActual(useApp.getState()) ?? CENTRO_CUU;
    m.easeTo({ center: [u.lng, u.lat], zoom: 17, pitch: 0, bearing: 0, duration: 800, padding: { top: 0, bottom: PIN_SHEET, left: 0, right: 0 } });
    let t: ReturnType<typeof setTimeout>;
    let seq = 0;
    const inicio = () => setMoviendo(true);
    const fin = () => {
      setMoviendo(false);
      const c = m.getCenter();
      centro.current = { lng: c.lng, lat: c.lat };
      clearTimeout(t);
      const mio = ++seq;
      t = setTimeout(async () => { const d = await direccionEn(c.lng, c.lat); if (mio === seq) setDir(d); }, 350);
    };
    m.on('movestart', inicio);
    m.on('moveend', fin);
    return () => {
      clearTimeout(t);
      m.off('movestart', inicio);
      m.off('moveend', fin);
      m.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 300 });
    };
  }, []);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 mx-auto w-full max-w-[480px] px-3 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex h-[52px] items-center gap-2.5 rounded-full bg-white pl-3.5 pr-[18px] shadow-float">
          <button aria-label="Regresar" onClick={onAtras} className="flex"><Icon name="arrow_back" /></button>
          <span className="flex-1 text-[15px] font-semibold">Paso 2 de 3 · ¿Dónde está?</span>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center" style={{ height: `calc(100% - ${PIN_SHEET}px)` }}>
        <div className="absolute top-1/2 flex -translate-y-full flex-col items-center">
          <Icon name="location_on" size={56} fill className={`text-brand drop-shadow-[0_2px_6px_rgba(0,0,0,.25)] transition-transform ${moviendo ? '-translate-y-2' : ''}`} />
        </div>
        <div className="absolute top-1/2 -mt-[3px] h-[5px] w-3.5 rounded-[50%] bg-black/25" />
      </div>
      <div className="absolute inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[480px] animate-slide-up rounded-t-[24px] bg-white px-5 pb-[max(34px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-4px_20px_rgba(0,0,0,.10)]">
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-[#D5DAE0]" />
        <div className="flex flex-col gap-3.5">
          <p className="text-[13px] text-ink-2">Mueve el mapa para ajustar el punto</p>
          <div className="flex items-center gap-2.5">
            <Icon name="location_on" size={22} fill className="text-brand" />
            <span className="truncate text-base font-semibold">{dir && !moviendo ? dir.calle : 'Buscando la dirección…'}</span>
          </div>
          <button
            onClick={() => onConfirmar({ ...centro.current, calle: dir?.calle || 'Punto en el mapa', zona: dir?.zona || 'Chihuahua' })}
            className="flex h-[52px] items-center justify-center rounded-full bg-primary text-base font-bold text-white active:scale-[.98]"
          >
            Confirmar ubicación
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────── B5c · Nota y tipo
function Nota({ foto, lugar, tipo, setTipo, nota, setNota, onEnviar, onAtras }: {
  foto: string | null; lugar: { calle: string; zona: string }; tipo: TipoChip | null; setTipo: (t: TipoChip | null) => void;
  nota: string; setNota: (n: string) => void; onEnviar: () => void; onAtras: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex animate-fade-in flex-col bg-white">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 pl-1.5 pr-4 pt-1">
          <button aria-label="Regresar" onClick={onAtras} className="flex h-11 w-11 items-center justify-center"><Icon name="arrow_back" /></button>
          <span className="text-[15px] font-semibold">Paso 3 de 3 · Cuéntanos</span>
        </div>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-3">
            {foto
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={foto} alt="Tu foto" className="h-[72px] w-[72px] rounded-[14px] object-cover" />
              : <Rayas className="h-[72px] w-[72px] rounded-[14px]" texto="sin foto" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">{lugar.calle}</div>
              <div className="mt-0.5 text-[13px] text-ink-2">{lugar.zona} · ahora</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="text-[13px] font-bold tracking-[0.3px] text-ink-2">¿QUÉ ES?</p>
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((c) => {
                const on = tipo === c.tipo;
                return (
                  <button key={c.tipo} onClick={() => setTipo(on ? null : c.tipo)}
                    className={`flex h-10 items-center gap-1.5 rounded-full pl-3 pr-4 text-sm ${on ? 'border-[1.5px] border-primary bg-[#ECEEFF] font-bold text-primary' : 'border border-[#E1E4E8] font-semibold text-ink'}`}>
                    <Icon name={on ? 'check' : c.icon} size={20} fill={on} className={on ? '' : 'text-ink-2'} />{c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="text-[13px] font-bold tracking-[0.3px] text-ink-2">NOTA (OPCIONAL)</p>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} rows={4}
              placeholder="Ej. Bache grande en el carril derecho, ya se ponchó una llanta."
              className="min-h-[110px] resize-none rounded-2xl border border-[#E1E4E8] px-4 py-3.5 text-[15px] leading-[1.45] outline-none placeholder:text-ink-2/70 focus:border-primary" />
          </div>
          <div className="flex-1" />
          <button onClick={onEnviar} disabled={!tipo && !nota.trim() && !foto}
            className="mb-[max(14px,env(safe-area-inset-bottom))] flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-full bg-futuro text-base font-bold text-white active:scale-[.98] disabled:opacity-50">
            <Icon name="send" size={22} fill /> Enviar reporte
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────── B5d · IA revisando
function Revisando({ foto, etapa }: { foto: string | null; etapa: number }) {
  const pasos = ['Foto recibida', 'Buscando reportes cercanos', 'Clasificando tipo y severidad'];
  return (
    <div className="absolute inset-0 z-50 flex animate-fade-in flex-col items-center justify-center gap-7 bg-white px-10">
      <div className="relative h-[200px] w-[200px] overflow-hidden rounded-[28px]">
        {foto
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={foto} alt="" className="h-full w-full object-cover" />
          : <Rayas className="h-full w-full" texto="foto del reporte" />}
        <span className="absolute inset-x-0 h-[3px] bg-primary shadow-[0_0_12px_4px_rgba(61,90,254,.45)] [animation:cuuscan_1.6s_ease-in-out_infinite_alternate]" />
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-block h-[22px] w-[22px] animate-spin rounded-full border-[3px] border-[#ECEEFF] border-t-primary" />
        <span className="text-lg font-bold">La IA está revisando tu reporte…</span>
      </div>
      <div className="flex flex-col gap-2.5 self-stretch">
        {pasos.map((p, i) => {
          const hecho = i < etapa;
          return (
            <div key={p} className={`flex items-center gap-2.5 text-sm ${hecho ? 'text-ink' : 'text-ink-2'}`}>
              <Icon name={hecho ? 'check_circle' : 'radio_button_unchecked'} size={20} fill={hecho} className={hecho ? 'text-traffic-free' : 'text-[#D5DAE0]'} />{p}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────── B5e / B5f · Resultado
function Resultado({ r, duplicado, folio, onVolver }: { r: Reporte; duplicado: boolean; folio: string; onVolver: () => void }) {
  const t = ICONO_TIPO[r.tipo || 'otro'] || ICONO_TIPO.otro;
  const sev = r.severidad ?? 2;
  const colorSev = sev >= 4 ? '#E37400' : sev === 3 ? '#FBBC04' : '#34A853';
  const hace = Math.max(0, Math.round((Date.now() - Date.parse(r.created_at)) / 3600e3));
  return (
    <div className="absolute inset-0 z-50 flex animate-fade-in flex-col bg-white">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-6 px-6 pb-[max(34px,env(safe-area-inset-bottom))] pt-[max(56px,calc(env(safe-area-inset-top)+40px))]">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-full ${duplicado ? 'bg-[#ECEEFF] text-primary' : 'bg-[#E6F4EA] text-[#188038]'}`}>
            <Icon name={duplicado ? 'how_to_vote' : 'check_circle'} size={40} fill />
          </div>
          <h2 className="text-2xl font-extrabold tracking-[-0.4px] [text-wrap:balance]">{duplicado ? 'Ya lo habían reportado' : '¡Reporte enviado!'}</h2>
          {duplicado
            ? <p className="text-base font-semibold text-primary">sumaste tu voto ({r.votos})</p>
            : <p className="text-sm text-ink-2">Folio {folio}</p>}
        </div>
        {duplicado ? (
          <div className="flex items-center gap-3 rounded-[20px] border border-[#E1E4E8] p-4">
            {r.foto_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={r.foto_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              : <Rayas className="h-14 w-14 shrink-0 rounded-xl" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold">{r.titulo || t.nombre}</div>
              <div className="mt-0.5 text-[13px] text-ink-2">Reportado {hace < 1 ? 'hace un rato' : hace < 24 ? `hace ${hace} h` : `hace ${Math.round(hace / 24)} días`} · {DEP[r.dependencia || 'ninguna']}</div>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[20px] border border-[#E1E4E8]">
            <div className="flex items-center justify-between p-4">
              <span className="text-sm text-ink-2">Tipo</span>
              <span className="flex items-center gap-1.5 text-[15px] font-bold"><Icon name={t.icon} size={20} fill style={{ color: t.color }} />{t.nombre}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#ECEEF1] p-4">
              <span className="text-sm text-ink-2">Severidad</span>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => <span key={n} className="h-2 w-[18px] rounded" style={{ background: n <= sev ? colorSev : '#ECEEF1' }} />)}
                </div>
                <span className="text-[15px] font-bold">{sev}/5</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[#ECEEF1] p-4">
              <span className="text-sm text-ink-2">Le toca a:</span>
              <span className="text-[15px] font-bold">{DEP[r.dependencia || 'ninguna']}</span>
            </div>
            {r.resumen_ia && <p className="border-t border-[#ECEEF1] px-4 py-3 text-[13px] text-ink-2">{r.resumen_ia}</p>}
          </div>
        )}
        <div className="flex-1" />
        <button onClick={onVolver} className="flex h-[52px] items-center justify-center rounded-full bg-primary text-base font-bold text-white active:scale-[.98]">
          Volver al mapa
        </button>
      </div>
    </div>
  );
}

/** Flujo Reportar: cámara → pin → nota → IA revisando → resultado (o "ya lo habían reportado"). */
export function ReportarFlow() {
  const set = useApp((s) => s.set);
  const toast = useApp((s) => s.toast);
  const [paso, setPaso] = useState<Paso>('camara');
  const [foto, setFoto] = useState<string | null>(null);
  const [lugar, setLugar] = useState<{ lng: number; lat: number; calle: string; zona: string } | null>(null);
  const [tipo, setTipo] = useState<TipoChip | null>(null);
  const [nota, setNota] = useState('');
  const [etapa, setEtapa] = useState(0);
  const [res, setRes] = useState<{ r: Reporte; duplicado: boolean; folio: string } | null>(null);

  const cerrar = useCallback(() => set({ flujo: null }), [set]);

  const enviar = async () => {
    if (!lugar) return;
    setPaso('ia');
    setEtapa(1);
    const t0 = Date.now();
    const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, Math.max(0, ms - (Date.now() - t0))));
    setTimeout(() => setEtapa(2), 900);

    // Sin Supabase no hay PostGIS: buscamos el duplicado aquí (mismo tipo, < 30 m, 48 h)
    if (!supabase && tipo) {
      const dup = useApp.getState().reportes.find((r) => r.tipo === tipo && r.estado !== 'resuelto'
        && Date.now() - Date.parse(r.created_at) < 48 * 3600e3
        && Math.hypot((r.lng - lugar.lng) * 97_700, (r.lat - lugar.lat) * 110_900) < 30);
      if (dup) {
        await llamarCiudad(`/api/reportes/${dup.id}/voto`, { votos: dup.votos });
        await esperar(2200);
        setEtapa(3);
        setRes({ r: { ...dup, votos: dup.votos + 1 }, duplicado: true, folio: '' });
        setPaso('duplicado');
        return;
      }
    }
    const r = await llamarCiudad<RespuestaCiudad & { duplicado: boolean; reporte: Reporte; folio?: string }>('/api/reportes/clasificar', {
      foto, nota, tipo, lat: lugar.lat, lng: lugar.lng, calle: lugar.calle,
    });
    await esperar(2600);
    setEtapa(3);
    if (!r?.reporte) {
      toast({ tipo: 'info', titulo: 'No se pudo enviar tu reporte', texto: 'Revisa tu conexión e inténtalo otra vez.' });
      setPaso('nota');
      return;
    }
    setRes({ r: r.reporte, duplicado: r.duplicado, folio: r.folio || '' });
    setPaso(r.duplicado ? 'duplicado' : 'listo');
  };

  const volver = () => {
    if (res) volarA(res.r.lng, res.r.lat, 16);
    set({ flujo: null, tab: 'mapa', capas: { ...useApp.getState().capas, reportes: true } });
  };

  if (paso === 'camara') return <Camara onCerrar={cerrar} onFoto={(f) => { setFoto(f); setPaso('pin'); }} />;
  if (paso === 'pin') return <Pin onAtras={() => setPaso('camara')} onConfirmar={(p) => { setLugar(p); setPaso('nota'); }} />;
  if (paso === 'nota' && lugar) {
    return <Nota foto={foto} lugar={lugar} tipo={tipo} setTipo={setTipo} nota={nota} setNota={setNota} onEnviar={enviar} onAtras={() => setPaso('pin')} />;
  }
  if (paso === 'ia') return <Revisando foto={foto} etapa={etapa} />;
  if (res) return <Resultado r={res.r} duplicado={res.duplicado} folio={res.folio} onVolver={volver} />;
  return null;
}
