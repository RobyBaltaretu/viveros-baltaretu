# Dominio: carpintería a medida

> **Hipótesis del sector, no requisitos.** Este documento resume cómo suele trabajar una carpintería a medida. Sirve para diseñar módulos reutilizables. Todo lo que no venga de la especificación de Creaciones Turia hay que validarlo con ella (preguntas T-01 a T-19 de [preguntas.md](preguntas.md)). No contiene datos de Turia: los que falten van como `[PLACEHOLDER]`.

## Qué hace

- Armarios empotrados y vestidores.
- Cocinas.
- Puertas: de paso, correderas y de entrada.
- Escaleras y barandillas de madera.
- Suelos y tarimas.
- Ventanas, contraventanas y persianas de madera.
- Mobiliario: salón, librerías, muebles de TV, cabeceros, escritorios y baño.
- Exterior: pérgolas, porches, cerramientos y mobiliario de jardín.
- Revestimientos y paneles de pared o techo.
- Restauración y reparación.
- Locales comerciales: mostradores y estanterías.
- Reformas con carpintería de obra.

En la plataforma, esto es la lista editable de **tipos de trabajo**. La usan la obra, el formulario web, los servicios de la web y el portafolio.

## Proceso de un trabajo

Contacto → visita y toma de medidas → diseño (planos o render) → presupuesto → aceptación y anticipo → pedido de materiales → fabricación en taller → entrega y montaje → cobro del resto → garantía y postventa.

| Paso | Módulo | Estado de la obra |
| --- | --- | --- |
| Contacto (web, WhatsApp o teléfono) | `presupuestosWeb` (petición), `whatsapp` | — |
| Visita y medidas | `agenda`, `obras` (hoja de medidas) | visita pendiente → medidas tomadas |
| Diseño | `obras` (documentos y fotos) | diseño |
| Presupuesto | `presupuestosCliente` | presupuesto enviado |
| Aceptación y anticipo | `presupuestosCliente` → `facturas` (factura de anticipo) | aceptada |
| Pedido de materiales | `pedidosProveedor`, `materiales`, `proveedores` | en fabricación |
| Fabricación | `obras` | en fabricación → lista para montaje |
| Entrega y montaje | `agenda` | montada → entregada |
| Cobro del resto | `facturas` | entregada |
| Garantía y postventa | `obras` (incidencias) | cerrada |

El presupuesto siempre se liga a una **obra**, es decir, a un trabajo concreto en una dirección del cliente.

## Entidad central: la obra

Una obra tiene un cliente, una dirección, un tipo de trabajo, un estado y fechas. De ella cuelgan:

- visitas y medidas;
- presupuestos;
- pedidos a proveedor;
- gastos;
- facturas;
- fotos y documentos;
- incidencias.

Con esos datos se calcula el **resumen económico**: presupuestado, facturado, cobrado, gastado (pedidos y gastos) y **margen**.

## Materiales y componentes

| Categoría | Ejemplos | Atributos propios |
| --- | --- | --- |
| Tableros | Aglomerado, melamina, MDF, MDF lacado, contrachapado, alistonado, fenólico/HPL | Textura, color, espesor (mm), formato de placa |
| Maderas macizas | Roble, nogal, pino, castaño, haya, iroko, fresno | Espesor, sección, calidad |
| Chapas naturales | Roble, nogal… | Corte, espesor |
| Acabados | Lacado mate o brillo, barniz, aceite, tinte, laminado | Color (RAL o NCS), brillo |
| Cantos | PVC, ABS, chapa | Ancho, espesor, color |
| Herrajes | Bisagras, guías y correderas, cierres suaves, tiradores, perfiles, barras | Medida, referencia, acabado |
| Cristal y espejo | — | Espesor, tipo |
| Iluminación LED | — | Potencia, temperatura de color, longitud |
| Encimeras | — | Material, espesor, fondo |
| Accesorios interiores | Cajoneras, zapateros, pantaloneros | Medida, referencia |
| Consumibles | Colas, tornillería, lijas | Unidad |

La jerarquía del cliente es categoría > tipo (interior o exterior) > frontal o trasero > nombre, textura, color y espesor. Encaja con tableros y chapas.

«Frontal / trasero» es ambiguo (pregunta T-01). Se modela como **ubicación de uso**, que es opcional: herrajes y consumibles no la necesitan.

Por eso el modelo de material tiene unos campos comunes y unos **atributos adicionales que declara cada categoría** (nombre, tipo de dato y unidad):

- Comunes: nombre, textura, color, espesor, unidad, proveedor habitual, coste interno, referencia, visible en la web y en el simulador, e imagen de la muestra.
- Por categoría: los atributos adicionales de la tabla de arriba.

## Documentos

| Documento | Contiene | Para terceros |
| --- | --- | --- |
| Presupuesto | Cliente, obra, líneas, extras, IVA, total, anticipo y restante | Sí. Sin costes internos. |
| Hoja de medidas | Por mueble o estancia: ancho, alto, fondo, observaciones y fotos | Interna o para el cliente |
| Pedido a proveedor | Material, referencia, medidas, cantidad y notas | Sí. **Nunca lleva precios internos.** |
| Factura y factura de anticipo | Las mismas reglas que hoy (emitida inmutable, rectificativas, numeración correlativa y huella) | Sí. No es VeriFactu. |
| Albarán de entrega y hoja de garantía | Opcionales | Por valorar (T-10) |

## Garantía y postventa

Las incidencias se registran por obra y por fecha de entrega. El **plazo de garantía no se fija en el código**: lo confirma el propietario con su asesor (T-11).

## Web del sector

Secciones habituales:

- Inicio y portafolio.
- Servicios, con una página por servicio y SEO local.
- Materiales y acabados: muestrario público con los materiales marcados como visibles.
- Cómo trabajamos (el proceso), y Taller y nosotros.
- Simulador.
- Pedir presupuesto, en modo proyecto a medida.
- Opiniones y preguntas frecuentes.
- Guías («cómo medir tu armario», «cuidado de la madera»).
- Zona de trabajo y contacto con WhatsApp.
- Legales.

Datos estructurados: `LocalBusiness` (o un subtipo como `HomeAndConstructionBusiness`) y `Service`. Nunca llevan datos en `[PLACEHOLDER]`.

En la plataforma, los tipos de contenido se guardan en las colecciones físicas que ya existen ([D-03](discrepancias.md)):

| Tipo | Colección física |
| --- | --- |
| Proyecto | `proyectos` |
| Servicio | `catalogo` |
| Proceso, nosotros, FAQ y opiniones | `paginas` |
| Guías | `guias` |
| Empresa y portada | `ajustes` |
| Muestrario | Materiales con `visible` (D1 privado, publicado en el build) |
