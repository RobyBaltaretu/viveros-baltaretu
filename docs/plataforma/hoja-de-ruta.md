# Hoja de ruta de la plataforma

El detalle de cada PR está en [plan.md](plan.md) y lo hecho, en [estado-plan.md](estado-plan.md).

## Fases

| Fase | Qué | Resultado |
| --- | --- | --- |
| **F0** | Documentación y red de seguridad de Baltaretu | Cualquier cambio visible en Baltaretu hace fallar la CI. |
| **F1** | Cimientos multicliente: configuración, módulos, tema, idiomas, vocabulario y tipos de contenido | `CLIENTE_ID=turia` construye una web vacía de Turia, y Baltaretu queda idéntico. |
| **F2** | Portafolio privado de Creaciones Turia (solo para el propietario, dentro del panel) | Proyectos con su antes y después. Sin web pública. |
| **F3a** | Panel mínimo para salir: presupuestos a cliente, clientes y facturas, e inicio | Turia puede presupuestar, facturar y cobrar. |
| **F3b** | Proveedores, materiales, pedidos, obras, agenda, garantía, KPIs y asistente del sector | El flujo completo: petición → visita → presupuesto → anticipo → pedido → montaje → factura → garantía. |
| **F4** | Simulador: entrega A (sin IA), spike y entrega B (con IA, si la calidad es aceptable) | Imagen orientativa enviable como petición. |
| **F5** | Operación: alta y baja de clientes, copia diaria multicliente y estado por cliente | Mantenible por una sola persona. |

Orden de trabajo: por orden, F0 → F1 → F2 → F3a → F3b → F4 → F5. La F5.2 (copias) se adelanta en cuanto haya un segundo cliente en producción.

## Escala

Las cifras de Cloudflare están **por confirmar** ([discrepancias D-02, D-12 y D-14](discrepancias.md)).

| Clientes | Qué hace falta |
| --- | --- |
| **2–6** | Una cuenta gratuita y una instalación por cliente. Workers Builds por cliente, con su `CLIENTE_ID`. Hay que vigilar:<ul><li>1 build a la vez por cuenta y 3.000 minutos al mes compartidos;</li><li>las 10.000 neuronas de IA al día también compartidas: reparto en [P-02](preguntas.md).</li></ul> |
| **~9–10** | Límite de **10 bases de D1 por cuenta** en el plan gratuito: se decide en [P-01](preguntas.md). La copia diaria pasa a matriz (5.2). |
| **20** | Despliegue por oleadas con una matriz de GitHub Actions. Fotos en R2 si las bases se acercan al 70 % de los 5 GB de la cuenta. |
| **50** | Varias cuentas o Workers Paid (P-01). Altas y bajas con el comando 5.1 y el estado operativo con 5.3. |

## Plan de mejora continua 2026 · Dos clientes

Complementa F0–F5 sin sustituir sus hitos. Cada fase se desarrolla en un PR independiente, y nunca se despliega implícitamente el otro cliente.

| Orden | Fase | Objetivo | Criterio de cierre |
| --- | --- | --- | --- |
| **1A · P0** | Seguridad y fiabilidad | Autorización por rol y endpoint, tratamiento de adjuntos, CSRF, CSP, facturación transaccional e idempotente. | CI y E2E de ambos clientes, pruebas de permisos y revisión de riesgos. |
| **1B · P1** | Infraestructura | Protección de main, checks obligatorios, vistas previas protegidas con Access, builds, Workers y D1 independientes, alertas de IA y costes. | Configuración verificada en GitHub y Cloudflare, despliegue y rollback ensayados por cliente. |
| **1C · P1** | Recuperación | Copias cifradas e independientes de ambas D1, retención documentada, privilegios mínimos y restauración periódica. | Restaurar de prueba cada cliente con factura, presupuesto, ticket y enlaces; nunca guardar copias o secretos en Git. |
| **2 · P1** | Flujo comercial Turia | Presupuesto, envío confirmado, aceptación, anticipo, compras, factura final y cobros. | Transiciones explícitas, sin doble emisión, E2E móvil/escritorio. |
| **3 · P1** | Flujo compras Turia | Proveedor, pedido, recepción parcial o total, documento, gasto conciliado y coste por trabajo. | Sin duplicados, soportar gastos sin pedido y varias entregas. |
| **4 · P2** | UX/UI Turia | Formularios, tablas, acciones contextuales, accesibilidad y responsive. | Axe, teclado y recorridos reales de escritorio y móvil. |
| **5 · P2** | BI accionable | Conversión, vencimientos, deuda, margen con costes atribuidos y gastos sin conciliar. | KPIs trazables con cálculos y definiciones probados. |

**Criterio de arquitectura:** mantener un repositorio, configuración por cliente, Worker y D1 independientes. No introducir microservicios, R2 o una nueva base sin métricas que justifiquen coste y complejidad. Los cambios compartidos siempre pasan pruebas de no regresión de Baltaretu.

**Configuración externa pendiente:** reglas de protección de main, Access en previews, alertas de costes y copias automáticas requieren revisión y acciones en GitHub/Cloudflare; documentarlas no equivale a activarlas.

**Estado:** fase 1A iniciada en [PR #104](https://github.com/RobyBaltaretu/viveros-baltaretu/pull/104). No fusionar hasta validar CI, compatibilidad y permisos.
