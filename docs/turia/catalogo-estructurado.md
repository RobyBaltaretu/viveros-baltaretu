# Catálogo estructurado de Creaciones Turia

## Decisión de arquitectura

El catálogo anterior sigue siendo la capa de compatibilidad. `catalogo_articulos` y `catalogo_plantillas` no se eliminan ni se reescriben. Cada variante estructurada enlaza un `articulo_id`; presupuestos, escandallos, pedidos y simulador continúan usando ese identificador y pueden resolver además el identificador de variante.

La migración D1 v17 es exclusivamente aditiva:

- `catalogo_familias`: producto base, categoría, tipo, proveedor y origen.
- `catalogo_variantes`: combinaciones comerciales explícitas. La identidad incluye familia, referencia, soporte, formato, espesor, acabado, tratamiento y calidad.
- `catalogo_decorativos` y `catalogo_variante_decorativos`: color/decorativo reutilizable y relaciones explícitas.
- `catalogo_configurables`: parámetros, rangos, pasos, reglas y vínculo opcional con la plantilla de escandallo existente.
- `catalogo_importaciones` y `catalogo_importacion_lotes`: progreso acumulado y lotes idempotentes.

Creaciones Turia y Viveros Baltaretu mantienen bases D1 separadas por la configuración de cliente ya existente. La nueva estructura no introduce una consulta global ni una clave de tenant controlada por el navegador; el límite de tenant sigue siendo el binding D1 elegido en servidor.

## Dimensiones y unidades

Las dimensiones se guardan normalizadas en milímetros junto con el texto y la unidad originales. `244 × 122 cm` se compara como `2440 × 1220 mm`, pero conserva su representación publicada. Las unidades por paquete son un campo comercial independiente y nunca participan en la lectura del espesor.

Cada variante distingue unidad de compra, consumo y presupuesto, factor de conversión y unidades por paquete. El módulo `modelo.ts` calcula superficie y redondeo de paquetes sin ocultar cantidades parciales.

## Importación

El PDF no sale del navegador. PDF.js reconstruye filas y matrices; Groq recibe únicamente texto o la imagen de una página solicitada por el usuario. Todo contenido del proveedor se trata como dato no fiable. La salida incluye origen, página, método, confianza y estado de revisión.

La confirmación usa lotes de hasta 100 registros y la interfaz envía lotes de 3 u 8 según incluyan muestras. No existe un máximo acumulado de 400: una importación conserva su identificador y puede abarcar tantos lotes como sean necesarios. El servidor impide confirmar dos veces el mismo lote y acumula creados, actualizados, duplicados, rechazados y pendientes.

Los artículos heredados pueden convertirse desde el catálogo mediante "Crear familias y variantes de los artículos actuales". El procedimiento:

1. No modifica el artículo, coste, precio, muestra ni enlaces existentes.
2. Solo rescata un formato de `notas` si aparece etiquetado como `Formato:`.
3. Conserva el texto completo como evidencia de migración.
4. Marca familia y variante como pendientes de revisión.
5. Es idempotente por `articulo_id`.

## Configurables

El catálogo de Colomba se reconoce de forma determinista:

- 15 cajoneras, con ancho 40-100 cm, alto 40-60 cm, pasos de 5 cm, 1-8 cajones y alturas de cajón por modelo.
- Tres zapateros, con rangos y fondo fijo del abatible.
- Nueve muebles bajo proyecto. Se solicitan medidas, fotos, planos y notas, pero no se inventan límites.

El validador comprueba mínimos, máximos, pasos, opciones y reglas. Los configurables pueden enlazarse después con `catalogo_plantillas`; no se ha creado un segundo motor de fórmulas.

## Despliegue y rollback

1. Instalar dependencias con `npm ci` usando Node 22.
2. Ejecutar `npm run check`, `npm test` y `npm run check:worker`.
3. Desplegar el Worker de Turia. `asegurarEsquema` aplicará v17 en su D1 antes de servir repositorios.
4. No ejecutar SQL manual en producción ni copiar datos entre bindings de clientes.
5. Importar primero en D1 aislada y revisar familias/variantes antes de confirmar precios.

Rollback de código: volver al Worker anterior. Las tablas v17 pueden permanecer sin ser usadas; no deben borrarse. Si se necesita deshacer una importación, archivar sus artículos o restaurar una copia D1. No se incluye una migración descendente destructiva.

