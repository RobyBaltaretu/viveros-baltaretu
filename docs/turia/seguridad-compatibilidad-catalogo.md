# Seguridad y compatibilidad del catálogo

## Controles aplicados

- PDF local: firma `%PDF-`, máximo 25 MB y 160 páginas. El archivo completo no se envía al Worker ni a Groq.
- Prompt injection: el texto del proveedor se declara no fiable; las instrucciones dentro del documento se ignoran y la salida se valida con Zod estricto.
- Groq Free: no existe fallback a un modelo de pago. Se conservan timeout, `Retry-After`, límites diarios y bloques pequeños.
- Imágenes: solo WebP con firma válida y hasta 24 KB al confirmar. Se alojan en adjuntos privados y se sirven por ruta autenticada.
- URLs: las fichas visuales solo admiten HTTPS o la ruta privada exacta del panel; no se descargan URLs arbitrarias en servidor.
- Autorización: lectura y escritura usan `sesionCon(..., 'facturas')`; costes, márgenes e importaciones no se exponen en rutas públicas.
- Tenant: el servidor elige el binding D1 por cliente. Ningún `tenant_id` procedente del navegador decide el almacén.
- SQL: todas las mutaciones usan sentencias preparadas. Filtros dinámicos se construyen con fragmentos cerrados y valores enlazados.
- Idempotencia: identidad normalizada para familias/variantes/decorativos, `articulo_id` único y clave primaria de importación/lote.
- Compatibilidad: las tablas anteriores, sus datos y sus rutas se conservan. La prueba de migración parte de la instantánea v16 y verifica igualdad fila a fila después de v17.

## Riesgos residuales

- La interpretación semántica de Groq requiere revisión humana y puede omitir una relación incluso con un JSON válido.
- Un lote reservado y abortado antes de completarse exige inspección de su estado antes de reintento administrativo; el artículo y la variante siguen siendo idempotentes.
- Las licencias de muestras dependen del proveedor. Una imagen presente en el PDF no implica permiso de reutilización pública.
- No se ejecutaron pruebas contra D1 de producción ni llamadas reales a Groq/Gemini.
- `npm audit` informa dependencias transitivas; deben evaluarse con una actualización separada para no introducir cambios mayores en este PR funcional.

