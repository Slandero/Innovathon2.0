# ViveCUU — Flujos de n8n

n8n es el **sistema nervioso de automatización**: todo evento importante de la ciudad entra por un webhook, n8n decide y ejecuta, y deja rastro en la tabla `alertas` para que el dashboard y la app lo muestren en vivo.

> **Regla:** el 911 es SIEMPRE simulado (se inserta una alerta y se muestra en pantalla). El aviso "familiar" va al celular de alguien del equipo.

## Setup (15 min)
1. n8n Cloud (trial) **o** local: `docker run -it --rm -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n`
2. Si es local, túnel público: `cloudflared tunnel --url http://localhost:5678` y poner `WEBHOOK_URL=<url del túnel>` al levantar n8n.
3. Credenciales en n8n:
   - **Supabase**: Header Auth con `apikey: <SERVICE_ROLE_KEY>` y `Authorization: Bearer <SERVICE_ROLE_KEY>` (para nodos HTTP Request contra `https://<proyecto>.supabase.co/rest/v1/...`).
   - **Anthropic**: nodo de Anthropic o HTTP Request a `https://api.anthropic.com/v1/messages` con `x-api-key` y `anthropic-version: 2023-06-01`.
   - **Mensajería al familiar** (elige una): Telegram Bot (la más rápida de configurar, gratis), Twilio SMS, o WhatsApp Cloud API.
   - **Correo** (F2): Gmail u SMTP hacia un buzón del equipo que haga de "dependencia".
4. Variables (Settings → Variables o en nodos Set): `SUPABASE_URL`, `APP_URL`, `FAMILIAR_CHAT_ID` o `FAMILIAR_PHONE`.

---

## F1 — Incidente (el flujo del "momento wow")

**Disparadores que llegan al mismo webhook:**
- Botón secreto en `/demo`
- Copiloto de voz (tool `reportar_incidente` de ElevenLabs)
- Motor de ciudad (anomalía en celdas de 50 m)
- `/api/reportes/clasificar` cuando un reporte sale con severidad ≥ 4 y tipo accidente

### Contrato de entrada
`POST {N8N_URL}/webhook/vivecuu/incidente`
```json
{
  "origen": "voz | boton_secreto | anomalia_celda | reporte",
  "texto": "hay un choque fuerte en av tecnológico, carril de en medio",
  "tipo": "accidente",
  "calle": "Av. Tecnológico",
  "carril": 2,
  "carriles_totales": 3,
  "severidad": null,
  "lat": 28.6512,
  "lng": -106.0801,
  "usuario": { "nombre": "Demo", "eta_destino_min": 14 }
}
```
Si el copiloto no manda `lat/lng`, se usa la ubicación del usuario (la app la pasa como variable dinámica al agente) o se geocodifica `calle` con Mapbox.

### Nodos (en orden)
| # | Nodo | Configuración |
|---|---|---|
| 1 | **Webhook** | POST, path `vivecuu/incidente`, Respond: "Using 'Respond to Webhook' node" |
| 2 | **Code: Normalizar** | Limpia texto, valores por defecto (`carriles_totales=3`, `tipo='accidente'`), agrega `recibido_en` |
| 3 | **IF: ¿Trae severidad?** | `{{$json.severidad}}` is not empty |
| 4 | **Anthropic / HTTP: Clasificar** (rama "no") | Prompt de abajo → devuelve `{tipo, severidad, carril, resumen, requiere_911}` |
| 5 | **Merge** | Junta ambas ramas |
| 6 | **HTTP: Insertar incidente** | `POST {SUPABASE_URL}/rest/v1/incidentes` header `Prefer: return=representation`, body con tipo, calle, carril_bloqueado `[carril]`, carriles_totales, severidad, lat, lng, descripcion=resumen |
| 7 | **HTTP: Semáforo a rojo** | Busca semáforo más cercano (`GET /rest/v1/rpc/semaforo_cercano?lat=..&lng=..`) y hace `POST /rest/v1/overrides_semaforo` con `estado=rojo`, `expira=now()+5 min`, motivo "incidente" |
| 8 | **Switch: Severidad** | ≥ 4 → rama crítica; 3 → rama media; ≤ 2 → solo feed |
| 9a | **HTTP: 911 simulado** (crítica) | `POST /rest/v1/alertas` tipo `911_simulado`, título "Enlace 911 (simulado)", mensaje con folio `CUU-{{$now.toFormat('HHmmss')}}`, ubicación y severidad |
| 9b | **Telegram/Twilio: Familiar** (crítica) | "ViveCUU: se reportó un choque cerca de la ruta de {{nombre}} en {{calle}}. Ubicación: https://maps.google.com/?q={{lat}},{{lng}}. Llegada estimada actualizada: {{eta+desvío}} min." + `POST /rest/v1/alertas` tipo `familiar` |
| 9c | **HTTP: Protocolo de desvío** (crítica y media) | `POST /rest/v1/alertas` tipo `desvio` con calle alterna sugerida; el motor ya rerutea al ver el incidente |
| 10 | **Code: Armar respuesta** | Texto corto para que el copiloto lo diga en voz |
| 11 | **Respond to Webhook** | `{ "ok": true, "incidente_id": ..., "folio": ..., "mensaje_voz": "Listo. Reporté el choque en Av. Tecnológico, carril 2. Avisé a emergencias y a tu contacto. Te llevo por Av. Universidad, tres minutos más." }` |

**Tip de demo:** en n8n, deja el flujo abierto en la laptop con "Executions" visible; al disparar se ven los nodos iluminarse uno por uno. Para que se vea más, puedes activar "Wait 1s" pequeños entre 6, 7 y 9 (solo en demo).

### Prompt de clasificación (nodo 4)
```
Eres el clasificador de incidentes viales de ViveCUU, Chihuahua.
Del texto del conductor extrae y responde SOLO JSON:
{"tipo":"accidente|congestion|cierre|obra|peligro|otro",
 "severidad":1-5,
 "carril":número o null,
 "resumen":"máx. 20 palabras",
 "requiere_911":boolean}
Choque "fuerte", heridos, volcadura o atropellamiento = severidad 5 y requiere_911 true.
"Carril de en medio" en vía de 3 carriles = 2; "izquierdo/rápido" = 1; "derecho/lento" = total.
Texto: {{$json.texto}}
```

### Función SQL de apoyo
```sql
create or replace function semaforo_cercano(lat double precision, lng double precision)
returns table (id bigint, osm_id bigint, distancia_m double precision)
language sql stable as $$
  select id, osm_id, st_distance(geom, st_setsrid(st_makepoint(lng,lat),4326)::geography)
  from infra where tipo = 'semaforo'
  order by geom <-> st_setsrid(st_makepoint(lng,lat),4326)::geography
  limit 1;
$$;
```

---

## F2 — Reporte ciudadano a dependencia

`POST {N8N_URL}/webhook/vivecuu/reporte` (lo llama `/api/reportes/clasificar` después de guardar)
```json
{ "reporte_id": 42, "tipo": "fuga_agua", "severidad": 3, "titulo": "Fuga de agua en banqueta",
  "dependencia": "jmas", "foto_url": "...", "lat": 28.64, "lng": -106.07, "votos": 1 }
```
Nodos: Webhook → Switch por `dependencia` (municipio, transito, jmas, cfe) → Gmail/SMTP al buzón del equipo con asunto "[ViveCUU] Reporte #42 · Fuga de agua · Severidad 3" y la foto → HTTP insert en `alertas` tipo `dependencia` ("Enviado a JMAS") → si `tipo=accidente` y `severidad>=4` → HTTP al webhook F1.

## F3 — Resumen de la ciudad
Schedule Trigger cada 30 min **+** Webhook `vivecuu/resumen` (botón en `/demo`) → HTTP `GET /rest/v1/incidentes?estado=eq.activo` y `GET /rest/v1/reportes?created_at=gte.<hace 2h>` → Anthropic: "Resume en 3 viñetas para ciudadanos de Chihuahua qué está pasando en la ciudad" → insert `alertas` tipo `resumen`.

## F4 — Zonas escolares por horario
Schedule Trigger a las 07:00, 08:30, 12:30 y 14:30 (zona `America/Chihuahua`) → insert `alertas` tipo `zona_escolar` ("Zonas escolares activas: máx. 20 km/h"). La app y el motor calculan si están activas por horario; el flujo solo avisa.

---

## Cómo llaman los demás a n8n

| Quién | A dónde | Cuándo |
|---|---|---|
| `/demo` botón secreto | F1 | Al presionar "Provocar accidente" |
| ElevenLabs tool `reportar_incidente` | F1 | Cuando el conductor reporta por voz |
| Motor de ciudad | F1 | Anomalía de celda (< 5 km/h por 20 s sin incidente conocido) |
| `/api/reportes/clasificar` | F2 (y F1 si es grave) | Después de guardar el reporte |
| `/demo` botón "Resumen" | F3 | Demo |

En la app, un **banner/toast** escucha la tabla `alertas` por Realtime y muestra: "🚨 Enlace 911 (simulado) · Folio CUU-131502", "📲 Avisamos a tu contacto", "↪️ Desvío por Av. Universidad".
