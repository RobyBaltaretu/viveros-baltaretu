# Turia Studio — especificación profesional por categoría (PR #121)

Estado: contrato funcional propuesto; **no equivale a funcionalidad implementada**. Debe validarse en navegador móvil, API y con fotografías reales antes de liberar.

## Investigación de mercado y criterios adoptados
- Coohom Kitchen & Bath: mobiliario paramétrico, armarios a medida, visualización y continuidad hasta presupuesto/pedido. Fuente: https://www.coohom.com/helpcenter/coohom-kitchen-bath-platform-overview?hl=es
- Planner 5D / Homestyler: configuración espacial, materiales y vista de revisión, distinguiendo diseño geométrico de edición de fotografías. Fuentes: https://planner5d.com/ y https://www.homestyler.com/
- REimagineHome: edición fotográfica y cambios dirigidos. Fuente: https://www.reimaginehome.ai/
Estas referencias inspiran requisitos propios; no se afirma equivalencia técnica ni precisión dimensional de sus algoritmos.

## Flujo obligatorio
1. Foto: subida, orientación correcta, vista previa y máscara opcional. La máscara debe poder marcar el mueble a sustituir; fuera de ella, conservar.
2. Categoría: una de cocina, armario, vestidor, puertas, salón, baño, oficina o lavadero. Sin categoría válida, bloquear el avance; jamás asumir cocina.
3. Configuración: preguntas dinámicas por categoría, con defaults explícitos y edición accesible.
4. Materiales: seleccionar exclusivamente materiales compatibles del catálogo activo; mostrar nombre, acabado, textura disponible y aplicación (estructura, frentes, encimera). No ofrecer pavimento o encimera para armario.
5. Revisión: resumen legible de categoría, dimensiones introducidas, opciones, materiales y elementos que no deben cambiar; posibilidad de volver atrás sin perder datos.
6. Generación: una llamada a Gemini tras confirmar. Conservar original y resultado, sin autorreintentos de pago.
7. Validación del resultado: permitir rechazo por categoría incorrecta, geometría cambiada o materiales no respetados; marcar la simulación como propuesta visual, no plano constructivo.
8. Guardar/continuar: proyecto con configuración y referencias de materiales; enlace a presupuesto con cantidades **revisadas por el carpintero**, nunca deducidas de la imagen.

## Configuración por categoría
| Categoría | Decisiones obligatorias | Materiales y zonas válidas | Invariantes visuales |
| --- | --- | --- | --- |
| Cocina | distribución; frentes; tiradores; equipamiento; fregadero; protección frontal | módulos superiores/inferiores, encimera, suelo, LED si se elige | conservar instalaciones y electrodomésticos no seleccionados |
| Armario | empotrado/exento; abatible/corredera/plegable; interior; frente ciego/espejo/cristal | estructura, frentes e interior | no convertir en cocina; conservar hueco, altura y paredes |
| Vestidor | lineal/L/U; abierto/cerrado; barras, cajones, baldas y zapatero | módulos, frentes y accesorios | conservar circulación y huecos |
| Puertas | abatible/corredera vista/empotrada; una/dos hojas; ciega/acristalada; marco | hoja, marco, molduras | no alterar tabiques ni abrir nuevos huecos |
| Salón | suspendido/suelo/mixto; puertas/cajones/estantes; cables; ventilación | estructura, frentes y baldas | mantener TV, conexiones y objetos fuera de selección |
| Baño | suspendido/suelo; tipo lavabo; cajones/puertas; espejo | mueble y encimera compatibles | conservar fontanería y sanitarios |
| Oficina | escritorio/estantería/mixto; abierto/cerrado/cajones; cables | estructura, frentes y baldas | conservar huecos y ergonomía por verificar |
| Lavadero | electrodomésticos conservados/columna/paralelo; limpieza/ropa; ventilación | armarios y encimera compatible | conservar tomas, ventilación y electrodomésticos |

## Reglas de dominio
- El servidor es autoridad para validar categoría, opciones, zonas y materiales; ignorar campos ocultos enviados por un cliente antiguo.
- El prompt debe nombrar **objeto concreto** y acciones permitidas; prohibir transformaciones a otra categoría y preservar cámara, paredes, puertas, ventanas y elementos no seleccionados.
- Separar «cambiar acabados», «modificar frentes/interior» y «cambiar distribución»; esta última requiere medidas aportadas y confirmación adicional.
- Para muebles de madera, permitir elección diferenciada de estructura, puertas y cajones; nunca etiquetar genéricamente todo como «muebles superiores/inferiores».
- Al cambiar de categoría, borrar opciones incompatibles, conservar foto y materiales compatibles, y actualizar resumen/presupuesto.
- No prometer fidelidad dimensional ni detección automática fiable de medidas a partir de una foto.
- Una validación visual adicional con IA es opcional y **no debe ejecutarse automáticamente** mientras implique coste; primero controles deterministas y revisión humana.
- Cuota D1, secreto de Gemini en Worker y un único intento por acción explícita del usuario; sin nuevos proveedores de pago.

## Aceptación / regresiones
- Armario seleccionado con foto de armario: petición, prompt, revisión y resultado se refieren a armario; no aparecen opciones de cocina.
- Categoría inválida: HTTP 400; no invocar Gemini ni consumir cuota.
- Cambio cocina → armario → cocina: se actualizan campos, materiales y zonas sin arrastrar valores incompatibles.
- Todos los perfiles: snapshot de campos, restricciones de zonas y prompt específico.
- iPhone Safari: selección de categoría, navegación de pasos, máscara táctil, guardado/recuperación de borrador.
- Confirmación del carpintero antes de presupuesto; no inferir medidas, cantidades ni viabilidad técnica.
- CI: tests unitarios y E2E. Validación visual manual con al menos una foto real por categoría antes de fusión.

## Fases de entrega
P0: corrección de categorías/prompt, formularios por tipo y validación del servidor (PR #121).
P1: editor de decisiones por categoría, validaciones completas, resumen y pruebas E2E móvil.
P2: control visual de calidad, historial de variantes y enlace enriquecido a presupuesto.
P3: modo geométrico paramétrico opcional basado en medidas, separado de la simulación fotográfica. No equiparar con CAD sin motor geométrico real.
