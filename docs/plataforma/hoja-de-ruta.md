# Hoja de ruta de la plataforma

El detalle de cada PR está en [plan.md](plan.md) y lo hecho, en [estado-plan.md](estado-plan.md).

## Fases

| Fase | Qué | Resultado |
| --- | --- | --- |
| **F0** | Documentación y red de seguridad de Baltaretu | Cualquier cambio visible en Baltaretu hace fallar la CI. |
| **F1** | Cimientos multicliente: configuración, módulos, tema, idiomas, vocabulario y tipos de contenido | `CLIENTE_ID=turia` construye una web vacía de Turia, y Baltaretu queda idéntico. |
| **F2** | Web pública de Creaciones Turia | Portafolio interactivo, servicios, formulario de proyecto y muestrario. |
| **F3a** | Panel mínimo para salir: presupuestos a cliente, clientes y facturas, e inicio | Turia puede presupuestar, facturar y cobrar. |
| **F3b** | Proveedores, materiales, pedidos, obras, agenda, garantía, KPIs y asistente del sector | El flujo completo: petición → visita → presupuesto → anticipo → pedido → montaje → factura → garantía. |
| **F4** | Simulador: entrega A (sin IA), spike y entrega B (con IA, si la calidad es aceptable) | Imagen orientativa enviable como petición. |
| **F5** | Operación: alta y baja de clientes, copia diaria multicliente y estado por cliente | Mantenible por una sola persona. |

Orden de trabajo: F0 → F1 → F2.1 y F3a en paralelo → F2 resto → F3b → F4 → F5. La F5.2 (copias) se adelanta en cuanto haya un segundo cliente en producción.

## Escala

Las cifras de Cloudflare están **por confirmar** ([discrepancias D-02, D-12 y D-14](discrepancias.md)).

| Clientes | Qué hace falta |
| --- | --- |
| **2–6** | Una cuenta gratuita y una instalación por cliente. Workers Builds por cliente, con su `CLIENTE_ID`. Hay que vigilar:<ul><li>1 build a la vez por cuenta y 3.000 minutos al mes compartidos;</li><li>las 10.000 neuronas de IA al día también compartidas: reparto en [P-02](preguntas.md).</li></ul> |
| **~9–10** | Límite de **10 bases de D1 por cuenta** en el plan gratuito: se decide en [P-01](preguntas.md). La copia diaria pasa a matriz (5.2). |
| **20** | Despliegue por oleadas con una matriz de GitHub Actions. Fotos en R2 si las bases se acercan al 70 % de los 5 GB de la cuenta. |
| **50** | Varias cuentas o Workers Paid (P-01). Altas y bajas con el comando 5.1 y el estado operativo con 5.3. |
