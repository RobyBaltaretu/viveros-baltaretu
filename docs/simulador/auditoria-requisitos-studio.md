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
