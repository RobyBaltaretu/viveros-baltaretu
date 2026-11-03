# Simulador del taller

La implementación anterior ya reduce fotos a 1024 px, permite máscara con pincel/rectángulo, compone el resultado para conservar los píxeles externos, compara antes/después y limita el consumo mensual con reserva atómica. Usaba materiales estáticos.

Esta revisión carga artículos activos del catálogo (maderas, tableros, chapas, acabados y encimeras), conserva la selección independiente superior/inferior y valida los identificadores contra el catálogo actual en el servidor. No envía costes, márgenes ni proveedor a Gemini. Un material archivado deja de ser seleccionable. Las muestras de color son orientativas; el catálogo no incluye fotos ni stock.

Se añaden ancho, alto y fondo en centímetros, puertas y cajones, distribución, apertura, acabado y orientación de veta. Se mantiene la selección por zonas, techo, frontal e iluminación. Las medidas desconocidas quedan vacías. Son instrucciones visuales, no un plano de fabricación. Antes de contratar hay que verificar instalaciones, huecos, holguras, humedad, compatibilidad de materiales y medición in situ. No se calcula un presupuesto desde píxeles.

Investigación: README oficial de Google Gen AI consultado en https://github.com/googleapis/python-genai (entrada multimodal y generación de imágenes). Las páginas de Google AI y Blum devolvieron HTTP 403 desde este entorno; no se presentan como fuentes consultadas. La API existente de Gemini se conserva. La generación real depende de la clave del Worker y de su cuota; las pruebas usan respuestas controladas, sin gasto real.

Validación: lint sin errores y build de Turia correctos. Tests de reconstrucción del catálogo y validación de medidas/opciones. La generación de imagen se prueba con proveedor simulado; no se ha comprobado una llamada de pago a Gemini. Pendientes para futuras iteraciones: fotografías o texturas de fabricante vinculadas a artículos, existencias y ficha persistente/versionada del proyecto. El catálogo actual aporta identificación y acabado, no esas capacidades.

## Turia Studio: revisión de usabilidad

El formulario se divide en Espacio, Diseño, Materiales y Revisar. La foto cargada se refleja en el área de trabajo; la máscara y el comparador existentes se conservan. Búsqueda de materiales, resumen de decisiones y borrador explícito en el dispositivo (sin guardar fotografías). En móvil, vista previa arriba y pasos accesibles; no se ofrecen controles de 360° ni renders tridimensionales que la aplicación no implementa.

Desde Datos de prueba se carga ahora el escenario ampliado de Turia: 15 clientes, 20 presupuestos en distintos estados, 41 facturas repartidas en seis meses, 29 gastos, 30 materiales adicionales con referencias y precios, 8 pedidos relacionados y los 3 proyectos de portafolio existentes. Los materiales y contactos son ficticios e identificados; no representan disponibilidad real. Los registros usan prefijos de prueba y la limpieza existente. No hay llamadas de pago a IA para crear esta demostración.
