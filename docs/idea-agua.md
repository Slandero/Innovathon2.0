# Idea: Pozo Vivo (nombre tentativo)

> Un medidor inteligente para pozos agrícolas que le dice al productor cuándo regar y cuánto,
> para que ahorre dinero, y le avisa a la autoridad cuándo un pozo extrae más de lo concesionado.

## Por qué esta versión y no el "AquaGuard" de Gemini tal cual

El AquaGuard que propone Gemini solo tiene un usuario: el inspector, que vigila a los productores.
En la vida real ningún productor instala un medidor que lo delate. Por eso el proyecto le da
**valor primero al productor**:

| Usuario | Qué gana |
|---------|----------|
| Productor (nogal, alfalfa, algodón) | Recomendación diaria de riego según el clima, así bombea menos y **paga menos luz o diésel** |
| Módulo de riego / JMAS / CONAGUA | Tablero con el consumo real frente a la concesión y alertas de sobreextracción |

Así se juntan los dos casos más fuertes del reporte, Kilimo (riego) y AquaGuard (auditoría),
y el proyecto entra en **3 ejes del hackathon a la vez**: IoT, IA aplicada y automatización.

## Qué se ve en la demo

1. **Mapa (React)** con 10 a 20 pozos del estado. Cada pozo aparece en verde, amarillo o rojo
   según cuánto de su concesión ya consumió.
2. **Simulador (Python)** que manda lecturas de caudal cada pocos segundos. Si tienen un ESP32 y
   un sensor de flujo, es mejor usar un pozo real sobre la mesa.
3. **Recomendación del día con IA**: toma la evapotranspiración (ET0) del clima real, el cultivo y
   lo que ya se regó, y responde en español simple. Ejemplo: *"Hoy no riegues. Mañana 2 horas.
   Ahorras ~$340 de luz"*.
4. **Alerta automática** por Telegram (o WhatsApp) cuando un pozo pasa su límite, con una
   explicación generada por la IA.

**Momento wow:** en vivo, se sube el caudal en el simulador. El pozo se pone rojo en el mapa y
al teléfono del juez llega la alerta.

## Cómo cubre los 5 ejes del hackathon

| Eje | Qué parte del proyecto lo cubre |
|-----|---------------------------------|
| **IoT** | Un ESP32 simulado en **Wokwi** (firmware real que manda datos por WiFi) más pozos virtuales en Python |
| **IA aplicada** | La recomendación diaria de riego y la explicación de las alertas en lenguaje simple (Gemini/OpenAI) |
| **Automatización** | Detección automática de sobreextracción y bombeo nocturno, con alertas por Telegram sin intervención humana |
| **Software** | Plataforma web: mapa en tiempo real, tablero de la autoridad y vista del productor |
| **Nuevas tecnologías** | Serverless (Firebase), datos satelitales y climáticos (ET0) y, opcionalmente, un chat por voz para el productor |

## IoT sin hardware

- **Wokwi** (wokwi.com, gratis, en el navegador) simula un ESP32 con WiFi y corre firmware real.
  Una perilla hace de sensor de flujo: al girarla cambia el caudal y el dato llega a Firebase.
  El código está en [`src/iot-wokwi/`](../src/iot-wokwi/).
- Los otros 10 a 20 pozos del mapa los genera un simulador en Python.
- Si antes del hackathon quieren hardware real: un ESP32 y un sensor de flujo YF-S201 cuestan
  alrededor de $250–350 MXN en Mercado Libre o Steren. El mismo firmware funciona casi sin cambios.

## Datos y APIs reales (gratis)

| Fuente | Para qué | Nota |
|--------|----------|------|
| **Open-Meteo** (`api.open-meteo.com`) | Clima y ET0 (`et0_fao_evapotranspiration`) por coordenada | Sin API key |
| **REPDA – CONAGUA** | Concesiones reales de pozos (volumen autorizado) | Registro público; basta con usar unos cuantos pozos de ejemplo |
| **Disponibilidad de acuíferos (DOF / CONAGUA)** | Déficit del acuífero donde está cada pozo | Para dar contexto en el mapa |
| **Monitor de Sequía (SMN)** | Nivel de sequía del municipio | Opcional |
| **Gemini API / OpenAI** | Redactar la recomendación y la explicación de la alerta | |
| **Bot de Telegram** | Alertas push sin trámites de aprobación | WhatsApp (Twilio) queda como versión de producción |

## Arquitectura

```
[Simulador Python / ESP32] --HTTP--> [Cloud Function: /lectura]
                                           |
                                           v
                                     [Firestore] ---> [React: mapa + tablero]
                                           |
                    [Cloud Function: detectar anomalía + recomendación IA]
                           |                         |
                     [Open-Meteo ET0]          [Bot Telegram]
```

Stack: React + Leaflet (mapa), Firebase (Firestore, Functions, Hosting), Python (simulador),
API de IA. Flutter es opcional: la vista del productor también puede ser una web responsiva en
React, y así hay menos riesgo.

## Plan de 12 horas (3 personas)

| Horas | Persona A: frontend | Persona B: backend/IA | Persona C: datos/IoT |
|-------|---------------------|------------------------|----------------------|
| 0–1 | Todos: definir el modelo de datos en Firestore, crear el proyecto Firebase y repartir tareas | | |
| 1–4 | Mapa con Leaflet y pozos desde Firestore en tiempo real | Function `/lectura` + cálculo de % de concesión | Simulador Python, 15 pozos semilla con datos tipo REPDA |
| 4–7 | Detalle del pozo: gráfica de consumo y recomendación | Integración Open-Meteo y prompt de recomendación | Bot de Telegram + alerta de sobreextracción |
| 7–9 | Vista del productor (móvil) | Detección de anomalías (picos, bombeo nocturno) | ESP32 real si hay hardware; si no, pulir el simulador |
| 9–11 | Integración, pruebas y ensayo de la demo completa | | |
| 11–12 | Pitch, capturas y README. **Congelar el código** | | |

## Pitch en 3 minutos (esqueleto)

1. **Problema (30 s):** el acuífero con déficit, los pozos sin medición y el productor que paga
   la luz sin saber si de verdad necesitaba regar.
2. **Solución (30 s):** Pozo Vivo, que ahorra dinero al productor y da visibilidad a la autoridad.
3. **Demo (90 s):** mapa, recomendación del día, subir el caudal en vivo y alerta al teléfono.
4. **Impacto y siguiente paso (30 s):** litros y pesos ahorrados por pozo, y un piloto con un
   módulo de riego.

## Datos del reporte de Gemini que hay que verificar antes de usarlos en el pitch

- [ ] "~7,000 pozos ilegales en Chihuahua": la fuente es una publicación de Facebook. Buscar nota de CONAGUA o de un periódico.
- [ ] "Déficit de 58 millones de m³ en El Sauz-Encinillas": confirmar en la publicación del DOF sobre disponibilidad.
- [ ] "19 billones de litros" de Kilimo: seguramente es una mala traducción de *19 billion* (19 mil millones). Confirmar.
- [ ] "Consumo de agua +40% por grado centígrado": suena raro. Revisar el artículo de MDPI.
- [ ] Porcentaje del agua de Chihuahua que usa la agricultura (se suele citar cerca del 80–90%). Buscar la cifra oficial.
- [ ] Costo de la luz del bombeo agrícola (tarifa 9-CU / 9-N) para calcular el ahorro en pesos.

### Prompt para Perplexity: verificar los datos

```
Verifica con fuentes oficiales o periodísticas recientes (2023–2026) estos datos sobre el agua
en Chihuahua, México. Para cada uno dime si es correcto, la cifra exacta y el enlace a la fuente:

1. Número estimado de pozos ilegales o no registrados en Chihuahua.
2. Déficit anual del acuífero El Sauz-Encinillas y de los acuíferos del estado más sobreexplotados.
3. Porcentaje del agua del estado que usa la agricultura y cuáles cultivos consumen más (nogal, alfalfa, algodón).
4. Cuánto paga un productor de luz para bombear agua de un pozo agrícola (tarifas CFE 9-CU y 9-N)
   y cuántos kWh cuesta bombear 1,000 m³ a 100 m de profundidad aprox.
5. Cuántos pozos agrícolas en Chihuahua tienen medidor volumétrico funcionando.
6. Cifra real de ahorro de agua reportada por la startup Kilimo.
7. Proyectos o startups mexicanas que ya midan pozos o recomienden riego con IA.

Formato: tabla Dato | ¿Correcto? | Cifra verificada | Fuente. Si no encuentras un dato, dilo.
```
