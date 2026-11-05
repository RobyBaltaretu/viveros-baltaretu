# Auditoría de requisitos — Turia Studio multimodal
Fecha: 2026-11-04. Rama: feature/turia-studio-boceto-multimodal. Estado: experimental; NO fusionar a main sin QA.

| Requisito | Estado | Evidencia / límite |
| --- | --- | --- |
| Foto del espacio y foto del boceto | Implementado en código | studio-archivos.ts, estudio-bocetos.astro; falta prueba iPhone |
| Interpretación multimodal | Parcial | studio-interpretar.ts, interpretar-boceto.ts; no validado con dibujos reales |
| Medidas exactas/aproximadas/desconocidas | Parcial | boceto.ts; confirmación humana y cotas, falta control dimensional avanzado |
| Geometría 2D | Parcial | geometria-boceto.ts; solo alzado frontal, no plano de planta, huecos ni colisiones |
| Materiales por pieza | Parcial | studio-materiales.ts y compatibilidad-materiales.ts; reglas heurísticas, falta espesor/dimensiones/familias exhaustivas |
| Render fotorrealista | Implementado en código, sin validar | studio-generar.ts; falta ensayo real Gemini y fidelidad visual |
| Persistencia privada | Parcial | R2 creacionesturia, D1; falta ensayo con bucket conectado y política de borrado |
| Antes/después | Parcial | slider en studio-bocetos.astro; falta E2E móvil y alineación de encuadres |
| Generaciones idempotentes | No | comprobación SELECT previa no evita dos POST concurrentes; requiere restricción atómica en D1 e idempotency key |
| Reanudación de trabajos | No | estado procesando puede quedar huérfano; requiere recuperación y reconciliación |
| Coste real <=10 EUR/mes | No demostrado | reserva fija 20 céntimos, sin contabilizar coste real, tokens ni precios por modelo |
| 30+ generaciones/mes | No demostrado | límites compartidos con interpretación y simulador; comprobar proveedor y presupuesto |
| BOM y presupuesto | No | no inferir cantidades desde imagen; diseñar despiece y medidas confirmadas |
| Proyecto/simulación | Parcial | borradores Studio en D1; integración con Proyectos/Simulaciones pendiente |
| Multi-tenant y autorización | Parcial | rutas limitadas a Turia y consultas por cliente; faltan tests de acceso cruzado |
| Seguridad, privacidad, accesibilidad y Safari | No validado | CI y E2E obligatorios antes de producción |

## Riesgos de bloqueo de lanzamiento
1. Race condition en generaciones: dos solicitudes simultáneas pueden generar dos imágenes de pago.
2. Worker síncrono: latencia y límites de ejecución; evaluar cola y proceso asíncrono.
3. R2: verificar bucket privado, binding real y separación preview/prod.
4. El modelo de imagen puede cambiar geometría y acabados; mostrar siempre advertencia de representación no constructiva.
5. La interpretación de piezas y el catálogo pueden ser incompletos; exigir validación humana y pruebas con PDFs de proveedor.
6. No existe todavía trazabilidad de precio real ni garantía del objetivo económico.
7. No se han realizado ensayos reales con fotos de clientes ni validado recuperación de fallos.

## Criterio de aceptación antes de fusionar
- CI verde: typecheck, lint, unitarios, build Astro/Cloudflare y E2E móvil.
- Prueba de concurrencia: una única generación cobrada por solicitud idempotente.
- Prueba de caída: generación recuperable tras reinicio de Worker sin doble cargo.
- Validación manual de al menos cinco bocetos variados, incluidas cotas desconocidas y obstáculos.
- Materiales correctos en todas las piezas y presupuesto calculado exclusivamente desde geometría confirmada.
- Registro y límite del coste real con alarmas, sin prometer 10 EUR sin evidencia.
- Revisión de seguridad de imágenes privadas y separación entre tenants.


## Avance posterior — exclusión de concurrencia
- Migración 19: índice único parcial en D1 para un trabajo activo por cliente, boceto y revisión.
- API de generación: captura conflicto de inserción y devuelve reserva de cuota.
- Historial: señala trabajos en procesando con más de 15 minutos para revisión humana, sin reintentar ni liberar automáticamente una cuota cuyo consumo externo es incierto.
- Prueba de esquema: tests/simulador/studio-concurrencia.test.ts.
- Pendiente: idempotency key por solicitud, reconciliación de fallos del proveedor, colas asíncronas, presupuesto/BOM y E2E.
- Precaución: la migración 19 puede fallar si ya existen múltiples trabajos activos para el mismo boceto y revisión; sanear preview antes de aplicar.

## Avance: despiece verificable
- PiezaBoceto admite corte opcional con ancho/alto en mm, cantidad y espesor opcional; se valida el dominio.
- prepararDespiece solo calcula m² cuando las medidas de corte son exactas y confirmadas. Nunca deriva el área de la pieza a partir de las dimensiones del módulo.
- Nuevo GET /api/panel/studio-despiece protegido por sesión y tenant; UI de edición y revisión de despiece.
- Pendiente: costes, mermas, unidades de compra, despieces de cantos y herrajes, generación de presupuesto y enlace a Proyectos/Simulaciones.
- Importante: el boceto validado es inmutable; las cotas de corte deben revisarse antes de confirmarlo. El flujo de revisión/fork de versiones validadas sigue pendiente.
- Revisión de calidad pendiente: CI, pruebas de D1/R2, Gemini real, accesibilidad y Safari. No hay confirmación de compilación de estos cambios.

## Revisión transversal de requisitos desde el inicio (2026-11-04)
Se ha contrastado el código de las rutas Studio, dominio boceto, interpretación, geometría, render, catálogo, D1, R2 y despiece. No equivale a una prueba funcional de producción.

### Implementaciones añadidas
- Revisión editable: POST /api/panel/studio-duplicar crea un nuevo borrador desde un diseño aprobado, sin modificar el original. Las imágenes deben subirse de nuevo. No existe aún enlace persistente padre-hijo entre revisiones.
- UX: los diseños validados son de solo lectura y se ofrece crear una nueva revisión.
- Seguridad: confirmar un boceto exige que las dos fotografías pertenezcan al mismo boceto y correspondan a las clases espacio/boceto.
- Reintentos: la API distingue generación procesando, fallida y completada; la UI no presenta una generación en curso como imagen terminada.
- Despiece: un despiece medido no se considera presupuesto económico; presupuestable permanece falso hasta que existan costes, mermas y unidades comerciales.

### Hallazgos de prioridad crítica
1. El registro de versiones en studio-bocetos.ts ocurre después de UPDATE y no dentro de una misma transacción; puede quedar una revisión sin historial.
2. La reserva de cuota y la inserción de generación son operaciones separadas; dos reintentos o caídas pueden producir discrepancias. La devolución tras error debe comprobarse para evitar doble devolución.
3. La llamada Gemini es síncrona dentro del Worker; no existe cola, reconciliación ni garantía de recuperación tras un timeout.
4. Una respuesta de Gemini con imagen base64 ilegible y ciertos fallos de persistencia no dejan siempre la generación en estado fallida; pueden bloquear la revisión.
5. No hay cálculo de coste real por modelo ni prueba de cumplimiento del objetivo 10 EUR/mes.
6. El render fotorrealista es probabilístico: no garantiza conservación exacta de geometría, veta ni obstáculos.
7. La compatibilidad de materiales usa heurísticas textuales; no verifica familias, espesores, dimensiones disponibles, cantos, herrajes ni stock como restricciones duras.
8. El despiece solo calcula superficies rectangulares; faltan mecanizados, cantos, herrajes, unidades de compra, merma y costes. No crear presupuesto automático hasta completar esas reglas.
9. El selector muestra como máximo 80 variantes; no ofrece búsqueda paginada, miniaturas completas ni filtros por pieza.
10. La versión duplicada no guarda relación estructurada con su origen; tampoco integra aún Proyectos/Simulaciones.
11. La interpretación de IA no dispone de batería de fotos reales, cotas ambiguas, objetos existentes ni regresiones geométricas.
12. No se han verificado build, typecheck, pruebas E2E, Safari/iPhone, R2 preview/prod, ni autorización cruzada entre tenants.

### Requisitos originales — semáforo de aceptación
| Área | Resultado actual |
|---|---|
| Carga de dos imágenes y privacidad | Código implementado, sin E2E |
| IA multimodal y normalización de cotas | Parcial, requiere revisión humana |
| Alzado geométrico 2D | Parcial, sin planta ni colisiones |
| Materiales por pieza con catálogo visual | Parcial, reglas y selector básicos |
| Render Gemini y almacenamiento R2 | Código implementado, no validado con servicio real |
| Antes/después desplazable | Implementado, sin pruebas visuales |
| Guardar boceto y crear nueva revisión | Implementado con duplicado; falta trazabilidad padre-hijo |
| Despiece con cortes medidos | Parcial, sin escandallo completo |
| Presupuesto precargado | No implementado |
| Integración en Proyectos/Simulaciones | No implementado |
| Cuota mensual y control de gasto | Parcial, coste real no medido |
| Idempotencia y recuperación de generación | Parcial, sin reconciliación asíncrona |
| Seguridad, accesibilidad, móvil y multi-tenant | Requiere pruebas de aceptación |
| CI verde, demo real, despliegue | No confirmado |

No fusionar ni desplegar hasta cerrar bloqueantes y verificar CI y pruebas reales.

## Iteración de consistencia y recuperación (2026-11-04)
- studio-bocetos PATCH: UPDATE optimista y creación de versión ahora comparten un único lote D1; INSERT ... SELECT copia exactamente la interpretación persistida tras actualizar.
- studio-generar: fallos de base64 y persistencia de metadatos pasan a estado fallida para liberar el índice único de trabajos activos.
- Interfaz: rota clave de idempotencia tras resultado completado o fallido.
- studio-recuperar: operador autorizado puede cerrar trabajos procesando de más de 15 minutos; no devuelve cuota porque Gemini podría haber consumido recursos. UI informa de ello.
- Aún no hay cola asíncrona ni verificación con el proveedor del coste real. La conciliación requiere acción humana; no se debe considerar recuperación automática completa.
- Falta confirmar build/CI y prueba real de D1, R2 y Gemini.
- Sigue pendiente conversión a presupuestos, costes y merma por variante, vínculo a Proyectos/Simulaciones, selección visual de materiales y QA Safari.

## Contraste incremental — valoración y búsqueda (2026-11-04)
- Añadida valoración conservadora de materiales del despiece usando coste, merma y margen del artículo vinculado a cada variante. Solo admite unidades m² en artículo, consumo y presupuesto; referencias sin precio, stock o unidades compatibles se bloquean.
- El endpoint de despiece devuelve la valoración parcial y la UI la presenta expresamente como estimación de materiales sin IVA, no como presupuesto final.
- Añadidas pruebas unitarias de subtotal, unidades no soportadas y artículos sin coste.
- El selector de piezas permite búsqueda remota por referencia, nombre y acabado, con espera de 250 ms y conservación del material seleccionado.
- Sigue pendiente: compra por formatos y paquetes, conversión de unidades, cantos, herrajes, mecanizados, mano de obra, impuestos, integración en presupuestos y Proyectos.
- Hallazgo UX: la búsqueda es textual y el catálogo responde un máximo de 80 resultados; falta paginación, filtros por familia y miniaturas/color/texture visuales.
- Hallazgo económico: el precio fijo y la merma tienen reglas de negocio que requieren validación con el cliente antes de crear un presupuesto real.
- No hay CI verde ni validación E2E confirmada para estos cambios; no fusionar ni desplegar.

## Revisión de cierre solicitada — 2026-11-04
- Corregido el cálculo de precio fijo: el precio de venta fijo por m² no recibe merma adicional; la merma se sigue contabilizando en el coste base. Añadidas pruebas de regresión.
- Disponibilidad desconocida y bajo pedido ahora requieren confirmación comercial.
- Migración 21 y duplicación: persistencia de origen_boceto_id para reconstruir la relación entre revisiones derivadas.
- **No considerar completado**: presupuesto completo, vínculo con Proyectos, selector visual paginado, colas Gemini, medición de coste real, QA E2E móvil y pruebas CI. Estas áreas siguen abiertas y requieren desarrollo y verificación; no cambiar el estado de aceptación a terminado sin evidencia.
