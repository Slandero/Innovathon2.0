# ViveCUU
App ciudadana tipo Google Maps/Waze para Chihuahua, en vivo. Hackathon de 12 h: prioriza que FUNCIONE y se VEA bien en el demo.
Lee docs/VIVECUU_MASTER.md (la sección 0 manda sobre todo) antes de cualquier cambio.

## Stack
- Next.js 14 App Router + TypeScript + Tailwind, mobile-first 390 px, PWA
- Mapbox GL JS (react-map-gl) estilo mapbox://styles/mapbox/navigation-day-v1
- Mapbox Search/Geocoding + Directions (driving-traffic); Turf.js para geometría
- Supabase (Postgres + PostGIS + Realtime + Storage) con @supabase/supabase-js
- Motor de ciudad en Python (carpeta /sim) con OSMnx
- n8n para automatizaciones (webhooks), ElevenLabs para voz, Claude API para IA

## Reglas
- Español en toda la UI. Tono cercano mexicano.
- Diseño claro tipo Waze: tokens en docs/VIVECUU_MASTER.md sección 7.
- Llaves secretas SOLO en el servidor (API routes). En cliente solo NEXT_PUBLIC_*.
- El 911 es SIEMPRE simulado. Nunca integrar números de emergencia reales.
- Cada fase termina con la app corriendo sin errores (`npm run build`).
- Componentes pequeños en /components, lógica de mapa en /lib/map, datos en /lib/data.
- Si una API externa falla, la UI no se rompe: muestra respaldo.

## Respaldos implementados (sin llaves la app sigue funcionando)
- Sin `NEXT_PUBLIC_MAPBOX_TOKEN`: MapLibre + OpenFreeMap, búsqueda con Nominatim, rutas con OSRM público.
- Sin Supabase: capas estáticas de `public/data/infra.geojson`, sin autos en vivo.
- Sin `N8N_WEBHOOK_BASE`: `/api/demo` inserta incidentes y alertas (911 simulado) directo en Supabase.
- Sin `NEXT_PUBLIC_ELEVENLABS_AGENT_ID`: copiloto con Web Speech API (es-MX).
- Sin `ANTHROPIC_API_KEY`: clasificación de reportes por reglas sobre la nota.
- Sin Supabase (modo local): las API routes regresan `eventos` y el cliente los aplica (`src/lib/local/aplicar.ts`) y los reparte entre pestañas con BroadcastChannel (app ↔ `/demo` en el mismo navegador).
- Sin motor de ciudad: camiones de `public/data/rutas_camion.json` simulados en el cliente; ambulancia con ola verde simulada en el cliente (`src/lib/local/`).
- Rutas de camión: nombres reales de Chihuahua con trazos APROXIMADOS (`scripts/generar-rutas-camion.mjs`, igual que `sim/rutas.py`). No son oficiales.
- Segundo servidor de desarrollo sin pisar `.next`: `node scripts/dev-alt.mjs` (puerto 3001, `.next-alt`).
