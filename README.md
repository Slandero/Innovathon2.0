# 🚦 ViveCUU - Sistema de Movilidad Inteligente (Innovathon)

ViveCUU es una plataforma integral de ciudad inteligente para Chihuahua (CUU) desarrollada durante el Innovathon. La plataforma conecta a los ciudadanos, la infraestructura vial y las dependencias (como el 911) en tiempo real, utilizando automatización avanzada.

## ✨ Características Principales

1. **Mapa en Vivo (Digital Twin):**
   - Visualización en tiempo real del tráfico, semáforos inteligentes, unidades de transporte público y zonas escolares activas.
   - Rutas dinámicas que reaccionan a los incidentes, recalculando el camino de los usuarios al instante.

2. **Copiloto Ciudadano (IA):**
   - Interfaz de asistente virtual que lee las alertas en voz alta usando la *Web Speech API*, para no distraer al conductor.
   - Resúmenes viales generados con IA (Claude) que analizan el estado actual de la ciudad.

3. **Orquestación Automática (n8n + Supabase):**
   - **Flujo F1 (Incidentes):** Cuando ocurre un accidente severo, el sistema avisa automáticamente al 911 (simulado), envía notificaciones por Telegram, cambia los semáforos cercanos a rojo y manda rutas alternativas a los usuarios que van hacia la zona.
   - Sincronización en milisegundos gracias a Supabase Realtime.

4. **El Panel Secreto de Demostración (`/demo`):**
   - Un centro de control integrado para presentaciones (Pitch).
   - Permite lanzar accidentes, bloqueos o iniciar la hora pico desde una tablet/PC, viendo cómo reacciona la app del celular en tiempo real (incluso usando un "Pin" en el mapa para mayor precisión).

## 🛠️ Stack Tecnológico

- **Frontend:** Next.js 14, React, Zustand (estado global), Tailwind CSS.
- **Mapas:** MapLibre/Mapbox, OSRM para rutas, Turf.js para análisis geoespacial.
- **Backend & Base de Datos:** Supabase (PostgreSQL, Realtime, RPCs).
- **Automatización:** n8n (Webhooks y flujos F1, F2, F3).

## 🚀 Cómo correr el proyecto localmente

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   Crea un archivo `.env.local` en la raíz del proyecto y agrega tus credenciales de Supabase y n8n:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   SUPABASE_SERVICE_ROLE_KEY=tu-service-key
   N8N_WEBHOOK_BASE=https://tu-n8n.cloud/webhook
   # Opcional (si quieres rutas premium y mejor diseño):
   # NEXT_PUBLIC_MAPBOX_TOKEN=pk.tu-token
   ```

3. **Arrancar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

4. **Uso durante el Pitch:**
   - Abre `http://localhost:3001/` en la pantalla principal o celular.
   - Abre `http://localhost:3001/demo` en tu dispositivo de control.
   - Asegúrate de que el panel `/demo` diga **🟢 En vivo**. ¡Inicia una simulación de ruta y presiona "Provocar Accidente" para ver la magia!

## 📌 Notas del MVP
- Si no hay conexión a internet o Supabase, la app cuenta con un **Modo Local** que utiliza `BroadcastChannel` para que la demo funcione a la perfección sin depender de la red.
- Las rutas de transporte y la infraestructura (semáforos, zonas escolares) están empaquetadas en GeoJSONs ligeros precargados para asegurar un inicio ultrarrápido.
