# Prompt para Claude Code: panel propio y asistente

Pégalo en una sesión de Claude Code con este repositorio abierto.

```
Lee CLAUDE.md, docs/estado.md y docs/panel-propio/ (definicion.md y hoja-de-ruta.md), y respétalos. Vamos a sustituir el panel Keystatic por un panel propio ultra simple y a añadir un asistente de chat, SIN rediseñar la web ni cambiar las reglas de negocio actuales (paleta aceptada, planta de hasta 4 m, venta al por mayor y por unidad, `revisado`, producción con aprobación manual).

Empieza en MODO PLAN. No escribas código todavía. Entrégame:
1. Lo que has entendido y las contradicciones o dudas que veas.
2. La verificación, con documentación oficial vigente, de: límites gratuitos de Workers (peticiones y CPU), D1, R2, Access y Workers AI; si Access permite entrar con código por email y cómo validar su token en el Worker; cómo puede el build de Workers Builds leer D1 (cargador de contenido de Astro, API HTTP de D1 o script de exportación) y cómo se dispara un Deploy Hook; recuperación a un punto anterior de D1 en el plan gratuito; y qué modelo de Workers AI conviene para interpretar instrucciones en español con salida estructurada, con su consumo de neuronas.
3. Una prueba de concepto propuesta para el mayor riesgo: que el build genere desde D1 las mismas páginas que hoy.
4. El esquema de D1, el diseño de la capa de repositorios en src/server/data/ y el orden de PRs según docs/panel-propio/hoja-de-ruta.md.
5. Los pasos manuales que me tocan a mí (D1, R2, Access, secretos, Deploy Hook), uno por uno y con los nombres exactos.

Reglas de arquitectura: la web pública sigue estática. Todo el acceso a datos va detrás de una capa de repositorios; nada fuera de ella consulta D1 ni escribe SQL, para poder migrar de base de datos. Reutiliza los esquemas existentes (src/lib/*/schema.ts) y no los dupliques. Keystatic sigue operativo hasta que haya paridad comprobada con tests y e2e, y se retira en un PR aparte.

Reglas de trabajo: una rama y un PR por tarea, lint, tests, build y e2e antes de cada PR, sin push a main, actualiza docs/estado.md al cerrar cada PR. Si algo te bloquea o necesitas una decisión, pregúntame en vez de suponerlo.

Empieza con el plan.
```
