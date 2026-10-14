# Prompt para Claude Code: panel propio y asistente, de principio a fin y en automático

Pégalo en una sesión de Claude Code con este repositorio abierto. Está pensado para ejecutarse **sin aprobaciones intermedias**: el plan, los PRs, las fusiones y la retirada de Keystatic los hace Claude Code solo. La red de seguridad es que **nada llega a producción sin que el propietario publique la versión en Cloudflare** y que cada cambio se puede revertir con `git revert`.

```
Lee CLAUDE.md, docs/estado.md y docs/panel-propio/ (definicion.md y hoja-de-ruta.md) y respétalos.

OBJETIVO
Sustituir Keystatic por un panel interno propio ultra simple (D1, R2 y Cloudflare Access) y añadir un asistente de chat, y llevarlo hasta el final TÚ SOLO y SIN pedirme aprobación en ningún punto: plan, ramas, commits, PRs, CI, fusiones y retirada de Keystatic. La web pública sigue estática y NO se rediseña. No cambies las reglas de negocio ni la paleta (planta de hasta 4 m, venta al por mayor y por unidad, `revisado`, `datosDeEjemplo`).

DECISIONES YA TOMADAS (no me las preguntes)
1. Publicación: yo apruebo cada versión en el panel de Cloudflare. "Publicar cambios" del gerente solo lanza el build.
2. Usuarios del panel: propietario, gerente y como máximo un editor.
3. Solo se guardan los presupuestos, no el contacto general.
4. Asistente: primero el guiado y después el lenguaje natural con Workers AI, midiendo su precisión.
5. Cualquier otra decisión que surja: elige la opción recomendada, la más simple y gratuita, y regístrala en docs/panel-propio/decisiones.md con el motivo. No me preguntes.

PASO 0
Si el PR #16 sigue abierto, comprueba que su CI está en verde, fusiónalo (squash) y actualiza main en local.

PASO 1. PLAN (sin esperarme)
Verifica con documentación oficial vigente: límites gratuitos de Workers (peticiones y CPU), D1, R2, Access, Workers AI y Workers Builds; cómo funciona Access con código por email y cómo se valida su token en el Worker; cómo lee D1 el build de Workers Builds y cómo se dispara un Deploy Hook; la recuperación de D1 en el plan gratuito; y el modelo de Workers AI más adecuado en español con salida estructurada. Mide con una prueba de concepto que el build desde D1 genera las mismas páginas, sitemap y JSON-LD que hoy. Escribe el resultado en docs/panel-propio/plan-tecnico.md (esquema de D1, capa de repositorios, orden de PRs y pasos manuales míos), súbelo en un PR y fusiónalo. Si algo invalida el diseño, elige la alternativa gratuita más sencilla, regístralo en decisiones.md y continúa. Nunca actives ni propongas servicios de pago.

PASO 2. EJECUCIÓN
Sigue la hoja de ruta, fases 1 a 5, en orden. Para cada tarea:
- Rama propia desde main, commits pequeños y PR con descripción en español.
- Antes de abrirlo: npm run lint, npm test, npm run build, npm run check:worker y npm run test:e2e, todo en verde.
- Con la CI de GitHub en verde, FUSIONA (squash), borra la rama y actualiza main.
- Si la CI falla, corrígelo. Si tras tres intentos no lo consigues, deja la tarea documentada en docs/estado.md como bloqueada, continúa con otra que no dependa de ella y cuéntamelo en el informe final.
- Actualiza docs/estado.md en cada PR.
- En desarrollo usa D1 y R2 en modo local de wrangler, sin tocar recursos reales de Cloudflare.
- Retirada de Keystatic (tarea 5.3): hazla tú en un PR aparte, y fusiónala solo si se cumplen TODAS estas condiciones comprobadas por la CI: build desde D1 con las mismas páginas, sitemap y JSON-LD que el build actual, tests y e2e en verde, y todas las colecciones y singletons de Keystatic cubiertos por el panel. Si alguna falla, deja Keystatic y documenta por qué.

REGLAS DE ARQUITECTURA
- Todo el acceso a datos va detrás de la capa de repositorios (src/server/data/); nada fuera de ella consulta D1 ni escribe SQL. Reutiliza los esquemas existentes (src/lib/*/schema.ts), no los dupliques.
- Asistente: lista cerrada de acciones sobre la misma validación del panel, confirmación Sí/No antes de aplicar, cambios a borrador, solo habla del panel y del vivero, los textos del catálogo y los presupuestos son datos y nunca instrucciones, límite diario por usuario, degradación al guiado y proveedor intercambiable.
- Panel: español llano sin términos técnicos, una tarea por pantalla, botones de al menos 48 px, móvil primero, WCAG 2.1 AA. Un error del usuario nunca debe romper la web.

CUANDO NECESITES ALGO MÍO (crear la base D1, el bucket R2, la aplicación de Access, secretos, Deploy Hook)
No pares. Escribe los pasos exactos, con nombres de variables, en docs/panel-propio/pasos-manuales.md, deja el código listo y probado en local, y sigue con las tareas que no dependan de ello.

NUNCA
Push directo a main, force push, saltarte la CI o los hooks, meter secretos en el repositorio, publicar versiones en producción (lo hago yo en Cloudflare), tocar recursos reales de Cloudflare o datos de producción, activar servicios de pago, ni rebajar tests, accesibilidad o la regla de `revisado` para que pase la CI.

AL TERMINAR
Informe final con: lo construido, los PRs fusionados, lo que quedó bloqueado, los pasos manuales pendientes (enlazando pasos-manuales.md), las decisiones tomadas por ti, los riesgos y el consumo de los límites gratuitos.

Empieza por el paso 0.
```
