# Gubia Importador · PDF.js local + Groq Free

## Coste y aislamiento
- **Gemini no participa en este importador**. La cuota presupuestada para el simulador de reformas se mantiene separada.
- PDF.js 6.4.299 se integra en el bundle y se ejecuta en el navegador; no usa servidor para procesar el PDF, ni requiere CDN externo.
- Groq Free procesa solo texto de las páginas o una página en JPEG si el usuario lo solicita.
- El plan Free no factura por llamadas dentro de sus cuotas, pero devuelve HTTP 429 cuando se agotan. No hay respaldo de pago.
- Clave `GROQ_API_KEY` en Cloudflare Workers; no se envía al navegador. El chat Gubia utiliza la misma organización, pero el flujo de importación es puntual y serial.

## Flujo implementado
1. `/panel/catalogo/importar`: subir el PDF original, hasta **25 MB** y **160 páginas**, indicar proveedor.
2. PDF.js lee y reconstruye las filas de texto y tablas en el dispositivo. Guarda el texto temporalmente en memoria.
3. Groq `openai/gpt-oss-120b` interpreta grupos de hasta **3 páginas o 9.000 caracteres**, como máximo 30 grupos/día por usuario. Páginas sin texto se pueden consultar mediante la opción visual.
4. Para páginas escaneadas, tablas de color o dudas de relación, el usuario pulsa **Ver página** y **Analizar imagen con Groq**. PDF.js la renderiza localmente como JPEG; `qwen/qwen3.8-27b` la interpreta con un máximo de **8 peticiones/día por usuario**.
5. El resultado se valida con Zod, se deduplica, se muestra editable y queda en `sessionStorage` de la pestaña. El usuario puede **seleccionar un artículo y tocar su textura en la página renderizada**, creando un pequeño recorte WebP sin llamada adicional de IA. No se guardan materiales sin confirmación humana.
6. Solo al pulsar **Crear artículos seleccionados** se importan candidatos al catálogo existente de Turia en lotes de 20, con inserción idempotente y `coste=0`, `precioFijo=null`, hasta 400 materiales. Las muestras recortadas válidas (WebP, hasta 24 KB por material) se guardan en la tabla de fotografías privadas de D1, accesibles solo con la sesión del panel.

## Condiciones de seguridad y calidad
- PDF local; únicamente texto extraído y, bajo acción expresa, una imagen JPEG se transmiten a Groq. Es importante verificar la licencia del catálogo para ese tratamiento.
- Acceso protegido por Cloudflare Access, sesión, rol y verificación de origen. No disponible en el tenant Baltaretu.
- Los campos procedentes de PDF se tratan como datos no fiables; no pueden ordenar acciones a la IA.
- Nunca cruzar arbitrariamente combinaciones de soporte, espesor y acabado. Los materiales dudosos se corrigen manualmente.
- El color calculado por IA es orientativo. Las **texturas reales pueden recortarse y asociarse manualmente** antes del alta; no se recopilan automáticamente todas las muestras del documento. Verifica el permiso del proveedor antes de reproducir imágenes del catálogo.
- Una petición puede superar la cuota Free real de Groq aun con nuestros límites de aplicación; el flujo se interrumpe con un mensaje claro y conserva los candidatos ya interpretados.
- El navegador debe permanecer abierto durante la extracción. Al recargar se recupera el **borrador de fichas**, pero el usuario debe volver a seleccionar el PDF si quiere visualizar páginas; el PDF no se almacena en servidor.
- Si el PDF tiene muchas páginas, se puede necesitar continuar otro día por las cuotas de Groq Free. No se genera gasto de IA automáticamente al superar el límite.

## Validación
- `npm run lint`, `npm test`, `npm run build:turia`, E2E móvil y accesibilidad.
- Las pruebas de API simulan Groq sin consumir tokens; para validar ONESTA con Groq Free es necesario un entorno autorizado con `GROQ_API_KEY` y control de cuota.
- No realizar cambios directos en D1 remoto; desplegar desde `main` solo tras validar y fusionar PR.
