# Preview aislada de Creaciones Turia · fases 1 a 3

## Seguridad operativa
Esta rama hereda las fases 1 y 2. No desplegar sobre el Worker `creacionesturia` ni conectarlo a la D1 `creacionesturia` de producción. Los datos de clientes, facturas y gastos reales no deben borrarse. La inicialización del entorno preview debe utilizar una nueva D1 y un Worker con nombre exclusivo, además de una aplicación Cloudflare Access separada.

## Preparación de un preview seguro
1. Crear una D1 exclusiva de preview, por ejemplo `creacionesturia-preview`, y configurar un Wrangler específico no compartido con producción.
2. Vincular el Worker de preview exclusivamente a esa D1; verificar las vinculaciones y el nombre del Worker antes de cada despliegue.
3. Habilitar Cloudflare Access para el dominio de preview; verificar rechazo de usuarios sin autorización y de roles sin permiso.
4. Aplicar migraciones de esquema mediante el mecanismo existente y cargar **datos sintéticos** desde un generador idempotente, sin copiar clientes ni tickets reales.
5. Probar en móvil y escritorio presupuesto borrador → enviado → aceptado → factura de anticipo → emitida → cobro → factura final; también rechazado, caducado, gastos sin ticket, proveedores sin pedidos, entregas parciales, facturas rectificativas y errores.
6. Probar los backups y la recuperación de la D1 de preview antes de habilitar cualquier borrado.

## Reinicio de datos de prueba
**No ejecutar `DROP TABLE` ni `DELETE` en la D1 de producción.** Al solicitar un reseteo de preview, la opción más segura es **eliminar y recrear exclusivamente la D1 de preview** desde Cloudflare después de comprobar su ID y disponer de copia. Así se rehace el esquema desde migraciones y se cargan datos de ejemplo coherentes, sin conservar datos de pruebas previas.

La creación de la nueva D1, la eliminación física y la carga completa de fixtures son tareas externas **pendientes**, no realizadas por incorporar este documento. La limpieza propuesta afecta a la instancia preview, nunca a las tablas compartidas con producción.

## Matriz mínima de fixtures coherentes
| Entidad | Casos mínimos |
| --- | --- |
| Usuarios y permisos | propietario, gerente y editor |
| Clientes | particular, empresa, cliente archivado, cliente sin NIF |
| Presupuestos | borrador, enviado vigente, caducado, aceptado con anticipo, aceptado sin anticipo, rechazado |
| Facturas | anticipo en borrador, anticipo emitido, final emitida, final cobrada, rectificativa |
| Cobros | no cobrado, anticipo cobrado, final cobrada, cobro sin factura para revisión |
| Proveedores y materiales | proveedor activo, archivado, material con precio y material sin precio |
| Pedidos | borrador, enviado, recepción parcial, recibido |
| Gastos y tickets | por revisar, confirmado, vinculado a pedido, sin pedido |
| Obras y agenda | por iniciar, en curso, terminada, cita pendiente y completada |
| Portfolio | al menos cocina, armario, puertas, baño, mueble a medida y separador |
| Simulador y asistente | sin uso, cuota próxima a límite, error de proveedor, interacción confirmada y rechazada |

Todos los importes, clientes y fotos de ejemplo deben figurar como ficticios. Las imágenes generadas no son obras realizadas por la empresa.

## Criterio de salida
- CI de ambos clientes en verde.
- Comprobación visual manual móvil y escritorio.
- Entorno preview separado con Access y D1 independientes.
- Datos de demo coherentes, sin referencias huérfanas, reseteo reversible y prueba documentada de restauración.
- Revisión de flujos de pagos parciales: el producto actual solo almacena fecha por tramo y no incluye libro de movimientos.

**Estado:** planificación y cambios de diseño en curso; preview remoto, reset de D1 y fixtures no ejecutados.
