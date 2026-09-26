# Idea: Chihuahua Esponja (nombre tentativo)

> **"Chihuahua se inunda y se seca en el mismo año."**
> Cada verano, el agua de lluvia corre por las calles y los arroyos y se pierde. El resto del año
> falta agua. Chihuahua Esponja convierte cada techo en una pequeña presa: calcula cuánta agua
> puedes captar, te dice cómo limpiarla según el uso que le darás, la mide con un tanque
> inteligente y suma todo en un mapa de la ciudad.

## De dónde viene la idea (para verificar con Perplexity)

| Referencia | País | Qué hace | Qué tomamos |
|------------|------|----------|-------------|
| **Ciudades esponja (海绵城市)** | China, desde 2015 | Programa nacional de parques inundables, pavimento permeable y techos verdes para absorber la lluvia en vez de desalojarla | La idea central: retener la lluvia donde cae |
| **Isla Urbana** | México (CDMX) | Miles de sistemas de captación de lluvia instalados en casas y escuelas | Prueba de que en México sí funciona y de cuánto cuesta |
| **ABC Waters / Marina Barrage** | Singapur | La ciudad entera funciona como una cuenca que capta lluvia | Visión a escala de ciudad |
| **Tanques "Rojison" de Sumida** | Japón (Tokio) | Tanques de lluvia comunitarios en las calles para emergencias y riego | Captación de barrio y resiliencia |

## Las 3 capas del producto

### 1. Calculadora "¿Cuánta lluvia cae en mi techo?" (Software + IA)
- El usuario **dibuja su techo sobre el mapa satelital**. Leaflet calcula el área en m².
- La app trae la lluvia histórica de su coordenada desde Open-Meteo.
- Fórmula: `litros/año = área m² × lluvia anual mm × coeficiente de escurrimiento (≈0.85)`
  - Ejemplo aproximado: techo de 100 m² × ~420 mm × 0.85 ≈ **35,000 L al año**. Hay que verificar la lluvia real de cada zona.
- La **IA arma un plan personalizado**: tamaño del tanque, filtros, costo aproximado, ahorro
  frente al recibo de la JMAS y cuántos meses de riego o de WC cubre.

### 2. Tanque inteligente (IoT + Automatización)
ESP32 simulado en Wokwi → [`src/iot-tanque-wokwi/`](../src/iot-tanque-wokwi/)
- **Nivel** del tanque con un sensor ultrasónico.
- **Turbidez** del agua. Si está sucia, la **válvula de desvío** (primer lavado) la manda al jardín
  o a un pozo de absorción en vez de al tanque.
- **Automatización con el clima:** si Open-Meteo pronostica lluvia fuerte y el tanque está lleno,
  avisa: *"Usa 1,500 L en riego hoy, mañana llueven 25 mm y se desbordaría"*.
- Alertas por Telegram.

### 3. Mapa "Chihuahua Esponja" (Nuevas tecnologías + impacto)
- Suma todos los techos registrados: **litros captados** y **litros que dejaron de ir a la calle**.
- Encima, una capa de zonas de inundación del Atlas de Riesgos municipal, para mostrar dónde
  captar ayuda más.
- Simulador de impacto: *"Si el 10% de los techos de la colonia X captaran, se evitarían N
  millones de litros de escurrimiento en el arroyo"*.

## Purificación: niveles según el uso

**Ser honestos con los jueces suma puntos:** el agua de lluvia **no es potable** si no recibe
tratamiento certificado y análisis de laboratorio (NOM-127-SSA1). La app recomienda el tratamiento
según el uso:

| Uso | Tratamiento mínimo recomendado | Costo aprox. |
|-----|-------------------------------|--------------|
| Riego, lavar patio | Separador de primeras lluvias + malla | Bajo |
| WC, lavadora | + filtro de sedimentos + cloro | Medio |
| Beber / cocinar | + filtro de carbón activado + lámpara UV + **análisis de laboratorio** | Alto |

## Cómo cubre los 5 ejes

| Eje | Parte del proyecto |
|-----|---------------------|
| **IA aplicada** | Plan personalizado de captación y purificación, y mensajes en lenguaje simple |
| **Automatización** | Desvío automático del agua turbia y aviso de vaciado cuando se pronostica lluvia |
| **Software** | Calculadora web con mapa y tablero de la ciudad |
| **IoT** | Tanque inteligente (ESP32 en Wokwi: nivel, turbidez, válvula) |
| **Nuevas tecnologías** | Datos satelitales y climáticos, serverless y concepto de ciudad esponja |

## Demo en 3 minutos

1. **(30 s) El problema:** fotos de calles inundadas en Chihuahua en verano junto a noticias de la sequía.
2. **(45 s) Calculadora:** un juez da su colonia, dibujamos su techo en vivo y aparece: *"Tu techo
   capta 35,000 L al año"*, con el plan de la IA.
3. **(45 s) Tanque:** en Wokwi subimos el nivel y ensuciamos el agua. Se prende el LED rojo del
   desvío, el tablero cambia y llega una alerta al teléfono.
4. **(30 s) Mapa de la ciudad:** el contador de litros captados se mueve con el simulador de impacto.
5. **(30 s) Cierre:** siguiente paso con escuelas y la JMAS, y el modelo de negocio (instaladores
   locales y tanques).

## Plan de 12 horas (3 personas)

| Horas | A: frontend (React) | B: backend + IA | C: IoT + datos |
|-------|---------------------|------------------|----------------|
| 0–1 | Todos: modelo de datos, proyecto Firebase y reparto de tareas | | |
| 1–4 | Mapa satelital + dibujo del techo + cálculo del área | Open-Meteo (lluvia histórica y pronóstico) + fórmula | Wokwi funcionando + Function `lecturaTanque` |
| 4–7 | Pantalla de resultados + plan de la IA | Prompt del plan personalizado + reglas de purificación | Automatización: pronóstico → alerta Telegram |
| 7–9 | Tablero de la ciudad (contador + mapa) | Simulador de impacto por colonia | Datos semilla: 50 techos falsos en varias colonias |
| 9–11 | Integración y ensayo de la demo completa | | |
| 11–12 | Pitch, capturas, README. **Congelar el código** | | |

**Si falta tiempo, se recorta en este orden:** el simulador de impacto, luego la capa del Atlas de
Riesgos y al final Telegram. La calculadora y el tanque en Wokwi no se recortan.

## APIs y datos (gratis)

- **Open-Meteo:** lluvia histórica (`archive-api.open-meteo.com`) y pronóstico, sin API key.
- **Leaflet + Leaflet.draw** (o Leaflet-Geoman) para dibujar el techo, y **Turf.js** para calcular el área.
- **Imagen satelital:** capa de Esri World Imagery (gratis para demos).
- **Atlas de Riesgos del municipio de Chihuahua:** zonas inundables (buscar si publican shapefile o KML).
- **Tarifas de la JMAS Chihuahua**, para calcular el ahorro en pesos.
- **Gemini API / OpenAI** para el plan personalizado.

## Prompt para Perplexity: verificar los datos del pitch

```
Necesito datos verificados (con fuente y año, 2020–2026) para un proyecto de captación de agua
de lluvia en la ciudad de Chihuahua, México:

1. Precipitación media anual de la ciudad de Chihuahua y en qué meses se concentra.
2. Inundaciones recientes en la ciudad de Chihuahua (fechas, colonias, arroyos afectados).
3. Situación de abasto: tandeos, niveles de presas y acuíferos que abastecen a la ciudad.
4. Tarifa de agua doméstica de la JMAS Chihuahua por m³.
5. Programa de ciudades esponja de China: año de inicio, meta, cuántas ciudades y resultados medidos.
6. Isla Urbana (México): cuántos sistemas instaló, costo típico por casa y litros captados.
7. Norma mexicana para agua potable (NOM-127-SSA1) y qué tratamiento necesita el agua de lluvia para beberse.
8. ¿Existe en Chihuahua algún programa de gobierno o de la JMAS para captar agua de lluvia?

Formato: tabla Dato | Cifra | Fuente (enlace). Si algo no está verificado, dilo.
```
