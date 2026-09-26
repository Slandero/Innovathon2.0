'use client';
import dynamic from 'next/dynamic';
import { useDatosVivos } from '@/lib/data/vivo';
import { useNavegacion } from '@/lib/hooks/useNavegacion';
import { useUbicacion } from '@/lib/hooks/useUbicacion';
import { useCamionesLocal } from '@/lib/local/camiones';
import { useCiudadLocal } from '@/lib/local/ciudad';
import { useObras } from '@/lib/data/obras';
import { useCanalLocal } from '@/lib/local/aplicar';
import { useEmergenciaLocal } from '@/lib/local/emergencia';
import { useAvisoCamion } from '@/lib/hooks/useAvisoCamion';
import { useApp } from '@/lib/store';
import { ALTO_NAV, BottomNav } from './BottomNav';
import { FloatingButtons } from './FloatingButtons';
import { NavHUD } from './NavHUD';
import { PlaceCard, PlaceTopBar } from './PlaceCard';
import { RouteCard, RouteTopBar } from './RouteCard';
import { RutaController } from './RutaController';
import { SearchScreen } from './SearchScreen';
import { Toasts } from './Toasts';
import { TopBar } from './TopBar';
import { Splash } from './ui/Splash';
import { Hojas } from './sheets/Hojas';
import { CamionesTab } from './tabs/CamionesTab';
import { QuePasaTab } from './tabs/QuePasaTab';
import { AsistenteTab } from './tabs/AsistenteTab';
import { ReportarFlow } from './flows/ReportarFlow';
import { SosFlow } from './flows/SosFlow';
import { CopilotoSheet } from './flows/CopilotoSheet';

const MapView = dynamic(() => import('./map/MapView'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#EEF0EC]" />,
});

export default function App() {
  useDatosVivos();
  useUbicacion();
  useNavegacion();
  useCanalLocal();
  useCamionesLocal();
  useCiudadLocal();
  useObras();
  useEmergenciaLocal();
  useAvisoCamion();

  const tab = useApp((s) => s.tab);
  const navegando = useApp((s) => s.navegando);
  const busqueda = useApp((s) => s.busquedaAbierta);
  const lugar = useApp((s) => s.lugar);
  const rutas = useApp((s) => s.rutas);
  const hoja = useApp((s) => s.hoja);
  const flujo = useApp((s) => s.flujo);
  const rutaCamionSel = useApp((s) => s.rutaCamionSel);

  const enMapa = tab === 'mapa' || tab === 'camiones';
  // SOS y Reportar usan el mapa limpio, sin barras encima
  const limpio = flujo === 'sos' || flujo === 'reportar';
  const vista = limpio ? 'limpio' : tab !== 'mapa' || hoja ? 'base' : rutas.length ? 'ruta' : lugar ? 'lugar' : 'base';
  const bottomBotones = ALTO_NAV + 16;

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#EEF0EC]">
      <Splash />
      <MapView />
      <RutaController />

      {navegando && !limpio ? (
        <NavHUD />
      ) : (
        <>
          {tab === 'mapa' && vista === 'base' && <TopBar />}
          {tab === 'mapa' && vista === 'base' && !hoja && <FloatingButtons bottom={bottomBotones} />}
          {vista === 'lugar' && <><PlaceTopBar /><PlaceCard /></>}
          {vista === 'ruta' && <><RouteTopBar /><RouteCard /></>}
          {!limpio && tab === 'camiones' && <CamionesTab />}
          {!limpio && !enMapa && tab === 'quepasa' && <QuePasaTab />}
          {!limpio && !enMapa && tab === 'asistente' && <AsistenteTab />}
          {!limpio && <Hojas />}
          {vista === 'base' && !hoja && !(tab === 'camiones' && rutaCamionSel) && <BottomNav />}
        </>
      )}

      {busqueda && <SearchScreen />}
      {flujo === 'reportar' && <ReportarFlow />}
      {flujo === 'sos' && <SosFlow />}
      {flujo === 'copiloto' && <CopilotoSheet />}
      <Toasts />
    </main>
  );
}
