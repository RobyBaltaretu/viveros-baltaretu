# Criterios de aceptación — fase 3 / Creaciones Turia

## Matriz de verificación visual
Revisar en 375 × 812 px, 390 × 844 px, 768 × 1024 px y 1440 × 900 px; teclado y zoom 200 %. Evidencias requeridas: captura, resultado axe y recorrido funcional. No marcar como completado sin ejecutar.

- Inicio: KPIs sin truncar, tareas con CTA, accesos correctos según rol.
- Clientes: alta/edición, búsqueda, estados vacíos y errores.
- Presupuestos: tabla y ficha responsive, aceptación explícita y recuperación de contexto.
- Facturas: borrador, emisión, anticipo, final, rectificativa, cobro y reversión.
- Gastos: subida móvil, ticket/OCR, confirmación, gasto sin proveedor y conciliado.
- Proveedores y pedidos: formularios, recepciones, coste, vínculos y permisos.
- Catálogo, obras y agenda: listados, filtros, fichas, acciones y estados vacíos.
- Portafolio: cuadrícula, imágenes con texto alternativo, antes/después, edición móvil.
- Simulador y asistente: cuota, errores, límites de carga, cancelación y teclado.
- Informes: periodos, tablas legibles, estados sin datos, coherencia de KPIs.
- Navegación: sidebar escritorio, barra inferior móvil, botón crear y rutas activas.

## Requisitos de datos de prueba
- Entorno preview con Worker, D1, secretos y Cloudflare Access independientes.
- Validación automática del nombre e ID de D1 para impedir reset de producción.
- Backup y restauración probados antes del borrado.
- Fixtures deterministas y relacionales, con cobertura de estados y situaciones límite.
- Seis imágenes individuales JPG/WebP de proyectos ficticios; indicar claramente que son visualizaciones de demostración, no trabajos ejecutados.
- No copiar ni exponer datos reales. No mezclar datos ficticios con producción.

## Estado comprobado
La rama implementa cambios de identidad, responsive y accesibilidad base. La cobertura visual completa, la carga de datos, los seis archivos de portafolio y el despliegue preview siguen pendientes de verificación; este checklist no certifica su ejecución.
