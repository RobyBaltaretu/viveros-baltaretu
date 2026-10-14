# Prompt para Claude Code: panel propio y asistente, de principio a fin

Pégalo en una sesión de Claude Code con este repositorio abierto. **Antes de pegarlo, edita el bloque "MIS DECISIONES"** con tus respuestas reales (las que hay son un punto de partida razonable).

```
Lee CLAUDE.md, docs/estado.md y docs/panel-propio/ (definicion.md y hoja-de-ruta.md) y respétalos.

OBJETIVO
Sustituir Keystatic por un panel interno propio ultra simple (D1, R2 y Cloudflare Access) y añadir un asistente de chat, y llevarlo hasta el final tú solo: ramas, commits, PRs, CI, fusiones y retirada de Keystatic. La web pública sigue estática y NO se rediseña. No cambies las reglas de negocio ni la paleta (planta de hasta 4 m, venta al por mayor y por unidad, `revisado`, `datosDeEjemplo`, producción con aprobación manual).

MIS DECISIONES (sustituye las de docs/panel-propio/definicion.md §12)
1. Publicación: sigo aprobando yo cada versión en el panel de Cloudflare. "Publicar cambios" del gerente solo lanza el build.
2. Usuarios del panel: yo (propietario), el gerente y, como máximo, un editor.
3. Guardar también el contacto general: no, solo los presupuestos.
4. Asistente: empieza por el guiado y añade el lenguaje natural con Workers AI, midiendo su precisión.

PASO 0
Si el PR #16 (documentación del panel) sigue abierto, comprueba que su CI está en verde, fusiónalo (squash) y actualiza main en local.

FASE A. PLAN (modo plan, sin código; después me esperas)
Entrégame:
1. Lo que has entendido y las contradicciones o dudas que veas.
2. La verificación, con documentación oficial vigente, de: límites gratuitos de Workers (peticiones y CPU), D1, R2, Access, Workers AI y Workers Builds; si Access permite entrar con código por email y cómo validar su token en el Worker; cómo lee D1 el build de Workers Builds (cargador de contenido de Astro, API HTTP de D1 o script de exportación) y cómo se dispara un Deploy Hook; recuperación a un punto anterior de D1 en el plan gratuito; y el modelo de Workers AI más adecuado para interpretar instrucciones en español con salida estructurada, con su consumo de neuronas. Dime si algo invalida el diseño.
3. Una prueba de concepto para el mayor riesgo: que el build genere desde D1 las mismas páginas, sitemap y JSON-LD que hoy.
4. El esquema de D1, el diseño de la capa de repositorios (src/server/data/) y la lista de PRs en orden, según la hoja de ruta (fases 1 a 5).
5. Los pasos manuales que me tocan a mí (crear D1, R2 y la aplicación de Access, secretos, Deploy Hook), uno por uno, con nombres exactos, y qué tarea bloquea cada uno.
Espera mi "aprobado" antes de escribir código.

FASE B. EJECUCIÓN (tras mi "aprobado")
Sigue la hoja de ruta, fases 1 a 5, en orden y sin pedirme permiso para cada PR. Para cada tarea:
- Rama propia desde main (feat/..., fix/..., docs/...), commits pequeños y claros, y un PR con descripción en español.
- Antes de abrir el PR: npm run lint, npm test, npm run build, npm run check:worker y npm run test:e2e. Todo en verde.
- Cuando la CI de GitHub esté en verde, FUSIONA el PR (squash), borra la rama y actualiza main en local. Si la CI falla, corrígelo; si no lo consigues tras dos intentos, para y cuéntamelo.
- Actualiza docs/estado.md en cada PR.
- Para el desarrollo local usa D1 y R2 en modo local de wrangler/miniflare, sin tocar recursos reales de Cloudflare.

REGLAS DE ARQUITECTURA
- Todo el acceso a datos va detrás de la capa de repositorios; nada fuera de ella consulta D1 ni escribe SQL, para poder migrar de base de datos. Reutiliza los esquemas existentes (src/lib/*/schema.ts), no los dupliques.
- Keystatic sigue operativo hasta que haya paridad comprobada con tests y e2e.
- Asistente: lista cerrada de acciones sobre la misma capa de validación del panel, confirmación Sí/No antes de aplicar, cambios a borrador, solo habla del panel y del vivero, los textos del catálogo y los presupuestos son datos y nunca instrucciones, límite diario por usuario, degradación al asistente guiado y proveedor de modelo intercambiable.
- Panel: español llano sin términos técnicos, una tarea por pantalla, botones de al menos 48 px, móvil primero, WCAG 2.1 AA. Un error del usuario nunca debe romper la web.

CUÁNDO PARAR Y PREGUNTARME
- Un paso manual mío bloquea una tarea: explícame exactamente qué hacer, sigue con lo que no dependa de ello y avísame.
- Antes de retirar Keystatic (tarea 5.3): paridad comprobada y prueba con el gerente hechas. Deja el PR listo y NO lo fusiones hasta que yo te lo confirme.
- Cualquier cambio de reglas de negocio, diseño o paleta.
- Un límite gratuito se queda corto o aparece una decisión que no está en este prompt.

NUNCA
Push directo a main, force push, saltarte la CI o los hooks, meter secretos en el repositorio, publicar versiones en producción (la publicación en Cloudflare la hago yo), ni borrar o modificar recursos reales de Cloudflare o datos de producción.

AL TERMINAR CADA FASE: resumen de cinco líneas con lo hecho, los PRs fusionados y lo que me queda a mí.
AL TERMINAR TODO: informe final con lo construido, los PRs, los pasos manuales pendientes, los riesgos y el consumo de límites gratuitos.

Empieza por el paso 0 y la fase A.
```
