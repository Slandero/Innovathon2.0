# ViveCUU — Copiloto de Voz (ElevenLabs)

Agente conversacional manos libres para el conductor. Se crea en el panel de **ElevenLabs Agents (Conversational AI)** y se incrusta en la app con el SDK de React. Verifiquen nombres exactos de campos y del paquete en la documentación de ElevenLabs, porque cambian seguido.

## 1. Configuración del agente

| Campo | Valor |
|---|---|
| Nombre | ViveCUU Copiloto |
| Idioma | Español |
| Voz | Una voz en español latino/mexicano, cálida y clara |
| LLM | El que permita su plan (uno rápido; la latencia importa más que la inteligencia) |
| Acceso | Público para el demo (así el front solo necesita el `agentId`) |

**Primer mensaje:**
> ¿Qué onda? Soy tu copiloto de ViveCUU. Dime a dónde vas o avísame lo que veas en el camino.

**System prompt:**
```
Eres el Copiloto de ViveCUU, el asistente de voz para manejar en Chihuahua, México.
La persona va manejando: contesta en máximo 2 oraciones, claro y en español mexicano.
Nunca le pidas que mire la pantalla ni que escriba.

Puedes:
- Llevarla a un lugar: usa la herramienta llevar_a con el destino que diga.
- Decirle cómo está el tráfico en una calle o zona: usa consultar_trafico.
- Decirle qué camión le sirve y qué tan lleno viene: usa buscar_camion.
- Reportar incidentes (choques, congestión fuerte, obras, peligros): usa reportar_incidente.
  Antes de llamarla, confirma solo si falta la calle. Si dice "fuerte", "hay heridos" o
  "volcado", trátalo como grave. Después de reportar, lee en voz el campo mensaje_voz
  que te regresa la herramienta.

Ubicación actual del usuario: {{lat}}, {{lng}}. Calle aproximada: {{calle_actual}}.
Ruta actual (si hay): {{destino_actual}}, llegada estimada {{eta_min}} min.

Aclara que la alerta a emergencias es del sistema de ViveCUU; si alguien está en peligro,
recomienda también marcar al 911 cuando sea seguro hacerlo.
No inventes datos de tráfico ni de camiones: usa solo lo que regresan las herramientas.
```
Las `{{variables}}` son **variables dinámicas** que la app manda al iniciar la sesión.

## 2. Herramientas

### `reportar_incidente` — Webhook (servidor) → n8n F1
- Método: `POST`
- URL: `{N8N_URL}/webhook/vivecuu/incidente`
- Descripción para el agente: "Reporta un incidente vial que el conductor acaba de ver: choque, congestión fuerte, obra o peligro. Dispara alertas y desvíos."
- Parámetros (body):
  | Nombre | Tipo | Requerido | Descripción |
  |---|---|---|---|
  | `texto` | string | sí | Lo que dijo el conductor, literal |
  | `tipo` | string | sí | accidente, congestion, cierre, obra, peligro, otro |
  | `calle` | string | no | Calle o avenida mencionada |
  | `carril` | integer | no | 1 = izquierdo, 2 = en medio, 3 = derecho |
  | `origen` | string | sí | Siempre "voz" |
  | `lat` | number | no | Usar {{lat}} si no dijo otra ubicación |
  | `lng` | number | no | Usar {{lng}} si no dijo otra ubicación |
- Tiempo de espera: 20 s (n8n responde con `mensaje_voz`).

### `consultar_trafico` — Webhook (servidor) → app
- `GET {APP_URL}/api/ciudad/estado?zona={zona}&lat={lat}&lng={lng}`
- Devuelve: `{ "zona": "Av. Universidad", "nivel": "pesado", "velocidad_kmh": 14, "incidentes": [...], "pronostico_30min": "mejora", "texto": "La Universidad está pesada, 14 km/h, hay un choque en carril 2." }`

### `buscar_camion` — Webhook (servidor) → app
- `GET {APP_URL}/api/camiones/cercanos?destino={destino}&lat={lat}&lng={lng}`
- Devuelve: `{ "texto": "Toma la Ruta 2 en la parada Av. Universidad y Pacheco, a 250 metros. Llega en 4 minutos y viene 72% lleno." , ... }`

### `llevar_a` — Client tool (se ejecuta en la app)
- Parámetro: `destino` (string).
- En la app: busca con Mapbox, traza la ruta, muestra la tarjeta y regresa al agente `"Ruta lista: 14 minutos por Av. Universidad, 6 semáforos, zona escolar activa en el camino."`

## 3. Integración en la app (Next.js)

```bash
npm i @elevenlabs/react
```

```tsx
'use client';
import { useConversation } from '@elevenlabs/react';

export function useCopiloto({ onLlevarA, contexto }: {
  onLlevarA: (destino: string) => Promise<string>;
  contexto: { lat: number; lng: number; calle_actual: string; destino_actual: string; eta_min: number };
}) {
  const conversation = useConversation({
    clientTools: {
      llevar_a: async ({ destino }: { destino: string }) => onLlevarA(destino),
    },
    onError: (e) => console.error('copiloto', e),
  });

  const iniciar = async () => {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    await conversation.startSession({
      agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
      dynamicVariables: {
        lat: contexto.lat, lng: contexto.lng,
        calle_actual: contexto.calle_actual,
        destino_actual: contexto.destino_actual || 'sin ruta',
        eta_min: contexto.eta_min || 0,
      },
    });
  };

  return { iniciar, terminar: () => conversation.endSession(), estado: conversation.status, hablando: conversation.isSpeaking };
}
```

UI: botón de micrófono en la barra de búsqueda → hoja inferior con ondas animadas (escuchando / hablando), subtítulo de lo que dice el copiloto y botón "Terminar".

## 4. Plan B si ElevenLabs falla en el evento
- Botón de micrófono usa **Web Speech API** (`webkitSpeechRecognition`, `lang='es-MX'`) para transcribir → manda el texto directo al webhook F1 → lee `mensaje_voz` con `speechSynthesis`. Menos "wow" pero el flujo de n8n se ve igual.
- Tener un video de 30 s del copiloto funcionando grabado antes del ensayo.

## 5. Frases de prueba
- "Copiloto, llévame al Tecnológico dos."
- "¿Cómo está el tráfico en Periférico de la Juventud?"
- "¿Qué camión me lleva al Centro?"
- "Hay un choque fuerte en Avenida Tecnológico, carril de en medio, avisa a emergencias."
- "Hay mucha congestión en la Universidad, está todo parado."
