# Turia Studio — traspaso técnico y matriz de requisitos
Fecha de revisión: 2026-11-05 (sesión de Claude Code; ver «Sesión 2026-11-05» al final)
Repositorio: RobyBaltaretu/viveros-baltaretu
Rama: feature/turia-studio-boceto-multimodal
PR: https://github.com/RobyBaltaretu/viveros-baltaretu/pull/133
IMPORTANTE: no fusionar a main ni desplegar sin autorización. En local, lint, tests, build, check:worker, equivalencia de Baltaretu y los e2e de Baltaretu y Turia pasan (2026-11-05). No hay E2E contra Cloudflare real ni contra Gemini real.

## Objetivo original
En Creaciones Turia, permitir subir foto real del espacio y foto del boceto con cotas; interpretar mediante IA multimodal con validación humana, mostrar alzado 2D, seleccionar material por pieza desde catálogo, generar render fotorrealista conservando el espacio, comparar antes/después, guardar diseños/versiones, obtener despiece y crear presupuesto precargado, integrar en Proyectos/Simulaciones, con coste controlado, privacidad, aislamiento tenant y UX iPhone.

## Matriz de requisitos vs código — estado basado en lectura del código, NO en pruebas de aceptación
| ID | Requisito | Código / evidencia | Estado | Acción de cierre |
|---|---|---|---|---|
| R01 | Cargar foto de espacio y boceto | src/pages/api/panel/studio-archivos.ts; src/pages/panel/studio-bocetos.astro | Implementado sin E2E | Probar JPEG/PNG/WebP, tamaños, EXIF, Safari, R2 y permisos |
| R02 | Privacidad y aislamiento tenant | studio-archivos.ts, studio-bocetos.ts, studio-generar.ts filtran cliente_id | Parcial | Tests de autorización cruzada, lectura y escritura, R2 preview/prod |
| R03 | Interpretación multimodal IA | src/server/simulador/interpretar-boceto.ts; studio-interpretar.ts | Parcial | Corpus real de bocetos, ambigüedades, errores y cuotas |
| R04 | Cotas revisables y confirmación humana | boceto.ts; studio-bocetos.astro; studio-bocetos.ts | Parcial | Validar invariantes completos, edición móvil y concurrencia |
| R05 | Geometría 2D | geometria-boceto.ts; render-boceto.ts | Parcial | Planta, huecos, puertas, obstáculos, colisiones y pruebas visuales |
| R06 | Material por pieza | studio-materiales.ts; compatibilidad-materiales.ts | Parcial | Reglas de familia, soporte, espesores, stock y compatibilidad real |
| R07 | Búsqueda paginada catálogo | studio-materiales.ts y studio-bocetos.astro | Implementado sin E2E | Probar búsqueda, paginación, teclado y carga móvil |
| R08 | Selector visual colores/texturas | studio-materiales.ts expone colorHex/textura; UI select textual | Pendiente | Tarjetas, muestras, imágenes, filtros y accesibilidad |
| R09 | Render Gemini con fotos y materiales | studio-generar.ts; renovationAiService.ts | Parcial | Prueba real de API, límites, resultado visual, coste y seguridad |
| R10 | Comparador antes/después | studio-bocetos.astro | Implementado sin E2E | Probar touch/teclado y accesibilidad |
| R11 | R2 privado resultados | studio-generar.ts; studio-archivos.ts | Parcial | Pruebas de persistencia y limpieza tras fallos |
| R12 | Idempotencia y exclusión de simultáneos | migraciones.ts v19/v20; studio-generar.ts | Parcial | Tests de carrera, reintento, doble cargo y caídas |
| R13 | Recuperación de trabajos | studio-recuperar.ts; studio-bocetos.astro | Parcial/manual | Cola, cron/reconciliación, cancelación y estado final verificable |
| R14 | Cuota y coste bajo | cuota.ts; studio-generar.ts | Parcial | Conciliar uso real, coste Gemini y límite mensual; confirmar objetivo 10 €/mes |
| R15 | Versionado y trazabilidad | studio-bocetos.ts; studio-duplicar.ts; migraciones.ts v21 | Parcial | E2E de fork, linaje y foto resubida, historial transaccional |
| R16 | Despiece medido | despiece-studio.ts; studio-despiece.ts | Parcial | Medidas por pieza, cantos, herrajes, mecanizados, desperdicios y formatos |
| R17 | Valoración de materiales | valoracion-studio.ts; studio-despiece.ts | Parcial | Unidades distintas de m², precios por paquete, merma, redondeos y validación comercial |
| R18 | Presupuesto precargado real | No hay integración desde Studio | Pendiente | Mapear partidas al módulo existente de presupuestos con autorización y revisión |
| R19 | Integración Proyectos/Simulaciones | No hay integración Studio completa | Pendiente | Guardar borrador, versiones, renders y referencias al proyecto |
| R20 | Seguridad técnica y pentest | Validaciones parciales | Sin validar | SQLi, XSS, CSRF, IDOR, sesión, límites, fugas y cross-tenant |
| R21 | Responsive y accesibilidad iPhone | UI Studio móvil básica | Sin validar | Safari real, Playwright/axe, contraste, teclado, lector |
| R22 | Build, typecheck, unit/integration/E2E | tests/simulador/*.test.ts | Sin validar | Ejecutar npm ci, lint, typecheck, test, build y E2E con CLIENTE_ID correcto |
| R23 | Despliegue seguro | Rama y PR #133 | No realizado | Solo tras QA, migraciones y aprobación explícita |

## Archivos principales
- src/pages/panel/studio-bocetos.astro — interfaz.
- src/pages/api/panel/studio-bocetos.ts — CRUD/confirmación.
- src/pages/api/panel/studio-archivos.ts — subida y lectura privada.
- src/pages/api/panel/studio-interpretar.ts — interpretación.
- src/pages/api/panel/studio-generar.ts — generación Gemini.
- src/pages/api/panel/studio-recuperar.ts — recuperación manual.
- src/pages/api/panel/studio-duplicar.ts — nueva revisión.
- src/pages/api/panel/studio-materiales.ts — búsqueda y paginación.
- src/pages/api/panel/studio-despiece.ts — despiece y valoración.
- src/server/simulador/{boceto,interpretar-boceto,geometria-boceto,render-boceto,compatibilidad-materiales,despiece-studio,valoracion-studio,cuota}.ts
- src/server/data/d1/migraciones.ts — migraciones 18–21.
- docs/simulador/auditoria-requisitos-studio.md — auditorías previas.

## Riesgos y defectos a inspeccionar ANTES de implementar más funciones
1. D1 batch en PATCH de studio-bocetos.ts: UPDATE optimista + INSERT SELECT; comprobar semántica transaccional y condición de carrera real, incluyendo changes=0.
2. La reserva de cuota y el INSERT de generación no son una transacción única. En error, la devolución podría ser incorrecta. La recuperación manual no concilia gasto real.
3. Worker invoca Gemini síncronamente; un timeout deja estado procesando hasta cierre manual.
4. Verificar que las rutas GET y POST de studio-generar.ts y sus estados coinciden con la UI y con el índice único de generación activa.
5. El despiece aún no calcula cantos, herrajes, mecanizados ni unidades de compra. No transformar una valoración parcial en presupuesto final.
6. El precio fijo de venta NO debe recibir merma adicional; ya se corrigió y hay test de regresión.
7. Revisión de diseño validado crea nuevo boceto con fotos pendientes; comprobar que no rompe el flujo de subida y que el origen se guarda en v21.
8. La búsqueda paginada devuelve 40 elementos y hay botón «Cargar más». Revisar selección y peticiones concurrentes en Safari.
9. Verificar imports, tipos y funciones de repositorio catalogo.variantes()/articulos() con TypeScript y build; ninguna ejecución CI verde ha sido confirmada.
10. Asegurar que la migración 19 no falla por generaciones activas duplicadas preexistentes y que 20/21 se aplican en preview antes de producción.

## Plan de ejecución para siguiente agente
P0 — Ejecutar CI real y corregir todos los fallos de TS/build/tests. No añadir más funcionalidades sobre base que no compile.
P0 — Tests D1 de migraciones 18–21, concurrencia, tenant, versiones y cuota; pruebas R2 privadas y API con mocks de Gemini.
P1 — Crear modelo comercial de escandallo completo y adaptador a presupuestos existentes. Exigir revisión humana y no inventar medidas ni precios.
P1 — Integrar Studio en Proyectos/Simulaciones con IDs, versiones, render y vínculo de presupuesto.
P1 — Implementar cola y reconciliación automática de renders, idempotencia y medición de coste real.
P2 — Selector visual con color/texture/muestras, filtros y paginación accesible; geometría ampliada.
P2 — Pruebas E2E Safari iPhone y revisión UX responsive.
P3 — Pentest autorizado y validación de despliegue; presentar evidencia de aceptación. No fusionar/deploy sin consentimiento.

## Criterios de cierre
- CI verde, pruebas de D1/R2/Gemini y flujos completos con datos de ejemplo reales.
- 0 incidencias críticas/altas de seguridad, aislamiento tenant probado.
- El presupuesto generado coincide con catálogo, reglas de precio, merma y unidades comerciales; editable y trazable.
- Diseño/versión, imágenes, despiece y presupuesto enlazados a Proyecto/Simulaciones.
- No duplicar cobros ni trabajos ante concurrencia y fallos; gasto real monitorizado.
- Validación en iPhone Safari y escritorio, teclado y lector.
- Aprobación explícita antes de merge/deploy.

## Estado del traspaso
Esta matriz es un inventario de implementación y riesgos; NO certifica funcionalidad ni ausencia de defectos. Verificar rama/HEAD y diferencias contra main antes de continuar.


## Sesión 2026-11-05 — incidencia «botones que no responden / no sale el boceto»

### Diagnóstico
- **El código del HEAD `ae78932` funciona en local** (build `CLIENTE_ID=turia`, preview workerd, Chromium): el script se inicializa («Turia Studio listo»), «Crear borrador» responde 201, aparece el alzado 2D, se suben las dos fotos y se guarda. Interpretar devuelve 503 en local solo porque no hay clave de Gemini ni R2.
- **Causa más probable en Cloudflare: la versión activa no es la del código.** `scripts/contenido/desplegar.ts:27` hace que en Turia el modo sea siempre `version` (`wrangler versions upload`): Workers Builds **sube la versión pero no la activa**; hay que publicarla a mano en *Workers & Pages → creacionesturia → Deployments*. Además, los builds de ramas que no son de producción no reciben las variables de build del panel (`CLIENTE_ID`, `SITE_URL`) y fallan: desplegar «la rama feature» desde Workers Builds no deja nada nuevo activo.
- Para comprobarlo sin dudas, la página de Studio enseña ahora **«Versión del código: <commit> (rama …)»** (`WORKERS_CI_COMMIT_SHA` inyectado en `astro.config.mjs`). Si no coincide con el commit esperado, lo servido es otra versión.

### Arreglos
- **Boceto 2D que no se actualizaba al editar una cota** (bug real): el campo cambiaba el dato pero no redibujaba; ahora `redibujar()` recalcula `calcularPlano`/`svgPlano` y el aviso en cada cambio sin rehacer los campos.
- **Aislamiento entre clientes (seguridad)**: la ruta `'/api/panel/studio-'` de `src/plataforma/modulos.ts` no casaba con ninguna API (la comparación es exacta o «ruta/…»), así que las API de Studio quedaban en el núcleo también en el Worker de Baltaretu. Ahora cada API está registrada con el módulo `simulador` y el sector carpintería (404 en Baltaretu).
- **Baltaretu sin cambios**: la página de Studio usaba clases de Tailwind nuevas que cambiaban el CSS y el HTML de toda la web de Baltaretu; queda fuera del escaneo (`global.css`). Su JS empaquetado se quita del build de los clientes sin el módulo (`quitarScriptsDeModulos` en `src/plataforma/sin-web.ts`). `npm run contenido:equivalencia`: sin diferencias.
- **Capa de datos**: el SQL de las 8 API de Studio pasa a `src/server/data/d1/studio.ts` (`sentenciasStudio(db)`, mismas sentencias, mismos `bind`/`batch`). Todas filtran por `cliente_id`.
- **CI**: 0 errores de lint (los `any` de tests de datos inválidos quedan con un `eslint-disable` justificado); instantánea `tests/baseline/d1-esquema.json` actualizada (v17 → v21, solo tablas y columnas nuevas, comprobado que las migraciones 16–21 son aditivas); tests de navegación con «Studio · Bocetos» en el Taller; e2e `gubia-fallo-groq` con un localizador inequívoco (`#gubia-estado`: había dos `role=status`).

### Pruebas (evidencia local)
- `npm run lint`: 0 errores. `npm test`: 89 archivos, 465 tests en verde. `npm run build` y `npm run check:worker`: bien.
- `npm run contenido:equivalencia`: `"diferencias":[]`, `"cambiosFrenteALaBase":[]`.
- `npm run test:e2e` (Baltaretu): 154 en verde. `npm run test:e2e:turia`: todo en verde, con el nuevo `tests-e2e-turia/studio.spec.ts` (inicialización JS, Crear borrador real, subida de fotos, interpretación **simulada**, alzado 2D, edición de cota que lo redibuja, recarga y recuperación del borrador, sin errores de JS).

### Pendiente (por prioridad)
1. **En Cloudflare (propietario)**: publicar la versión del último commit de esta rama, comprobar en Studio «Versión del código», y repetir el flujo con Gemini y R2 reales. Desactivar «Builds for non-production branches» o poner las variables de build en esas ramas.
2. R08 selector visual de materiales (tarjetas con color y textura) y R18/R19 presupuesto precargado e integración con Proyectos (sin empezar).
3. R12/R13: trabajos asíncronos y conciliación de coste real de Gemini; pruebas de carrera de generación.
4. Nombres descriptivos en `sentenciasStudio` (hoy `leerBoceto2`…) y tests de autorización cruzada entre clientes.

## Sesión 2026-11-05 (2) — «Interpretar» no funcionaba y la pantalla entera
- **Interpretar con IA** (`src/server/simulador/interpretar-boceto.ts`): ahora pide a Gemini **salida estructurada** (`responseSchema`), así que la respuesta siempre trae `modulos`, `obstaculos` y `preguntas`; las cotas se aceptan como número o `{valorMm}` y quedan «aproximadas». Antes, si Gemini devolvía otra forma, todo acababa en 422 «requiere revisión manual».
- **Errores claros**: cada código del proveedor tiene su mensaje con el detalle de Google (clave, modelo inexistente, límite…); la API distingue «falta GOOGLE_API_KEY» de «falta R2 (IMAGENES_PRIVADAS)». El modelo se puede cambiar con la variable `GEMINI_MODELO_BOCETO` (por defecto `gemini-3.8-flash`: Google retiró `gemini-2.5-flash` para cuentas nuevas el 05-11-2026). Si Gemini no responde, la simulación se devuelve; si responde algo ilegible (422), cuenta.
- **Pantalla nueva por pasos** (Proyecto → Fotos → Revisar → Imagen) con el diseño nuevo (nv-* y CSS en línea): las fotos se reducen a 2000 px en el móvil y se suben solas al elegirlas (antes el original de un iPhone superaba los 6 MB y fallaba); «Leer el boceto con IA» solo se activa con las dos fotos; «Poner yo las medidas» para ir sin IA; módulos con tipo, ancho/alto/fondo marcados «Aproximada (IA)» / «Confirmada», añadir y quitar módulos y piezas; **selector visual de materiales** (buscador y tarjetas con su color, de 40 en 40); medidas de corte plegadas; aprobar con aviso de medidas que faltan; imagen, comparador, despiece y «Más opciones». Sin medidas no se dibuja un alzado inventado.
- e2e `tests-e2e-turia/studio.spec.ts`: dos recorridos (con IA simulada y a mano) con axe en móvil y escritorio. Todo verde en local (lint, 467 tests, build, check:worker, equivalencia de Baltaretu, 71 e2e de Turia).
- **Pendiente de probar en Cloudflare con Gemini real** (yo no tengo acceso): si falla, el mensaje de estado dice ahora la causa exacta.

## Sesión 2026-11-05 (3) — elegir materiales del catálogo
- El selector solo enseñaba **variantes** del catálogo; los artículos sin variantes (catálogo de partida, altas a mano) no salían y la lista quedaba vacía. `variantesStudio()` (`src/server/simulador/materiales-studio.ts`) junta las variantes activas y los artículos sin variantes (id `articulo:<id>`), sin mano de obra ni servicios. Lo usan el selector (`studio-materiales`), el guardado (`studio-bocetos`), la imagen (`studio-generar`) y el despiece: todos ven la misma lista.
- Los errores de compatibilidad muestran el motivo («La pieza requiere un tablero o panel»).
- Aprobar con medidas «Aproximada (IA)» sin confirmar lo rechaza el servidor: ahora la pantalla lo explica y hay un botón «Dar por buenas las medidas de la IA».
