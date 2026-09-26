# ViveCUU — Documento Maestro

> **Chihuahua en vivo, en una sola app.**
> Tráfico, camiones, semáforos, topes, zonas escolares, accidentes por carril, reportes ciudadanos y emergencias. Todo en un mapa que se mueve, con IA que entiende, predice y avisa.

Este documento es la fuente de verdad del proyecto. Claude Design y Claude Code (o Cursor) deben leerlo completo antes de generar cualquier cosa.

---

## 0. ACTUALIZACIÓN v2 — esta sección manda sobre todo lo demás

1. **Prioridad #1: la vista principal del usuario**, igual que cuando abres Google Maps o Waze: te ubica, buscas un lugar, te traza la ruta y te avisa lo que hay en el camino. Ver **sección 18**.
2. **Mapa y búsqueda:** Mapbox GL JS (estilo `navigation-day-v1`), Mapbox Search/Geocoding para buscar lugares y Mapbox Directions `driving-traffic` para rutas con tráfico real. **OpenStreetMap** aporta semáforos, altos, topes, cruces, escuelas, hospitales, paradas y rutas de camión.
3. **Altos y semáforos simulados:** los semáforos cambian de color en vivo y los autos se detienen en altos y en rojo. Ver **18.4**.
4. **Pestaña Camiones:** rutas de transporte público, unidades en vivo, ocupación por sensor, parada más cercana y próxima unidad. Ver **sección 21**.
5. **n8n es el orquestador de automatizaciones:** incidentes, alerta 911 (simulada), aviso a contacto familiar, desvíos, ruteo de reportes a dependencias, resúmenes. Ver **sección 19** y `N8N_FLUJOS.md`.
6. **Copiloto de voz con ElevenLabs:** manos libres al volante ("Copiloto, hay un choque adelante en Periférico"). Ver **sección 20** y `ELEVENLABS_COPILOTO.md`.
7. **Celdas de telemetría de 50 × 50 m:** los autos se mueven por calles reales, y su velocidad se agrega en celdas de 50 m para el mapa de calor y la detección de anomalías.
8. **"Botón secreto"** = panel `/demo`: congela el tráfico en un punto, genera la anomalía y dispara toda la automatización en vivo.
9. **El 911 SIEMPRE es simulado.** Nunca se llama ni se manda nada a números de emergencia reales. El aviso "familiar" va al celular de alguien del equipo.

### Tracks (versión del compañero, integrada)
| Track | Pieza de ViveCUU |
|---|---|
| **IA aplicada** | Copiloto de voz (ElevenLabs), clasificación de reportes con visión (Claude), pronóstico, asistente |
| **Automatización** | n8n: flujo de incidente (911 simulado, familiar, desvío), ruteo de reportes, resumen periódico, zonas escolares por horario |
| **IoT / Software** | Sensores de conteo en camiones y telemetría urbana por celdas → `/api/iot/ingest` → dashboard; PWA Next.js + Supabase Realtime |
| **Sistemas inteligentes** | Semáforos y altos simulados, ola verde para ambulancia, reruteo por carril bloqueado |

### Orden de construcción (si algo no da, se corta de abajo hacia arriba)
1. Vista principal: ubicación, búsqueda, ruta, alertas en el camino, modo navegación.
2. Semáforos y altos animados + autos simulados + tráfico por calle.
3. Pestaña Camiones.
4. Botón secreto → n8n → incidente en el mapa + 911 simulado + SMS familiar + desvío.
5. Copiloto de voz ElevenLabs conectado a n8n.
6. Reportar con IA.
7. SOS ambulancia con ola verde.
8. Asistente de texto, feed, pronóstico.

---

## 1. Contexto del hackathon

| Dato | Valor |
|---|---|
| Duración | 12 h (entrega hoy 19:30) |
| Equipo | 3 personas, full-stack, IA sin límite |
| Tracks | IA · Software · IoT · Sistemas Inteligentes / Nuevas Tecnologías · (5.º track, probablemente impacto/smart city) |
| Usuario principal | **Ciudadano común** con su celular (mobile-first) |
| Estilo | **Claro, tipo Google Maps / Waze** |
| Herramientas | Claude Design (pantallas) → Claude Code (construcción) |

### Principio rector
**Todo se ve en vivo y creíble.** La ciudad es real (calles, semáforos, topes, escuelas y hospitales reales de OpenStreetMap). El movimiento (autos, camiones, ocupación) lo genera un **motor de simulación calibrado** que habla exactamente el mismo protocolo que hablarían sensores reales. En el pitch se dice claro:

> "La infraestructura es real. El movimiento lo genera nuestro motor de ciudad, que usa el mismo protocolo que los sensores de conteo que ya traen muchos camiones. Conectar datos reales es cambiar la fuente, no reescribir la app."

---

## 2. El problema

- En Chihuahua la información de la ciudad está regada: Waze para tráfico, redes sociales para accidentes, nadie sabe cuánto tarda o qué tan lleno viene el camión, los baches se reportan por Facebook y se pierden.
- Las zonas escolares no avisan al conductor en el momento.
- Una ambulancia pierde minutos en semáforos y tráfico.
- El gobierno no tiene un solo tablero que junte todo.

## 3. La solución

Una PWA ciudadana con un mapa vivo de Chihuahua que junta **todas las capas de la ciudad** y le agrega inteligencia:

1. **Ves la ciudad moverse**: tráfico por calle en colores, camiones con su ocupación, semáforos cambiando.
2. **Sabes qué hay en tu camino**: topes, baches, cruces, zonas escolares activas, accidentes con el carril exacto.
3. **Reportas en 10 segundos**: foto → la IA identifica qué es, qué tan grave y a quién le toca.
4. **Pides ayuda**: botón SOS → ambulancia más cercana, ruta óptima y "ola verde" de semáforos.
5. **Le preguntas a la ciudad**: "¿cómo está la Universidad ahorita?", "¿qué camión me lleva al Tec y qué tan lleno va?".

---

## 4. Alcance para hoy

### 4.1 Imprescindible (tiene que funcionar en el demo)

| # | Módulo | Qué se ve |
|---|---|---|
| M1 | **Mapa vivo** | Mapa claro de Chihuahua, ~400 autos moviéndose, calles coloreadas por tráfico (verde→rojo), semáforos cambiando |
| M2 | **Capas de infraestructura** | Semáforos, topes, cruces peatonales, escuelas con zona escolar, hospitales (datos reales OSM) |
| M3 | **Camiones en vivo** | 6–10 camiones en rutas, ocupación %, próxima parada, ETA |
| M4 | **Reporte ciudadano con IA** | Foto + ubicación → Claude clasifica tipo, severidad, dependencia responsable → aparece en el mapa |
| M5 | **Incidentes por carril** | Accidente/cierre con dibujo de carriles bloqueados, retraso estimado, reruteo de autos |
| M6 | **SOS / Ambulancia** | Solicitud → ruta óptima desde hospital → ambulancia moviéndose → semáforos en verde en su camino → ETA |

### 4.2 Si da tiempo (en orden de prioridad)

| # | Módulo |
|---|---|
| S1 | **Asistente IA** "Pregúntale a ViveCUU" con contexto en vivo de la ciudad |
| S2 | **Pronóstico 30 min** por corredor ("Periférico de la Juventud se pone pesado en 20 min") |
| S3 | **Feed "Qué pasa en CUU"** cronológico |
| S4 | **Ruta A→B** con alertas en el camino (topes, zona escolar, accidente) |
| S5 | **Mantenimiento programado** (cierre de vía con impacto estimado) |
| S6 | **ESP32 físico** mandando al mismo endpoint IoT (solo si alguien trae uno y sobra tiempo) |

### 4.3 Fuera de alcance hoy (se menciona como visión)
Login real, panel completo de gobierno, app nativa, ML entrenado con datos históricos reales, integración con semáforos físicos.

---

## 5. Cobertura de tracks

| Track | Cómo lo cubre ViveCUU | Qué mostrar en demo |
|---|---|---|
| **IA** | Clasificación multimodal de reportes (foto + texto), asistente con contexto vivo, pronóstico de congestión, resumen del día | Subir foto de bache → sale clasificado solo |
| **Software** | PWA Next.js + Supabase Realtime + PostGIS, arquitectura por eventos | Mapa con cientos de objetos en tiempo real |
| **IoT** | Capa de ingesta de sensores de conteo de pasajeros (APC en puertas/barras) vía `POST /api/iot/ingest`; los camiones simulados son "dispositivos virtuales" que usan ese protocolo | Mostrar el payload del sensor y cómo cambia la ocupación |
| **Sistemas inteligentes** | Semáforos con ciclo y prioridad a emergencias (ola verde), reruteo por accidente, zonas escolares por horario | Botón SOS y ver semáforos ponerse en verde |
| **Impacto social / smart city** | Reporte ciudadano, deduplicación y votos "sigue ahí", ruteo a JMAS / CFE / Municipio / Tránsito | Reporte con votos y dependencia asignada |

---

## 6. Usuarios y pantallas (app ciudadana, mobile-first 390 px)

**Persona:** Ana, 24, estudiante del Tec, va en camión y a veces en carro. Quiere saber si llega a tiempo, qué tan lleno viene el camión y avisar del bache de su calle.

| ID | Pantalla | Contenido clave |
|---|---|---|
| P1 | **Mapa (Home)** | Barra de búsqueda "¿A dónde vas?", chips de capas (Tráfico · Camiones · Reportes · Escuelas · Topes · Semáforos), mapa vivo, botón flotante **Reportar** (naranja), botón **SOS** (rojo), pill de estado "En vivo · 412 vehículos" |
| P2 | **Hoja de camión** (bottom sheet) | Ruta, barra de ocupación con color, "Viene 72% lleno", próxima parada, ETA, fuente del dato (sensor) |
| P3 | **Hoja de incidente/reporte** | Tipo, severidad, dibujo de carriles (bloqueado en rojo), retraso estimado, dependencia, botón "Sigue ahí (15)" / "Ya no está" |
| P4 | **Reportar** (3 pasos) | 1 Foto · 2 Confirmar ubicación en mapa · 3 Nota opcional → estado "La IA está revisando…" → tarjeta de resultado (tipo, severidad, dependencia, título generado) |
| P5 | **SOS** | Tipo de emergencia (ambulancia), confirmación, pantalla de seguimiento: ambulancia en mapa, ETA grande, línea de ruta, "Semáforos en verde: 7" |
| P6 | **Asistente** | Chat con sugerencias rápidas ("¿Cómo está el tráfico?", "¿Qué camión me lleva al Centro?", "¿Hay baches en mi ruta?") |
| P7 | **Qué pasa en CUU** | Feed cronológico: accidentes, cierres, reportes nuevos, pronósticos |
| P8 | **Ruta A→B** | Origen/destino, tiempo, alertas en el camino, alternativa más rápida |
| ADM | **/demo** (oculto) | Botones para el demo: provocar accidente (calle + carril), cerrar vía, hora pico on/off, velocidad de simulación, lanzar SOS |

Navegación inferior: **Mapa · Qué pasa · Asistente · Reportar**. SOS siempre visible sobre el mapa.

---

## 7. Sistema de diseño (claro, tipo Waze/Google Maps)

### Marca
- Logotipo: **Vive** (gris carbón) + **CUU** (naranja cantera), sans-serif bold redondeada.
- Tono de copy: cercano, directo, español mexicano neutro con toque norteño ("Viene lleno", "Aguas: zona escolar").

### Tokens
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#FFFFFF` | Fondo |
| `--surface` | `#F6F7F9` | Tarjetas, sheets |
| `--text` | `#1F2328` | Texto principal |
| `--text-2` | `#5F6B7A` | Secundario |
| `--brand` | `#F26B1D` | Naranja cantera (Reportar, acentos) |
| `--primary` | `#1A73E8` | Azul acción (rutas, links) |
| `--sos` | `#E5252A` | Emergencias |
| `--traffic-free` | `#34A853` | Fluido |
| `--traffic-mod` | `#FBBC04` | Moderado |
| `--traffic-heavy` | `#F57C00` | Pesado |
| `--traffic-stop` | `#C5221F` | Detenido |
| `--school` | `#8E44AD` | Zonas escolares |
| Radio | 16 px tarjetas, 999 px pills | |
| Sombra | `0 4px 16px rgba(0,0,0,.08)` | Flotantes |
| Tipografía | Inter (o Plus Jakarta Sans), 14/16/20/28 | |

### Iconografía de mapa
Semáforo (círculo con estado verde/ámbar/rojo), tope (triángulo amarillo), bache (círculo naranja con grieta), cruce (cebra), escuela (birrete morado + polígono translúcido), hospital (cruz), camión (cápsula con color de ruta y anillo de ocupación), accidente (rombo rojo), obra (cono), ambulancia (ícono con halo rojo pulsante).

### Mapa base
MapLibre GL con estilo claro gratuito **OpenFreeMap "liberty"** (`https://tiles.openfreemap.org/styles/liberty`), respaldo Carto Positron. Centro inicial: Centro de Chihuahua, aprox. `28.635, -106.089`, zoom 13.

---

## 8. Arquitectura

Ver `diagramas/01_arquitectura.mermaid`.

```
Datos reales (OSM, INEGI, Open-Meteo)
        │
        ▼
Motor de ciudad (Python) ──broadcast 1 s──► Supabase Realtime ──► App ViveCUU (Next.js PWA)
        │  ▲                                     ▲                        │
        │  └──── lee incidentes/emergencias ─────┤                        │
        └──── sensores virtuales ──► /api/iot/ingest ──► Postgres+PostGIS ◄┘
                                                                          │
                                           /api/reportes/clasificar ─► Claude API
                                           /api/asistente ───────────► Claude API
```

**Regla clave:** la app nunca habla directo con el motor. Todo pasa por Supabase. Así el motor se puede cambiar por datos reales sin tocar la app.

### Stack
| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind + MapLibre GL (`react-map-gl/maplibre`) + PWA |
| Backend | API routes de Next.js (serverless en Vercel) |
| Datos | Supabase: Postgres + PostGIS + Realtime (Broadcast + Postgres Changes) + Storage |
| Motor de ciudad | Python 3.11 + OSMnx + NetworkX + httpx, corre en una laptop durante el demo |
| IA | Claude API: modelo rápido con visión para clasificar reportes (Haiku), modelo más capaz para el asistente (Sonnet). Revisar nombres vigentes en docs.claude.com |
| Deploy | Vercel + Supabase |

### Variables de entorno
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # solo servidor y motor
ANTHROPIC_API_KEY=                # solo servidor
IOT_INGEST_TOKEN=                 # token compartido motor/sensores
```

---

## 9. Fuentes de datos

### 9.1 Reales

**OpenStreetMap (Overpass API)** — bbox de la ciudad de Chihuahua (sur, oeste, norte, este):

```
[out:json][timeout:120][bbox:28.55,-106.20,28.76,-105.95];
(
  node["highway"="traffic_signals"];
  node["highway"="stop"];
  node["traffic_calming"];
  way["traffic_calming"];
  node["highway"="crossing"];
  node["amenity"="school"];
  way["amenity"="school"];
  node["amenity"="hospital"];
  way["amenity"="hospital"];
  node["highway"="bus_stop"];
  relation["route"="bus"];
);
out center tags;
```
Guardar en `data/osm_infra.json`. Verificar cuántos topes y semáforos trae; si vienen pocos, se complementan con reportes ciudadanos sembrados.

**Red vial (OSMnx):**
```python
import osmnx as ox
G = ox.graph_from_place("Chihuahua, Chihuahua, Mexico", network_type="drive")
G = ox.add_edge_speeds(G)
G = ox.add_edge_travel_times(G)
ox.save_graphml(G, "data/cuu_drive.graphml")
```

**INEGI – Accidentes de tránsito terrestre en zonas urbanas (ATUS):** estadística por municipio (no trae coordenadas). Se usa para **calibrar** frecuencia de accidentes por hora y día de la semana y tipo (colisión, atropellamiento, etc.). Si no da tiempo de descargarlo, usar curva por hora fija documentada en `sim/config.py`.

**Open-Meteo** (sin API key): clima actual de Chihuahua; lluvia sube probabilidad de accidente y baja velocidades 15%.

### 9.2 Simulados (sobre la red real)
- Vehículos, velocidades, congestión por calle.
- Camiones y su ocupación (vía sensores virtuales).
- Ciclos de semáforo.
- Accidentes y cierres (automáticos con baja probabilidad + disparados desde `/demo`).
- Rutas de camión: usar relaciones `route=bus` de OSM si existen; si no, trazar 4–6 rutas uniendo puntos conocidos (Centro, UACH, Tec, Periférico de la Juventud, zonas habitacionales) con ruta más corta sobre la red.

---

## 10. Modelo de datos (Supabase)

Ver `diagramas/02_modelo_datos.mermaid`. SQL listo:

```sql
create extension if not exists postgis;

-- Infraestructura real de OSM
create table infra (
  id bigserial primary key,
  osm_id bigint,
  tipo text not null check (tipo in ('semaforo','alto','tope','cruce','escuela','hospital','parada')),
  nombre text,
  lat double precision not null,
  lng double precision not null,
  geom geography(Point,4326) generated always as (st_setsrid(st_makepoint(lng,lat),4326)::geography) stored,
  meta jsonb default '{}'
);
create index on infra using gist(geom);

create table zonas_escolares (
  id bigserial primary key,
  escuela_id bigint references infra(id),
  nombre text,
  limite_kmh int default 20,
  horarios text default '07:00-08:30,12:30-14:30',
  poligono jsonb not null            -- GeoJSON Polygon (buffer 150 m)
);

create table rutas_camion (
  id text primary key,
  nombre text not null,
  color text not null,
  trazo jsonb not null               -- GeoJSON LineString
);

create table camiones (
  id text primary key,
  ruta_id text references rutas_camion(id),
  capacidad int default 80,
  ocupacion int default 0,
  proxima_parada text,
  eta_min int,
  fuente text default 'sim' check (fuente in ('sim','iot')),
  lat double precision, lng double precision,
  updated_at timestamptz default now()
);

create table lecturas_iot (
  id bigserial primary key,
  device_id text not null,
  camion_id text references camiones(id),
  suben int default 0,
  bajan int default 0,
  ocupacion int,
  ts timestamptz default now()
);

create table reportes (
  id bigserial primary key,
  tipo text,                          -- bache|tope|semaforo_fallando|obra|accidente|basura|luminaria|fuga_agua|otro
  severidad int check (severidad between 1 and 5),
  titulo text,
  descripcion text,
  resumen_ia text,
  dependencia text,                   -- municipio|transito|jmas|cfe|ninguna
  confianza real,
  foto_url text,
  votos int default 1,
  estado text default 'abierto' check (estado in ('abierto','en_revision','resuelto')),
  lat double precision not null,
  lng double precision not null,
  geom geography(Point,4326) generated always as (st_setsrid(st_makepoint(lng,lat),4326)::geography) stored,
  created_at timestamptz default now()
);
create index on reportes using gist(geom);

create table incidentes (
  id bigserial primary key,
  tipo text not null check (tipo in ('accidente','cierre','obra','evento')),
  descripcion text,
  calle text,
  carril_bloqueado int[] default '{}',  -- ej. {2}
  carriles_totales int default 3,
  severidad int default 3,
  retraso_min int,
  estado text default 'activo' check (estado in ('activo','resuelto')),
  inicio timestamptz default now(),
  fin timestamptz,
  lat double precision not null,
  lng double precision not null,
  edge_ref text                       -- "u-v-key" del grafo OSMnx
);

create table emergencias (
  id bigserial primary key,
  tipo text default 'ambulancia',
  estado text default 'solicitada' check (estado in ('solicitada','en_camino','en_sitio','cancelada')),
  hospital_id bigint references infra(id),
  lat double precision not null,
  lng double precision not null,
  ruta jsonb,                         -- GeoJSON LineString
  eta_seg int,
  semaforos_verdes int default 0,
  created_at timestamptz default now()
);

-- Deduplicación: reportes del mismo tipo a <30 m en 48 h
create or replace function reportes_cercanos(p_lat double precision, p_lng double precision, p_tipo text)
returns setof reportes language sql stable as $$
  select * from reportes
  where tipo = p_tipo and estado <> 'resuelto'
    and created_at > now() - interval '48 hours'
    and st_dwithin(geom, st_setsrid(st_makepoint(p_lng,p_lat),4326)::geography, 30)
  order by created_at desc limit 1;
$$;

create or replace function votar_reporte(p_id bigint)
returns void language sql security definer as $$
  update reportes set votos = votos + 1 where id = p_id;
$$;

-- Realtime
alter publication supabase_realtime add table reportes, incidentes, emergencias, camiones;

-- RLS: lectura pública; escritura ciudadana solo en reportes y emergencias
alter table infra enable row level security;
alter table zonas_escolares enable row level security;
alter table rutas_camion enable row level security;
alter table camiones enable row level security;
alter table reportes enable row level security;
alter table incidentes enable row level security;
alter table emergencias enable row level security;
alter table lecturas_iot enable row level security;
create policy "lectura" on infra for select using (true);
create policy "lectura" on zonas_escolares for select using (true);
create policy "lectura" on rutas_camion for select using (true);
create policy "lectura" on camiones for select using (true);
create policy "lectura" on reportes for select using (true);
create policy "lectura" on incidentes for select using (true);
create policy "lectura" on emergencias for select using (true);
create policy "insertar" on emergencias for insert with check (true);
-- Los reportes se insertan desde /api/reportes/clasificar con service role.
```
Si la columna `generated` marca error por inmutabilidad, cambiarla por trigger `before insert or update`.

Bucket de Storage: `reportes` (público lectura).

---

## 11. Motor de ciudad (Python)

Ver `diagramas/06_motor_ciudad.mermaid`.

### Estructura
```
sim/
  config.py        # parámetros: n_vehiculos, tick, curvas por hora, velocidad demo
  red.py           # carga graphml, semáforos, carriles por arista
  vehiculos.py     # autos: origen/destino, ruta, avance, frenado en rojo
  semaforos.py     # ciclos con desfase, override ola verde
  camiones.py      # rutas, paradas, sensores virtuales APC
  incidentes.py    # accidentes/cierres: bloqueo de carril, reruteo
  emergencias.py   # ruta hospital→sitio, ambulancia, ola verde
  congestion.py    # nivel por arista y agregado por corredor
  pronostico.py    # tendencia a 30 min por corredor
  publicar.py      # broadcast a Supabase Realtime + upserts
  main.py          # loop
```

### Reglas
- **Tick** de 1 s (reloj real) con multiplicador de velocidad para demo (`x1`, `x5`).
- **Vehículos (≈400):** origen/destino aleatorio con peso a vialidades principales (`primary`, `secondary`, `trunk`). Velocidad = libre × factor_hora × factor_congestión × factor_clima × factor_incidente. En zona escolar activa, máximo 20 km/h.
- **Semáforos:** nodos con `highway=traffic_signals`. Ciclo 45 s verde / 4 s ámbar / 41 s rojo con desfase aleatorio. Auto que llega en rojo espera.
- **Congestión por arista:** densidad = vehículos / (longitud × carriles). Niveles 0 fluido, 1 moderado, 2 pesado, 3 detenido.
- **Camiones:** recorren su ruta en loop; paradas cada ~400 m; en cada parada suben/bajan pasajeros con Poisson según curva horaria (pico 7–9 y 13–15 y 18–20). Cada camión es un **sensor virtual** que manda a `/api/iot/ingest`:
  ```json
  { "device_id": "apc-R2-03", "camion_id": "R2-03", "suben": 4, "bajan": 1,
    "ocupacion": 57, "lat": 28.64, "lng": -106.08, "ts": "2026-09-26T13:05:02-06:00" }
  ```
- **Incidentes:** lee `incidentes` activos cada 2 s. Carril bloqueado reduce capacidad `(total - bloqueados)/total`; si todos, arista cerrada. Autos cuya ruta pasa por ahí se rerutean. Calcula `retraso_min` y lo actualiza.
- **Emergencias:** lee `emergencias` en estado `solicitada` → hospital más cercano (por tiempo) → ruta más rápida → estado `en_camino`, guarda `ruta` y `eta_seg` → mueve ambulancia a 1.4× velocidad libre → semáforos a menos de 300 m adelante en su ruta pasan a verde (cuenta `semaforos_verdes`) → `en_sitio`.
- **Pronóstico (S2):** por corredor (aristas agrupadas por nombre de calle), guarda historial de 10 min de velocidad promedio, calcula tendencia lineal + curva horaria y emite "en 30 min: nivel X". Se etiqueta como **modelo de tendencia**, no como magia.

### Publicación
- **Broadcast** canal `city-live` vía REST de Supabase Realtime (`POST {SUPABASE_URL}/realtime/v1/api/broadcast`, verificar formato en docs):
  - evento `tick` cada 1 s: `{ t, vehiculos: [[id, lat, lng, vel, heading]...], semaforos: [[id, estado]...], ambulancias: [...] }`
  - evento `trafico` cada 3 s: GeoJSON FeatureCollection de aristas con nivel ≥ 1 (solo vialidades principales)
  - evento `pronostico` cada 30 s
- **Upserts** a `camiones` cada 3 s (vía `/api/iot/ingest`), a `incidentes` y `emergencias` cuando cambian.
- Mantener cada mensaje de `tick` < 100 KB (coordenadas con 5 decimales).

---

## 12. IA

### 12.1 Clasificación de reportes — `POST /api/reportes/clasificar`
Entrada: foto (base64), nota, lat/lng. Proceso:
1. Subir foto a Storage.
2. Llamar a Claude (modelo rápido con visión) con este system prompt:

```
Eres el clasificador de reportes urbanos de ViveCUU, en Chihuahua, México.
Recibes una foto y una nota opcional de un ciudadano.
Responde SOLO con JSON válido, sin texto extra, con esta forma:
{
  "es_valido": boolean,              // false si la foto no muestra un problema urbano
  "tipo": "bache|tope|semaforo_fallando|obra|accidente|basura|luminaria|fuga_agua|otro",
  "severidad": 1-5,                  // 5 = peligro inmediato para personas o vehículos
  "titulo": "máx. 8 palabras",
  "resumen": "1-2 oraciones claras para otros ciudadanos",
  "dependencia": "municipio|transito|jmas|cfe|ninguna",
  "afecta_carril": boolean,
  "confianza": 0.0-1.0
}
Criterios: bache profundo en carril de alta velocidad = 4-5; fuga de agua = jmas;
luminaria o cables = cfe; semáforo o accidente = transito; baches, topes, basura, obra = municipio.
```
3. Validar JSON (Zod). Si falla, reintentar una vez; si vuelve a fallar, `tipo=otro`, `severidad=2`.
4. `reportes_cercanos()` → si existe, `votar_reporte()` y responder "Ya lo habían reportado, sumaste tu voto".
5. Insertar reporte → Realtime lo pinta en todos los celulares.

### 12.2 Asistente — `POST /api/asistente`
- Construye contexto en vivo desde Supabase: incidentes activos, top 10 corredores con más tráfico (último evento `trafico` guardado en memoria/tabla), camiones por ruta con ocupación, reportes recientes cerca del usuario, clima, pronósticos.
- System prompt: "Eres ViveCUU, el asistente de movilidad de Chihuahua. Contestas corto, claro, en español mexicano. Usa solo el contexto dado; si no sabes, dilo. Da una recomendación accionable."
- Streaming de respuesta.

### 12.3 Pronóstico (motor) y resumen del día
- Pronóstico: modelo de tendencia del motor (sección 11).
- Resumen: botón en "Qué pasa en CUU" → Claude resume las últimas 2 h de eventos en 3 bullets.

---

## 13. IoT

- Endpoint `POST /api/iot/ingest` con header `x-iot-token`.
- Valida, guarda en `lecturas_iot`, actualiza `camiones` (ocupación, posición, `fuente`).
- Sensores representados: **contadores automáticos de pasajeros (APC)** en puertas o barras laterales, como los que ya traen muchas unidades de transporte público.
- Los camiones del motor son dispositivos virtuales con el mismo payload. Un ESP32 con sensor IR (opcional, S6) usaría exactamente el mismo endpoint:
  ```
  POST https://<app>.vercel.app/api/iot/ingest
  x-iot-token: <token>
  {"device_id":"esp32-01","camion_id":"R1-01","suben":1,"bajan":0}
  ```
- En la hoja del camión se muestra "Dato de sensor · hace 2 s".

---

## 14. Plan de trabajo (3 personas)

Ver `diagramas/07_plan_gantt.mermaid`. Ajustar horas según a qué hora arranquen.

| Bloque | P1 — Motor y datos | P2 — App y mapa | P3 — Diseño, IA y pitch |
|---|---|---|---|
| **Arranque (60 min)** | Supabase: SQL, bucket, keys. Overpass + OSMnx. Script `seed_infra.py` | Scaffold Next.js, MapLibre con estilo claro centrado en CUU, PWA | Claude Design: todas las pantallas P1–P8 + sistema de diseño |
| **Núcleo (2.5 h)** | Motor: vehículos, semáforos, congestión, broadcast `tick` y `trafico` | Suscripción Realtime, capas (autos, tráfico, infra, zonas escolares), chips de capas | `/api/reportes/clasificar` + flujo Reportar P4 |
| **Integración (2 h)** | Camiones + sensores virtuales + `/api/iot/ingest`, incidentes y reruteo | Hojas P2 y P3 (camión, incidente con carriles), marcadores de reportes en vivo | SOS P5 (UI) + tabla emergencias; P1 implementa lógica en motor |
| **Inteligencia (1.5 h)** | Emergencias + ola verde, pronóstico | Pantalla `/demo`, feed P7 | Asistente P6 |
| **Pulido (1 h)** | Sembrar datos creíbles (reportes, 1 obra programada), calibrar hora pico | Detalles visuales, animación suave de autos, rendimiento | Slides (3–4), guion, video respaldo de 60 s |
| **Ensayo (45 min)** | Los 3: demo corrido 3 veces, respuestas a preguntas, deploy final | | |

**Congelar código 45 min antes de la entrega.** Nada nuevo después de eso.

---

## 15. Guion del demo (3 min)

1. **(0:00) Problema** — "En Chihuahua la ciudad habla, pero nadie la escucha junta."
2. **(0:20) Mapa vivo** — Abrir app en celular: autos moviéndose, calles en colores, semáforos cambiando. "Esto es Chihuahua ahorita." Tocar un camión: "Viene 72% lleno, llega en 4 min. Dato del sensor de la puerta."
3. **(0:50) Accidente** — Desde `/demo`, accidente en Periférico de la Juventud, carril 2. En la app aparece el rombo rojo, la hoja muestra el carril bloqueado, la calle se pone roja y los autos toman otra ruta.
4. **(1:20) Reporte** — Foto de un bache → "La IA está revisando…" → "Bache profundo · Severidad 4 · Le toca al Municipio". Aparece en el mapa de todos. Otro celular lo reporta: "Ya lo habían reportado, sumaste tu voto".
5. **(1:50) SOS** — Botón SOS → ambulancia sale del hospital más cercano, línea de ruta, semáforos en verde en su camino, ETA bajando.
6. **(2:20) Asistente** — "¿Cómo me voy al Tec sin tráfico?" → respuesta con contexto en vivo y pronóstico.
7. **(2:40) Cierre** — Tracks cubiertos en una lámina + "La infraestructura es real, el motor usa el mismo protocolo que los sensores reales. Conectar la ciudad es cambiar la fuente. **ViveCUU: Chihuahua en vivo.**"

---

## 16. Riesgos y plan B

| Riesgo | Plan B |
|---|---|
| Realtime lento con 400 autos | Bajar a 200 autos o tick de 2 s; interpolar en el cliente |
| Overpass caído | Espejo `overpass.kumi.systems` o descargar desde otro miembro; tener JSON guardado |
| OSMnx tarda en descargar | Correrlo primero que nada; compartir el `.graphml` |
| Claude API falla en demo | Respuesta de respaldo precargada para la foto del demo |
| Wi-Fi del evento | Hotspot del celular; video de respaldo de 60 s |
| No da tiempo el asistente | Se muestra como visión en slides |

---

## 17. Preguntas que hará el jurado (y respuestas)

- **¿Los datos son reales?** La infraestructura sí (OSM). El movimiento es simulación calibrada con estadística de INEGI y curvas horarias. La app consume una interfaz que no cambia si mañana conectamos sensores reales.
- **¿Cómo escalan?** Motor y app desacoplados por Supabase Realtime; los sensores entran por un endpoint único.
- **¿Privacidad?** No se rastrea a personas; los reportes no guardan identidad; ubicación solo al reportar.
- **¿Modelo de negocio?** Licencia a municipios (tablero y datos agregados), gratis para ciudadanos.
- **¿Qué es IA de verdad aquí?** Clasificación multimodal, ruteo a dependencias, deduplicación semántica, asistente con contexto vivo y pronóstico por tendencia.

---

## 18. Vista principal del usuario (PRIORIDAD #1)

Ver `diagramas/08_vista_principal.mermaid`.

### 18.1 Al abrir la app (como Maps/Waze)
1. Splash de 1 s con el logo ViveCUU.
2. Pide permiso de ubicación (`navigator.geolocation.watchPosition`, alta precisión).
3. Mapa a pantalla completa, `flyTo` a la ubicación del usuario (zoom 15) con punto azul y cono de dirección. Si niega el permiso: centro de Chihuahua `28.635, -106.089`, zoom 13, y aviso discreto "Activa tu ubicación para rutas".
4. Arriba: barra "¿A dónde vas?" + botón de micrófono (copiloto de voz) + avatar.
5. Debajo: chips de capas (Tráfico · Camiones · Semáforos · Altos y topes · Escuelas · Reportes).
6. Abajo a la derecha: botón "centrar en mí", botón naranja **Reportar**, botón rojo **SOS**.
7. Barra inferior: **Mapa · Camiones · Qué pasa · Asistente**.
8. Pill "● En vivo · 148 vehículos · 23 °C".

### 18.2 Búsqueda
- Tocar la barra abre búsqueda a pantalla completa: Recientes, accesos rápidos (Casa, Trabajo/Escuela, Centro, Tec II) y resultados en vivo.
- **Mapbox Search Box API / Geocoding** con `proximity` = ubicación del usuario, `country=mx`, `bbox=-106.20,28.55,-105.95,28.76`, `language=es`. Debounce 250 ms.
- Respaldo: **Nominatim** de OSM (máx. 1 petición/s, con User-Agent propio).
- Al elegir: tarjeta inferior con nombre, dirección, distancia, "🚗 12 min · 🚌 25 min", botón azul **Cómo llegar**.

### 18.3 Ruta y alertas en el camino
- **Mapbox Directions** perfil `driving-traffic`, `alternatives=true`, `steps=true`, `geometries=geojson`, `language=es`. Ruta principal azul gruesa, alternativas grises tocables.
- Con Turf.js: buffer de 25 m sobre la ruta y cruce con nuestros datos → lista de alertas ordenadas por distancia: semáforos (cuántos), altos, topes, cruces peatonales, **zonas escolares activas** (según horario), incidentes activos, reportes con severidad ≥ 3.
- Resumen en la tarjeta: "14 min · 6 semáforos · 3 topes · 1 zona escolar activa · ⚠️ choque en carril 2".
- Si hay un incidente activo sobre la ruta, ofrecer la alternativa: "Evita el choque en Periférico: +2 min".

### 18.4 Semáforos y altos simulados
- **Semáforos (OSM `highway=traffic_signals`)**: el estado se calcula con una función **determinista** compartida por el motor y la app, así todos los celulares ven lo mismo sin gastar red:
  ```ts
  // ciclo 90 s: verde 45, ámbar 4, rojo 41
  const offset = (osmId % 90);
  const t = (Math.floor(Date.now() / 1000) + offset) % 90;
  const estado = t < 45 ? 'verde' : t < 49 ? 'ambar' : 'rojo';
  ```
  Excepción: si el motor manda un override (ola verde de ambulancia, o semáforo forzado a rojo por n8n), el override gana hasta que expire.
- Ícono del semáforo: pastilla vertical con la luz activa encendida; a zoom < 14 solo un punto de color.
- **Altos (OSM `highway=stop`)**: octágono rojo con "ALTO". Los autos simulados se detienen 2 s.
- **Topes (`traffic_calming=*`)**: triángulo amarillo; los autos bajan a 10 km/h en 20 m.
- En navegación, aviso: "Semáforo en rojo a 150 m", "Alto a 80 m", "Tope a 100 m".

### 18.5 Modo navegación
- Botón **Iniciar**: cámara sigue al usuario con `pitch 55`, banner superior con la próxima maniobra ("En 300 m gira a la derecha en Av. Universidad"), barra inferior con ETA, hora de llegada y distancia.
- **Modo demo "Simular viaje"** (en el evento no te vas a mover): el punto azul recorre la ruta a 40 km/h respetando semáforos en rojo y altos. Esto es lo que se muestra al jurado.
- Avisos hablados: `speechSynthesis` del navegador en `es-MX` (o voz de ElevenLabs si ya está conectado).
- Recalcula si se sale de la ruta más de 40 m o si aparece un incidente en la ruta.

### 18.6 Autos y tráfico simulados sobre el mapa
- 150 autos al inicio (subir a 300 si el rendimiento aguanta), puntos pequeños grises con dirección.
- Calles principales coloreadas por el nivel de tráfico del motor (verde/amarillo/naranja/rojo) + opción de encender la **capa de tráfico real de Mapbox** (`mapbox.mapbox-traffic-v1`, verificar cobertura en Chihuahua).
- **Celdas de 50 × 50 m**: el motor agrega la velocidad promedio por celda; capa opcional de calor. Si una celda cae a < 5 km/h por 20 s sin causa conocida → **anomalía** → webhook a n8n.

---

## 19. Automatizaciones con n8n

Detalle completo en `N8N_FLUJOS.md` y `diagramas/09_n8n_incidente.mermaid`.

| Flujo | Disparador | Qué hace |
|---|---|---|
| **F1 Incidente** | Webhook `POST /webhook/vivecuu/incidente` (botón secreto, copiloto de voz, anomalía de celdas, reporte severo) | Normaliza → clasifica severidad (Claude) → inserta incidente → si severidad ≥ 4: alerta 911 **simulada** al dashboard + SMS/Telegram al contacto familiar con ubicación y ETA + protocolo de desvío (semáforo a rojo, reruteo) → responde resumen para que el copiloto lo diga en voz |
| **F2 Reporte ciudadano** | Webhook desde `/api/reportes/clasificar` | Manda correo a la "dependencia" (buzón del equipo), agrega al feed |
| **F3 Resumen de la ciudad** | Cron cada 30 min (o botón en `/demo`) | Lee eventos → Claude resume → publica en "Qué pasa en CUU" |
| **F4 Zonas escolares** | Cron 07:00, 08:30, 12:30, 14:30 | Activa/desactiva zonas y avisa en el feed |

Tabla nueva para que el dashboard muestre lo que hizo n8n:
```sql
create table alertas (
  id bigserial primary key,
  tipo text check (tipo in ('911_simulado','familiar','desvio','dependencia','resumen','zona_escolar')),
  titulo text,
  mensaje text,
  payload jsonb,
  incidente_id bigint references incidentes(id),
  created_at timestamptz default now()
);
alter table alertas enable row level security;
create policy "lectura" on alertas for select using (true);
alter publication supabase_realtime add table alertas;

create table overrides_semaforo (
  osm_id bigint primary key,
  estado text check (estado in ('verde','rojo')),
  motivo text,
  expira timestamptz not null
);
alter table overrides_semaforo enable row level security;
create policy "lectura" on overrides_semaforo for select using (true);
alter publication supabase_realtime add table overrides_semaforo;
```

**Importante:** n8n tiene que tener URL pública para que ElevenLabs y Vercel le peguen: usar **n8n Cloud** (trial) o n8n local + túnel (`cloudflared tunnel --url http://localhost:5678` o ngrok).

---

## 20. Copiloto de voz (ElevenLabs)

Detalle en `ELEVENLABS_COPILOTO.md` y `diagramas/10_copiloto_voz.mermaid`.

- Agente conversacional de ElevenLabs en español con voz mexicana.
- Se abre con el botón de micrófono de la barra de búsqueda o con "Copiloto" en modo navegación.
- **Herramientas del agente:**
  - `reportar_incidente` (webhook → n8n F1)
  - `consultar_trafico` (GET → `/api/ciudad/estado`)
  - `buscar_camion` (GET → `/api/camiones/cercanos`)
  - `llevar_a` (client tool → la app busca el lugar y traza la ruta en pantalla)
- Ejemplos: "Copiloto, llévame al Tec", "¿Cómo está la Universidad?", "Hay un choque fuerte adelante en Periférico, carril de en medio", "¿Qué camión me lleva al Centro y qué tan lleno viene?".

---

## 21. Pestaña Camiones

- **Lista de rutas**: color, nombre (ej. "Ruta 2 · Centro – Tec"), unidades activas, ocupación promedio con barra de color.
- Arriba: "¿A dónde quieres ir en camión?" → sugiere rutas que pasan cerca de tu ubicación y del destino (Turf: distancia de la línea de la ruta a origen y destino < 400 m).
- **Tarjeta "Tu parada más cercana"**: nombre, distancia caminando, próxima unidad "llega en 4 min · 60% lleno", siguiente "12 min · 35% lleno".
- **Tocar una ruta**: el mapa filtra solo esa ruta (línea de color + paradas + unidades moviéndose en vivo); cada unidad muestra anillo de ocupación y "Dato de sensor · hace 2 s".
- Datos: relaciones `route=bus` y `highway=bus_stop` de OSM si existen en Chihuahua; si no, 4–6 rutas trazadas por el equipo con paradas cada ~400 m. Ocupación: sensores (virtuales o ESP32) vía `/api/iot/ingest`.

---

## 22. Demo v2 (2 minutos, "momento wow")

Dos pantallas: **celular/proyector con la app** y **laptop con n8n** abierto en el flujo F1.

1. **(0:00)** Abres ViveCUU: te ubica en el evento, autos moviéndose, semáforos cambiando.
2. **(0:15)** Buscas "Tec II" → ruta con "6 semáforos · 3 topes · zona escolar activa" → **Simular viaje**: el auto se para en el rojo y en el alto, la voz avisa el tope.
3. **(0:40)** Pestaña **Camiones**: "Ruta 2 llega en 4 min, viene 72% lleno — dato del sensor".
4. **(1:00)** Tocas el micrófono: *"Copiloto, hay un choque fuerte en Av. Tecnológico, carril de en medio, avisa a emergencias."*
5. **(1:10)** En la laptop, el flujo de n8n se ilumina nodo por nodo: clasifica severidad → crea incidente → semáforo a rojo → alerta 911 simulada → SMS al celular del compañero (suena en vivo) → desvío.
6. **(1:25)** En la app: rombo rojo en Av. Tecnológico, carril 2 bloqueado, calle roja, los autos toman otra ruta, tu ruta se recalcula. El copiloto responde en voz: "Listo, reporté el choque, avisé a emergencias y te llevo por Av. Universidad, +3 minutos."
7. **(1:45)** Cierre: "ViveCUU: Chihuahua en vivo. IA, automatización e IoT en una sola app."
