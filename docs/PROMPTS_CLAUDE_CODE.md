# ViveCUU — Prompts para Claude Code (sirven igual en Cursor)

**Cómo usarlo:** pon `VIVECUU_MASTER.md`, `N8N_FLUJOS.md`, `ELEVENLABS_COPILOTO.md` y la carpeta `diagramas/` en `docs/` del repo. Copia el bloque CLAUDE.md a la raíz (en Cursor: `.cursorrules`). Luego pega las fases **una por una** y prueba antes de pasar a la siguiente.

---

## CLAUDE.md (raíz del repo)

```md
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
```

### `.env.local`
```
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=
N8N_WEBHOOK_BASE=
IOT_INGEST_TOKEN=
```

---

## FASE 0 — Setup (P1, 20 min)
```
Crea el proyecto ViveCUU con Next.js 14 (App Router, TypeScript, Tailwind, src/), instala
react-map-gl mapbox-gl @turf/turf @supabase/supabase-js zod lucide-react.
Configura Tailwind con los tokens de color de docs/VIVECUU_MASTER.md sección 7 y la fuente Inter.
Crea /supabase/schema.sql con TODO el SQL de las secciones 10, 19 y N8N_FLUJOS.md (incluye 'alto'
en infra.tipo, alertas, overrides_semaforo, semaforo_cercano). Crea lib/supabase.ts (cliente
navegador) y lib/supabase-server.ts (service role, solo servidor). Manifest PWA con nombre ViveCUU.
```

## FASE 1 — Datos reales (P1, 30 min, en paralelo a la Fase 2)
```
Crea /scripts/fetch_osm.py que descargue de Overpass la consulta de docs/VIVECUU_MASTER.md
sección 9.1 (bbox 28.55,-106.20,28.76,-105.95, incluye highway=stop) y guarde data/osm_infra.json.
Crea /scripts/seed_infra.py que lea ese JSON, normalice a {osm_id,tipo,nombre,lat,lng,meta}
(tipo: semaforo, alto, tope, cruce, escuela, hospital, parada) e inserte en Supabase por lotes de 500.
Para cada escuela crea su zona_escolar con buffer de 150 m (shapely) como GeoJSON.
Exporta además public/data/infra.geojson para cargar rápido en el mapa.
Imprime conteos por tipo al final. Crea /scripts/fetch_graph.py con OSMnx (sección 9.1) que guarde
data/cuu_drive.graphml.
```

## FASE 2 — VISTA PRINCIPAL tipo Maps/Waze (P2, 2 h) ⭐ PRIORIDAD
```
Implementa la vista principal según docs/VIVECUU_MASTER.md sección 18.1 a 18.3 y el diseño de P1.
1. Pantalla completa con Mapbox (navigation-day-v1). Pide ubicación con watchPosition, flyTo zoom 15,
   punto azul con halo y cono de dirección (heading). Si niega: centro 28.635,-106.089 zoom 13.
2. Barra superior flotante "¿A dónde vas?" con botón de micrófono (por ahora sin acción) y avatar.
3. Chips de capas con scroll horizontal (Tráfico, Camiones, Semáforos, Altos y topes, Escuelas, Reportes)
   guardadas en un store (zustand).
4. Botones flotantes: centrar en mí, Reportar (naranja), SOS (rojo). Barra inferior: Mapa, Camiones,
   Qué pasa, Asistente.
5. Búsqueda a pantalla completa: recientes (localStorage), accesos rápidos, resultados de Mapbox
   Search Box API (o Geocoding v6) con proximity al usuario, country=mx, bbox de Chihuahua,
   language=es, debounce 250 ms. Respaldo Nominatim.
6. Al elegir lugar: tarjeta inferior con nombre, dirección, distancia y botón "Cómo llegar".
7. Ruta con Mapbox Directions driving-traffic, alternatives, steps, geojson, language=es. Dibuja
   principal azul y alternativas grises tocables. Tarjeta con tiempo, distancia y hora de llegada.
Pon las llamadas a Mapbox en lib/map/mapbox.ts. Todo responsive y con animaciones suaves.
```

## FASE 3 — Semáforos, altos, topes y alertas en la ruta (P2, 1 h)
```
Según sección 18.3 y 18.4:
1. Carga public/data/infra.geojson y dibuja capas con íconos: semáforo (pastilla con luz activa),
   alto (octágono rojo "ALTO"), tope (triángulo amarillo), cruce, escuela (+ polígono morado
   translúcido solo si la zona está activa por horario), hospital, parada.
2. Semáforos animados con la función determinista de 18.4 (ciclo 90 s, offset = osm_id % 90).
   Actualiza el feature-state cada segundo sin recrear la capa. Escucha la tabla
   overrides_semaforo por Realtime y aplica el override hasta que expire.
3. Con Turf: buffer 25 m de la ruta → alertas ordenadas por distancia (semáforos, altos, topes,
   cruces, zonas escolares activas, incidentes activos, reportes severidad >= 3). Muéstralas en la
   tarjeta de ruta: "14 min · 6 semáforos · 3 topes · 1 zona escolar activa".
4. Modo navegación (18.5): botón Iniciar, cámara con pitch 55 siguiendo al usuario, banner de
   maniobra, barra de ETA. Botón "Simular viaje" que mueve el punto por la ruta a 40 km/h, se
   detiene en semáforos en rojo (espera al verde) y 2 s en altos, baja a 10 km/h en topes.
   Avisos con speechSynthesis es-MX: "Tope a 100 metros", "Semáforo en rojo adelante", "Alto".
```

## FASE 4 — Motor de ciudad (P1, 2 h)
```
Crea /sim en Python según docs/VIVECUU_MASTER.md sección 11 y 18.6:
- Carga data/cuu_drive.graphml, marca nodos semáforo y alto usando data/osm_infra.json (nodo más cercano).
- 150 vehículos (configurable) con origen/destino ponderado a vialidades primary/secondary/trunk,
  avanzan por aristas; se detienen en rojo (misma función determinista que la app) y 2 s en altos;
  respetan overrides; 20 km/h en zonas escolares activas.
- Nivel de tráfico por arista y velocidad promedio por celda de 50 x 50 m.
- Lee incidentes activos cada 2 s: reduce capacidad del carril, rerutea autos afectados, calcula retraso_min.
- Detecta anomalía de celda (< 5 km/h por 20 s sin incidente cerca) → POST a {N8N_WEBHOOK_BASE}/vivecuu/incidente con origen anomalia_celda.
- Publica por Supabase Realtime Broadcast (REST) al canal city-live: evento tick cada 1 s
  ([id,lat,lng,vel,heading] con 5 decimales), evento trafico cada 3 s (GeoJSON de aristas principales
  con nivel >= 1), evento celdas cada 5 s.
- Flag --speed para acelerar el reloj y --n para número de autos. requirements.txt incluido.
Luego en la app: suscríbete a city-live, dibuja autos como círculos pequeños con interpolación
lineal entre ticks (requestAnimationFrame) y las calles coloreadas por nivel. Pill "En vivo · N vehículos".
```

## FASE 5 — Pestaña Camiones + IoT (P2 app / P1 motor, 1.5 h)
```
Según sección 21 y 13:
Motor: rutas desde relaciones route=bus de OSM o, si no hay, 5 rutas definidas en sim/rutas.py
(uniendo puntos que yo ajuste) con paradas cada ~400 m; 2 unidades por ruta; ocupación con Poisson
por hora; cada unidad manda cada 3 s POST /api/iot/ingest con header x-iot-token.
App: /api/iot/ingest valida con zod, guarda lecturas_iot y hace upsert en camiones.
Pestaña Camiones: lista de rutas con color, unidades y ocupación promedio; tarjeta "Tu parada más
cercana" con próxima unidad (ETA y %); buscador "¿A dónde quieres ir en camión?" que sugiere rutas
cuya línea pasa a < 400 m del origen y del destino; al tocar una ruta el mapa filtra solo esa ruta
con paradas y unidades en vivo. Hoja de camión (P2 del diseño) con "Dato de sensor · hace N s".
Crea también GET /api/camiones/cercanos?destino&lat&lng que regrese {texto,...} para el copiloto.
```

## FASE 6 — Botón secreto + n8n + incidentes (P1 + P3, 1.5 h)
```
1. Página /demo (tablet) con: Provocar accidente (select de calles principales y carril 1-3),
   Congestión total en punto, Cerrar vía, Hora pico on/off, Resumen, Lanzar SOS de prueba, Limpiar todo.
   "Provocar accidente" hace POST a {N8N_WEBHOOK_BASE}/vivecuu/incidente con origen boton_secreto.
2. En la app: marcador de incidente (rombo rojo), hoja de incidente con dibujo de carriles
   (bloqueado en rojo), retraso, "Sigue ahí"/"Ya no está".
3. Toasts en vivo escuchando la tabla alertas: 911 simulado (rojo), familiar, desvío, dependencia.
4. Si hay ruta activa y un incidente nuevo cae en su buffer, recalcular y avisar "Te cambié de ruta, +3 min".
5. GET /api/ciudad/estado?zona&lat&lng que resuma tráfico, incidentes y pronóstico en {texto,...}.
Los flujos de n8n se arman a mano siguiendo docs/N8N_FLUJOS.md.
```

## FASE 7 — Copiloto de voz (P3, 1 h)
```
Implementa docs/ELEVENLABS_COPILOTO.md sección 3: hook useCopiloto con @elevenlabs/react, client
tool llevar_a que use la búsqueda y ruta de la Fase 2, variables dinámicas con ubicación/calle/ruta.
Botón de micrófono en la barra superior abre hoja con ondas (escuchando/hablando) y subtítulos.
Plan B: si falla la sesión, usar Web Speech API es-MX → POST al webhook F1 → leer mensaje_voz.
```

## FASE 8 — Reportar con IA (P3, 1 h)
```
Flujo P4 del diseño: cámara/archivo → confirmar pin → nota → "La IA está revisando…" → resultado.
POST /api/reportes/clasificar según sección 12.1: sube a Storage, Claude con visión y el system
prompt dado, valida con zod, deduplica con reportes_cercanos/votar_reporte, inserta, y llama al
webhook F2 de n8n (y F1 si es accidente con severidad >= 4). Marcadores de reportes en vivo por Realtime.
```

## FASE 9 — SOS (P1 motor + P2 UI, 45 min)
```
Pantallas P5: selección y seguimiento. Inserta en emergencias. Motor: hospital más cercano, ruta,
ambulancia a 1.4x, ola verde (upsert en overrides_semaforo verde para semáforos a < 300 m adelante),
actualiza eta_seg y semaforos_verdes. App: ruta roja, ambulancia con halo pulsante, ETA grande,
"Semáforos en verde: N". Aviso visible "Si es grave, llama al 911".
```

## FASE 10 — Pulido (todos, 45 min)
```
Revisa rendimiento (60 fps con 150-300 autos), estados vacíos y de error, textos, splash, íconos,
favicon, meta tags. Agrega en /demo un botón "Sembrar datos" con 8 reportes creíbles en calles
reales y una obra programada. Deploy en Vercel y prueba en 2 celulares a la vez.
```
