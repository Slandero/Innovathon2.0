# ViveCUU · MVP en 10 minutos (app + Supabase + n8n)

La app funciona sola (modo local), pero con estos pasos queda **conectada de verdad**: el botón secreto y el
copiloto disparan el flujo de n8n, n8n escribe en Supabase y todos los celulares lo ven en vivo.

```
App (copiloto / /demo) ──POST──▶ n8n  F1 Incidente ──▶ Supabase (incidentes, semáforo, alertas)
        ▲                                                         │
        └──────────────── Realtime (mapa, avisos, desvío) ◀────────┘
```

## 1. Supabase (proyecto `eiuopzfesxhbokirlpyp`)
1. SQL Editor → pega y ejecuta **`supabase/schema.sql`** completo.
   - Borra y recrea las tablas (el esquema anterior del equipo queda reemplazado por uno compatible con ambos).
2. SQL Editor → pega y ejecuta **`supabase/seed_infra.sql`** (1,466 puntos reales: 587 semáforos, altos, escuelas…).
3. Project Settings → API → copia `anon` y `service_role`.

## 2. n8n
1. Importa **`n8n/F1-incidente-vivecuu.json`** (Workflows → Import from file).
2. En los nodos "Supabase: …" elige tu credencial *Supabase account* (usa la **service_role**).
3. **Activa** el flujo (switch arriba a la derecha). La URL de producción queda así:
   `https://<tu-n8n>/webhook/vivecuu/incidente`
4. Opcional: después de "Supabase: Aviso Familiar" agrega un nodo **Telegram** para que suene el celular en el demo.

## 3. App (`.env.local`, junto a `package.json`)
```
NEXT_PUBLIC_SUPABASE_URL=https://eiuopzfesxhbokirlpyp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
N8N_WEBHOOK_BASE=https://<tu-n8n>/webhook
# opcionales
ANTHROPIC_API_KEY=<llave de Claude>        # IA real en reportes, asistente y resumen
NEXT_PUBLIC_MAPBOX_TOKEN=<pk....>          # mapa navigation-day y tráfico real
```
Luego `npm run dev` y abre `http://localhost:3000` (app) y `http://localhost:3000/demo` (botón secreto).

## 4. Probar el flujo completo
1. En `/demo` → **Provocar accidente** (Av. Tecnológico, carril 2).
2. En n8n (Executions) se ven los nodos: normalizar → clasificar → incidente → semáforo a rojo → 911 → familiar → desvío → respuesta.
3. En la app: rombo rojo en el mapa, fila de autos, semáforo en rojo y 3 avisos (911 simulado, contacto, desvío).
4. Copiloto (micrófono) → "hay un choque fuerte en Av. Universidad" → mismo flujo, y responde en voz con el mensaje de n8n.

Prueba rápida del webhook sin la app:
```bash
curl -X POST "$N8N_WEBHOOK_BASE/vivecuu/incidente" -H "Content-Type: application/json" \
  -d '{"origen":"voz","texto":"choque fuerte carril de en medio","calle":"Av. Tecnológico","lat":28.68964,"lng":-106.11187,"alterna":"Av. Universidad"}'
```

## Si algo falla
| Síntoma | Causa probable |
|---|---|
| La app dice "Modo local" en /demo | Faltan `NEXT_PUBLIC_SUPABASE_*` en `.env.local` (reinicia `npm run dev`) |
| El incidente no llega a n8n | El flujo no está **activo** o `N8N_WEBHOOK_BASE` no termina en `/webhook` |
| n8n truena en "Semáforo a Rojo" | No corriste `seed_infra.sql` (no hay semáforos para elegir) |
| n8n responde pero el mapa no cambia | Realtime: vuelve a correr el bloque final de `schema.sql` |
| n8n no contesta en 20 s | La app lo hace directo (mismo resultado) y lo avisa en la consola del servidor |

Regenerar archivos: `node scripts/generar-seed-sql.mjs` · `node scripts/generar-flujo-n8n.mjs "<flujo exportado>.json"`.
