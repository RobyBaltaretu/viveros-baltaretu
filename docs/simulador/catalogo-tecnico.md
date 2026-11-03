# Catálogo técnico y perfiles: trabajo en curso

Se han implementado perfiles diferenciados para cocina, baño, armario, vestidor, puertas, salón, oficina y lavadero. Las opciones se validan en servidor y solo se transmiten las opciones pertenecientes al perfil elegido. Son decisiones funcionales de diseño, no instrucciones normativas de fabricación o instalación verificadas por fabricante.

El artículo admite una ficha visual opcional (`visual`) en su JSON existente, sin migración: fabricante, colección, código de decor, fuente HTTPS, textura HTTPS, color hexadecimal, escala física, dirección de veta, brillo, soporte, aplicaciones, tipos de reforma, uso en humedad, licencia y fecha de verificación. Se conserva al editar y persistir el artículo. La textura es metadato referenciado; todavía NO se envía su imagen a Gemini. Una descripción textual no equivale a una muestra visual.

## Bloqueo de investigación y recursos reales

Se intentaron consultas directas a:
- https://www.egger.com/en/furniture-interior-design/decors/H1180_37
- https://www.blum.com/us/en/products/boxsystems/legrabox/programme/
- https://www.cosentino.com/colors/dekton/
- https://www.finsa.com/en/fibracolour

En los cuatro casos el proxy rechazó el túnel HTTPS con `403 Forbidden`. No se han podido verificar productos, descargar texturas ni consultar condiciones de uso; no se han importado ni etiquetado como reales los materiales sintéticos existentes.

Se guardó una ampliación del borrador de red para www.egger.com, egger.com, www.blum.com, www.cosentino.com, www.finsa.com y ai.google.dev, preservando los presets existentes. El guardado del borrador no activa el acceso: se debe revisar y guardar en los ajustes y publicar el entorno. Después hay que reintentar las consultas y, si las páginas usan CDN adicionales, identificar sus dominios mediante respuestas reales.

## Pendiente para completar el objetivo

1. Investigar fichas y guías accesibles por categoría y documentar las fuentes efectivamente consultadas.
2. Verificar referencias de productos y derechos de uso de cada muestra; importar texturas y escalas auténticas con trazabilidad, sin atribuir stock ni precios no publicados.
3. Pasar las imágenes de muestra verificadas como referencias multimodales a Gemini junto a la foto y máscara. Validar tamaño, MIME, derechos y destinos sin descargar URLs arbitrarias.
4. Verificar en navegador el filtrado de aplicaciones y acabados y realizar la prueba fotorrealista con credenciales y consumo autorizados.

Este trabajo no se considera un simulador terminado ni un catálogo real verificado.

## Escenario local actualizado

El escenario reemplaza los datos identificados como pruebas por clientes y proyectos ficticios del taller, presupuestos, facturas, gastos y pedidos vinculados. Los 30 materiales de muestra incluyen una ficha visual de demostración y un color digital aproximado; no son referencias ni texturas verificadas de fabricante. Se cargó en la D1 local de Turia mediante la interfaz «Datos de prueba». El escenario se puede volver a cargar o eliminar desde esa pantalla y no requiere llamar a Gemini.
