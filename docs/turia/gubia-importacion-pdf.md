# Gubia · Importar catálogos PDF de proveedores (Creaciones Turia)

## Objetivo
En **Catálogo → Importar PDF con Gubia**, el gerente o propietario sube un PDF original, indica el proveedor y obtiene candidatos editables. El usuario selecciona y confirma expresamente qué materiales se crean. El asistente no guarda artículos durante el análisis.

## Primera entrega implementada
- Entrada: PDF de hasta **8 MB y 160 páginas**. Worker Cloudflare protegido por Access y permiso `facturas`. No disponible en Viveros Baltaretu.
- Análisis: PDF se abre con `pdf-lib` y se envía a Gemini en bloques de **6 páginas**, sin exponer `GOOGLE_API_KEY` al navegador. En interfaz se solapa una página entre bloques para aumentar las probabilidades de relacionar fichas y muestras.
- Salida: lista validada mediante Zod (nombre, categoría, referencia, código decorativo, acabado, soporte, espesor, formato, unidad, color aproximado, veta, brillo, página).
- Revisión: seleccionar o descartar cada ficha; corregir nombre, categoría, referencia, acabado, espesor, formato, color y soporte. El PDF y los candidatos permanecen en la sesión del navegador hasta la confirmación.
- Guardado: **solo artículos nuevos**, mediante IDs deterministas y `INSERT … ON CONFLICT DO NOTHING` para evitar sobrescribir los existentes. Categoría/merma/margen se proponen desde las reglas actuales de Turia. `coste=0`, `precioFijo=null`, `notas` con documento y página de origen, pendiente de tarifa.
- Seguridad: Access + rol, CSRF, límite real de bytes, validación del PDF, cuotas diarias de 40 bloques por usuario, sin escritura directa por IA. El PDF se trata como entrada no fiable; se informa de que se envía al proveedor de IA.

## Uso para ONESTA
1. Abre `/panel/catalogo/importar` en Turia.
2. Introduce `ONESTA` y sube el PDF de proveedor (sin modificarlo).
3. Comprueba los candidatos y el código de cada muestra, formatos y espesores en las páginas citadas.
4. Desmarca muestras dudosas, revisa colores y completa la referencia exacta.
5. Confirma el alta. Completa precios de compra y venta antes de utilizarlos en presupuestos.
6. Comprueba desde Turia Studio que los materiales activos aparecen en las zonas permitidas.

## Límites y evolución
- **No extrae todavía imágenes de textura reales** del PDF ni las almacena como recursos privados: `colorHex` es una aproximación visual. No presentar ese color como muestra certificada del fabricante.
- No crea automáticamente todas las combinaciones posibles entre tamaño, acabado y espesor; solo las que el extractor identifica y el usuario valida.
- No conserva un trabajo parcial al cerrar el navegador; no hay cola asíncrona ni historial de lotes.
- Máximo 400 candidatos en una revisión. Si un proveedor aporta más, dividir el documento.
- El resultado de un PDF complejo debe revisarse manualmente. No afirmar que todas las muestras o tablas se han interpretado correctamente.
- El análisis de documentos de hasta 160 páginas puede consumir bastantes llamadas a Gemini. El límite de 40 bloques/día por usuario es protección inicial, no facturación medida al céntimo.
- Pendiente posterior: almacenamiento privado de muestras de textura, lotes persistentes, deduplicación avanzada por referencia/variantes y reconciliación de nuevas ediciones de catálogo.

## Validación
Ejecutar `npm run lint`, `npm test`, `npm run build:turia` y `npm run test:e2e:turia` antes de fusionar. Las pruebas unitarias simulan Gemini sin enviar PDFs reales al proveedor. Para validar ONESTA con Gemini y costes reales, usar un entorno preview aislado y credenciales de prueba. Nunca activar el proceso directamente sobre producción sin verificar el resultado y las condiciones de licencia del documento.
