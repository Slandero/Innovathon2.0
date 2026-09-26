# Prompts de investigación — Hackathon 2026

Antes de pegarlos, reemplaza lo que está entre [CORCHETES].
Si todavía no conoces el tema, escribe "abierto / sin tema definido".

- **Perplexity** → usa el Prompt 1 (cita fuentes y encuentra datos recientes).
- **Gemini (Deep Research)** → usa el Prompt 2 (reporte largo y comparativo).
- Cuando ya tengas 2 o 3 ideas finalistas → usa el Prompt 3 en cualquiera de los dos.

---

## Prompt 1 — Perplexity: problemas reales en México con datos y fuentes

```
Actúa como investigador de innovación social y tecnológica en México.

Contexto: voy a participar en un hackathon.
- Tema o reto: [TEMA DEL HACKATHON]
- Duración: [24 / 36 / 48] horas
- Equipo: [N] personas con habilidades en [web, móvil, IA, datos, hardware...]
- Ciudad base: [CIUDAD, ESTADO]

Tarea:
1. Identifica los 10 problemas más urgentes de México relacionados con el tema, cubriendo
   distintas regiones del país (norte, centro, sur, frontera, zonas rurales y urbanas).
2. Para cada problema da: a quién afecta, a cuántas personas (con cifra y año),
   qué estados son los más afectados, y por qué las soluciones actuales no funcionan.
3. Indica qué datos abiertos existen para atacarlo (INEGI, datos.gob.mx, CONAGUA, SESNSP,
   Secretaría de Salud, CONEVAL, APIs estatales o municipales, etc.) con enlace.
4. Menciona startups, apps o proyectos mexicanos que ya intentan resolverlo y qué les falta.

Formato:
- Una tabla resumen: Problema | Afectados | Región | Datos disponibles | Hueco de oportunidad.
- Después, un párrafo corto por problema.
- Usa solo fuentes de 2023 en adelante cuando sea posible y cita cada dato.
- Si un dato no está verificado, dilo explícitamente en lugar de inventarlo.
```

---

## Prompt 2 — Gemini Deep Research: qué hace el mundo (China, Japón, Corea, India y otros)

```
Quiero un reporte de investigación profundo para inspirar un proyecto de hackathon en México.

Contexto:
- Tema o reto: [TEMA DEL HACKATHON]
- Tiempo para construir: [HORAS] horas, equipo de [N] personas
- Stack que dominamos: [p. ej. React, Python, Node, Flutter, Firebase, APIs de IA]
- Lugar donde se implementaría: [CIUDAD / ESTADO], México

Investiga proyectos, startups, políticas públicas y tecnologías de los últimos 5 años
relacionados con el tema en estos países y regiones:
- China (p. ej. ciudades inteligentes, super-apps y mini-programas, comercio rural,
  IA aplicada a servicios públicos)
- Japón (p. ej. Society 5.0, prevención de desastres, envejecimiento, robótica de servicio)
- Corea del Sur (gobierno digital, ciudades inteligentes)
- India (infraestructura pública digital: UPI, ONDC, Aadhaar)
- Singapur, Estonia, Israel
- Latinoamérica y África (Brasil con Pix, Kenia con M-Pesa, Colombia, Chile)
- Cualquier otro país con un caso sobresaliente

Para cada caso incluye:
1. Nombre, país, año y quién lo desarrolló
2. Qué problema resuelve y cómo funciona técnicamente (qué tecnologías usa)
3. Resultados medibles (cifras de impacto)
4. Qué tan adaptable es a México: barreras culturales, legales, de infraestructura o de costo
5. Una versión mínima (MVP) que se podría construir en [HORAS] horas inspirada en ese caso

Al final:
- Una tabla comparativa: Caso | País | Tecnología | Impacto | Adaptabilidad a México (1-5) |
  Factibilidad en hackathon (1-5)
- Un TOP 5 de ideas concretas de proyecto para México, cada una con: nombre tentativo,
  problema, usuario objetivo, funcionalidad principal de la demo, stack sugerido y
  "factor wow" para los jueces.
- Cita todas las fuentes. Si no puedes verificar un dato, márcalo como no verificado.
```

---

## Prompt 3 — Validar las ideas finalistas (Perplexity o Gemini)

```
Tengo estas ideas finalistas para un hackathon en México sobre [TEMA]:

1. [IDEA 1: una línea]
2. [IDEA 2: una línea]
3. [IDEA 3: una línea]

Criterios de evaluación del hackathon: [pega aquí los criterios, p. ej. impacto,
innovación, viabilidad técnica, presentación].

Para cada idea:
- ¿Ya existe algo igual en México o en el mundo? Dame nombres y enlaces.
- ¿Qué la haría diferente o mejor que lo existente?
- Riesgos técnicos para construirla en [HORAS] horas
- Datos o APIs gratuitas que podemos usar desde hoy
- Cómo se vería una demo de 3 minutos que impresione a los jueces
- Calificación del 1 al 10 según los criterios del hackathon, con justificación

Termina recomendando UNA idea y un plan de trabajo por bloques de horas.
```
