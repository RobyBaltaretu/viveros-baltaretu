# Turia Studio — Boceto a simulación (rama de desarrollo)

**Estado:** Fase 0 auditada parcialmente; contrato de dominio inicial implementado. **NO** es una funcionalidad completa ni lista para cliente. No desplegar a producción.

## Decisiones de producto confirmadas
- Entradas: foto del espacio vacío + foto de boceto a mano alzada; opcionales perspectivas adicionales.
- Medidas mixtas: exactas, aproximadas y desconocidas, con origen y confirmación.
- Fidelidad alta a módulos, distribución y obstáculos; render comercial no es plano técnico.
- Acabados por pieza vinculados a variantes reales del catálogo.
- Más de 30 renders mensuales: medición de coste, límites y no repetir interpretaciones.
- Preservar modo anterior y aislamiento de Baltaretu.

## Hallazgos verificados en main (fase 0)
- `src/pages/panel/simulador.astro`: Turia Studio actual usa pasos Espacio/Materiales/Revisar, una foto y máscara opcional, catálogo de materiales y cuota.
- `src/pages/api/panel/simulador.ts`: recibe `image`, `mask`, `config`; valida sesión, catálogo y llama a `simular`. No recibe boceto ni geometría por piezas.
- `src/server/simulador/cuota.ts`: reserva cupo D1 antes de generar, valida imágenes y usa Gemini. Tope presupuestado de 1000 céntimos/mes a 20 céntimos reservados por simulación; no es contabilidad real de gasto.
- `wrangler.creacionesturia.jsonc`: binding R2 privado está configurado en entorno local; comentario indica que en producción está desactivado. **Bloqueante** para almacenamiento privado de originales y renders en producción hasta verificar binding real.
- `docs/simulador/especificacion-estudio-profesional.md`: contrato anterior por categoría, preservar instalaciones, presupuesto solo con cantidades revisadas. No confundir especificación con código funcional.

## Arquitectura objetivo
1. Subir y validar dos imágenes de forma segura (formato, MIME real, tamaño, orientación y acceso por tenant). Persistencia privada R2 cuando esté habilitada.
2. Interpretar con modelo multimodal y JSON tipado; extraer módulos, piezas, cotas, obstáculos, preguntas y evidencias. No inventar medidas.
3. Confirmar con el carpintero mediante alzado SVG editable y anotaciones; registrar versiones e identidad de quien valida.
4. Asignar materiales y acabados a cada pieza mediante referencias de variantes activas del catálogo; servidor verifica compatibilidad.
5. Marcar polígono de instalación en foto; construir composición geométrica determinista y enviarla como guía a un proveedor de edición de imágenes.
6. Generación asíncrona idempotente, sin reintentos automáticos que dupliquen cargos; vista previa y render final, versiones, telemetría de coste.
7. Guardar en Proyectos/Simulaciones; presupuesto con cantidades confirmadas, nunca inferidas del render.

## Plan por fases y puertas de calidad
- **F0 — Auditoría/PoC:** inventario real de APIs, D1, R2, UI y modelo IA; pruebas con las dos imágenes reales y otras 5–10 parejas. Medir fidelidad y coste.
- **F1 — Persistencia:** esquema D1 versionado para proyecto, imagen, interpretación, módulo, pieza, material, generación y estado; R2 privado y autorización tenant; migraciones aditivas.
- **F2 — Interpretación/UX:** adaptador IA estructurado, validación de cotas, alzado 2D editable, confirmación humana y manejo de ambigüedades. iOS Safari.
- **F3 — Catálogo:** selección por pieza, restricciones de soporte/formato/acabado, veta/canto y sustitución de variantes inactivas.
- **F4 — Render:** máscara/área de instalación, geometría guía, edición fotográfica, preservación de entorno, cuota real y trabajo persistente.
- **F5 — Integración/QA:** versiones, antes/después, guardado y presupuesto, unitarios/E2E, regresión de flujo anterior, accesibilidad y pruebas reales.

## Riesgos y condiciones
- Una sola foto no da profundidad métrica fiable; solicitar al menos una cota de referencia y validar la colocación.
- No generar geometría de fabricación a partir de una imagen fotorrealista.
- No afirmar que el modelo de Gemini actual admite edición multiimagen hasta comprobar API y resultados.
- No añadir servicios de pago sin autorización; presupuesto de 10 EUR/mes requiere medir precios reales y reintentos.
- La foto de ejemplo contiene anotaciones rojas que deben ignorarse; el boceto en papel es la fuente de distribución.
- No fusionar a main ni desplegar sin pruebas y aprobación.

## Estado de implementación
- [x] Rama aislada creada desde main.
- [x] Contrato tipado de módulos/piezas/cotas/obstáculos e invariantes de validación.
- [x] Pruebas unitarias del contrato añadidas (**pendientes de ejecución en CI**).
- [x] Migración D1 v18: bocetos, revisiones, referencias a archivos y generaciones.\n- [x] API de borradores con sesión, aislamiento de tenant y revisión optimista.\n- [x] API de subida y lectura de imágenes privadas en R2, bloquea cuando falta binding.\n- [x] Pantalla experimental para crear borrador, subir dos fotografías y guardar una cota manual.\n- [ ] Interpretación IA real, editor geométrico completo, render, integración comercial y E2E.\n- [ ] Ejecutar build, typecheck y tests: **NO verificados**.\n- [ ] Revisar UX: creación inicial guarda identificadores temporales de fotografías hasta que se suben; no permitir validación/render hasta completar ambas subidas.\n- [ ] Revisar almacenamiento: reconciliación de objetos R2 huérfanos y límite agregado de cuota.
