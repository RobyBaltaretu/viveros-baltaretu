# Turia Studio — traspaso técnico y matriz de requisitos
Fecha de revisión: 2026-11-04
Repositorio: RobyBaltaretu/viveros-baltaretu
Rama: feature/turia-studio-boceto-multimodal
PR: https://github.com/RobyBaltaretu/viveros-baltaretu/pull/133
IMPORTANTE: no fusionar a main ni desplegar sin autorización. No se ha demostrado CI verde ni E2E real.

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
