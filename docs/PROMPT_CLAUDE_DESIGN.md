# Prompt para Claude Design — ViveCUU

Pega este prompt en Claude Design y adjunta `VIVECUU_MASTER.md`, `diagramas/05_pantallas.mermaid` y `diagramas/08_vista_principal.mermaid`.

**Orden:** primero pide SOLO la vista principal (bloque A). Cuando esté bien, pide el resto (bloque B).

## Bloque A — Vista principal (hazlo primero)

```
Diseña la vista principal de ViveCUU, app tipo Google Maps / Waze para Chihuahua, México.
Lee la sección 0 y 18 del documento adjunto. Mobile 390 x 844, estilo claro, tipografía Inter,
tokens de la sección 7 (brand naranja #F26B1D, primario azul #1A73E8, SOS #E5252A).

Frames:
1. Splash con logo "Vive" gris carbón + "CUU" naranja.
2. Home recién abierta: mapa a pantalla completa centrado en el usuario (punto azul con halo y
   cono de dirección), barra flotante "¿A dónde vas?" con micrófono y avatar, chips de capas
   (Tráfico, Camiones, Semáforos, Altos y topes, Escuelas, Reportes), pill "● En vivo · 148
   vehículos · 23 °C", botones centrar, Reportar naranja y SOS rojo, barra inferior Mapa ·
   Camiones · Qué pasa · Asistente. En el mapa: calles principales con color de tráfico, puntitos
   de autos, semáforos con su luz (verde, ámbar, rojo), octágonos de ALTO, triángulos de tope,
   una zona escolar morada translúcida.
3. Búsqueda a pantalla completa: recientes, accesos rápidos (Casa, Tec II, Centro), resultados.
4. Tarjeta de lugar elegido: nombre, dirección, "🚗 12 min · 🚌 25 min", botón azul "Cómo llegar".
5. Ruta trazada: línea azul y alternativa gris, tarjeta "14 min · 5.2 km · llegas 12:48" con
   chips de alertas "6 semáforos · 3 topes · 2 altos · zona escolar activa", botones "Iniciar" y
   "Simular viaje".
6. Navegación: vista inclinada, banner verde arriba "En 300 m gira a la derecha · Av. Universidad",
   aviso "Semáforo en rojo a 150 m", barra inferior con ETA, hora y distancia.
7. Copiloto de voz abierto: hoja inferior con ondas animadas, subtítulo "Hay un choque fuerte en
   Av. Tecnológico…" y respuesta "Listo, avisé a emergencias y te llevo por Av. Universidad".
8. Toast de alertas de n8n sobre el mapa: "🚨 Enlace 911 (simulado) · Folio CUU-131502",
   "📲 Avisamos a tu contacto", "↪️ Te cambié de ruta, +3 min".
```

## Bloque B — Resto de pantallas

---

```
Diseña la app móvil ViveCUU: "Chihuahua en vivo, en una sola app".
Es una PWA para ciudadanos de Chihuahua, México. Lee el documento maestro adjunto (secciones 6 y 7) antes de empezar.

FORMATO
- Mobile-first, frame de 390 x 844.
- Estilo claro tipo Google Maps / Waze: fondo blanco, mapa claro protagonista, tarjetas flotantes con sombra suave, bottom sheets redondeados, pills.
- Tipografía Inter. Radio 16 px en tarjetas, 999 px en pills.
- Todo el texto en español mexicano, cercano y directo ("Viene 72% lleno", "Aguas: zona escolar activa").

MARCA
- Logotipo: "Vive" en gris carbón #1F2328 + "CUU" en naranja cantera #F26B1D, bold redondeada.
- Colores: brand #F26B1D, primario #1A73E8, SOS #E5252A, tráfico fluido #34A853, moderado #FBBC04, pesado #F57C00, detenido #C5221F, zona escolar #8E44AD, superficie #F6F7F9, texto secundario #5F6B7A.

PANTALLAS (una por frame)
P1 Mapa vivo (home):
  - Barra de búsqueda arriba "¿A dónde vas?" con avatar.
  - Fila de chips de capas con scroll horizontal: Tráfico, Camiones, Reportes, Escuelas, Topes, Semáforos.
  - Mapa de Chihuahua con calles principales coloreadas por tráfico, puntitos de autos, 3 camiones (cápsula con color de ruta y anillo de ocupación), semáforos, un tope, una zona escolar morada translúcida, un accidente (rombo rojo).
  - Pill flotante "● En vivo · 412 vehículos".
  - Botón flotante grande naranja "Reportar" y botón circular rojo "SOS".
  - Barra inferior: Mapa · Qué pasa · Asistente · Reportar.
P2 Hoja de camión (bottom sheet sobre el mapa):
  - "Ruta 2 · Centro – Tec", barra de ocupación 72% en ámbar, "Viene casi lleno", próxima parada, "Llega en 4 min", etiqueta "Dato de sensor · hace 2 s", mini línea de paradas.
P3 Hoja de incidente:
  - "Choque · Periférico de la Juventud", severidad, dibujo de 3 carriles vistos desde arriba con el carril 2 bloqueado en rojo, "+12 min de retraso", "Atiende: Tránsito", botones "Sigue ahí (15)" y "Ya no está".
P4 Reportar (5 frames):
  4.1 Cámara con guía "Toma la foto del problema".
  4.2 Mapa con pin arrastrable "Confirma dónde está".
  4.3 Nota opcional con chips sugeridos (Bache, Semáforo, Fuga de agua, Obra).
  4.4 Estado de carga "La IA está revisando tu reporte…" con animación sutil.
  4.5 Resultado: tarjeta con foto, título generado, tipo, severidad 4/5 en barras, "Le toca a: Municipio", "Ya lo ven 1,200 personas cerca", botón "Ver en el mapa".
  Variante 4.5b: "Ya lo habían reportado · sumaste tu voto (16)".
P5 SOS (2 frames):
  5.1 Selección: Ambulancia (destacada), Bomberos, Policía; aviso "Si es grave llama al 911" con botón para llamar.
  5.2 Seguimiento: mapa con ruta roja desde el hospital, ícono de ambulancia con halo pulsante, ETA grande "6 min", "Semáforos en verde en su camino: 7", tarjeta del hospital.
P6 Asistente:
  - Chat con burbujas, sugerencias rápidas ("¿Cómo está el tráfico?", "¿Qué camión me lleva al Centro?", "¿Hay baches en mi ruta?"), una respuesta ejemplo con mini-tarjeta de ruta y nivel de tráfico.
CAMIONES (pestaña):
  - Buscador "¿A dónde quieres ir en camión?", tarjeta "Tu parada más cercana · Av. Universidad y
    Pacheco · 250 m · Ruta 2 llega en 4 min · 72% lleno", lista de rutas con color, unidades
    activas y barra de ocupación. Frame 2: ruta seleccionada en el mapa con paradas y unidades.
P7 Qué pasa en CUU:
  - Feed cronológico con tarjetas: accidente, cierre programado por obra, reporte nuevo, pronóstico "En 30 min se pone pesado Av. Universidad", botón "Resumen de las últimas 2 horas".
P8 Ruta A→B:
  - Origen/destino, dos opciones (carro y camión) con tiempo, alertas en el camino (tope, zona escolar activa, accidente), botón "Iniciar".
DEMO /demo (tablet 1024 x 768, estilo simple):
  - Botones grandes: Provocar accidente (select de calle y carril), Cerrar vía, Hora pico on/off, Velocidad x1 / x5, Lanzar SOS de prueba, Limpiar.

COMPONENTES A DOCUMENTAR
Chips de capas, bottom sheet, tarjeta de evento, barra de ocupación, dibujo de carriles, marcadores del mapa (semáforo en 3 estados, tope, bache, cruce, escuela, hospital, camión, accidente, obra, ambulancia), botón SOS, botón Reportar, barra de navegación.

ENTREGA
- Sistema de diseño con tokens en CSS variables y en Tailwind config.
- Todas las pantallas listas para pasar a Claude Code (Next.js + Tailwind + MapLibre).
```

---

## Iteraciones sugeridas (una por una)
1. "Haz el mapa más vivo: más autos, calles principales más gruesas con color de tráfico."
2. "Haz más obvio el dibujo de carriles en la hoja de incidente."
3. "Versión en modo oscuro solo del P1 para el slide de visión." (opcional)
4. "Exporta tokens y componentes para Claude Code."
