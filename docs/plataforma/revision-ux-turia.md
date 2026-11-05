# Creaciones Turia: revisión de experiencia de uso

Fecha: 2026-11-05. Objetivo del propietario: «una app con una experiencia de usuario excelente, tanto como para que un usuario sin conocer la app sepa utilizarla desde el día 1».

Método: capturas de las 17 pantallas principales en móvil (Pixel 7) y escritorio (1440 px), con la cuenta vacía y con los datos de prueba, revisadas con los principios de diseño de interfaz de Emil Kowalski (respuesta inmediata, movimiento con propósito, detalles invisibles que suman).

## Qué ya estaba bien
- Una tarea por pantalla, textos en español llano, controles de 48 px, migas de pan y un «Crear» siempre a mano.
- Listas con «Siguiente paso» (presupuestos) y cifras que llevan a su sección.
- Lector de tickets con una acción principal clara.

## Fase 1 (este PR)

| Antes | Después | Por qué |
| --- | --- | --- |
| Una cuenta nueva llega a un inicio con cifras a cero y nada que la guíe | «Primeros pasos»: 5 pasos en orden (datos de la empresa, primer cliente, catálogo, primer presupuesto, primer ticket), con barra de progreso, el siguiente paso destacado y «Empezar» | El primer día se aprende haciendo; la guía desaparece sola cuando todo está hecho |
| Foto decorativa de 280 px arriba del inicio | Saludo compacto (168–184 px en escritorio, 88 px en el móvil) | La foto acompaña; el trabajo del día sube a la primera pantalla |
| «Por hacer» al final del inicio, 8 filas con un botón «Ver» cada una | «Por hacer» arriba, 5 filas que se pulsan enteras y «Ver N más» plegable | Objetivo táctil grande y sin 8 botones iguales compitiendo |
| «Asistente IA» en la barra, «Gubia» en «Más» | «Asistente Gubia» en la barra | Una cosa, un nombre |
| «Compras y gastos» en la barra, «Gastos» en el título y en «Más» | «Gastos» en todas partes | Igual |
| «Documentos» en la barra del móvil, «Ventas» en «Más» | «Ventas» | Igual |
| «Studio · Bocetos» y «Simulador IA» en el menú, ambos con el título «Turia Studio» | «Diseñar con boceto» y «Probar acabados», con títulos que coinciden | Dos herramientas distintas no pueden llamarse igual; el nombre dice qué hace |
| Catálogo: 4 botones apilados en la cabecera y un botón principal en cada tarjeta | «Nuevo artículo» como acción principal, «Nuevo trabajo» secundaria, lo raro en «Más acciones»; «Calcular el precio» en secundario | Una sola acción principal por pantalla: el ojo sabe dónde ir |
| Buscar en presupuestos y facturas exigía pulsar «Buscar» y recargar | La tabla se filtra al escribir (sin tildes ni mayúsculas) y avisa «N resultados» al lector de pantalla; el botón sigue para buscar en todas las pestañas | Respuesta inmediata; funciona igual sin JavaScript |
| `:active` con `scale(0.97)` sin transición en dos botones; el resto sin respuesta al pulsar | `scale(0.97)` en todo lo que se pulsa (botones, tarjetas, filas, accesos), con `transform 160ms cubic-bezier(0.23, 1, 0.32, 1)` | La interfaz confirma que ha oído el toque |
| Menús «Crear» y «Mi cuenta» aparecían de golpe | Escritorio: caen desde «Crear» (`transform-origin: top right`, `scale(0.96)` y opacidad, 220 ms). Móvil: hoja que sube desde abajo (curva de cajón, 320 ms). Salida más rápida que la entrada | Movimiento con origen: se entiende de dónde sale el menú |
| Cambios de color de golpe en filas, pestañas y menú lateral | Solo color, 120 ms, sin movimiento | Se usan decenas de veces al día: nada de animaciones que frenen |
| `prefers-reduced-motion` dejaba las transiciones en 0,01 ms | Sin escalas ni desplazamientos, pero los fundidos se quedan (120 ms) | Menos movimiento no es ningún movimiento: el fundido ayuda a entender el cambio |
| Variación de cifras «↓ −100 %» sin contexto | «↓ −100 % que el mes anterior» | Una cifra sin referencia asusta |

Hover solo con ratón (`@media (hover: hover) and (pointer: fine)`), nunca `transition: all`, y solo `transform`, `opacity` y colores.

## Fase 2

| Antes | Después | Por qué |
| --- | --- | --- |
| Nuevo presupuesto y factura en el móvil: un formulario larguísimo (cliente, líneas, anticipo, pago, notas) | Tres pasos (Cliente → Trabajos/Conceptos → Condiciones/Total y pago) con guía numerada arriba y una barra fija abajo con «Atrás», el total con IVA en vivo y «Siguiente: …». Si el servidor devuelve un error, se abre el paso del campo. En escritorio, todo junto como antes | Una cosa cada vez en una pantalla pequeña, y el total siempre a la vista |
| Listas vacías: una línea de texto y, encima, un buscador que no busca nada | Dibujo, título, para qué sirve y el botón que la llena (presupuestos, facturas, clientes, pedidos y proveedores); sin buscador hasta que hay algo | Lo primero que ve una persona nueva le dice qué hacer |
| «Guardado» como franja en lo alto de la página, que empuja el contenido | Aviso flotante abajo: entra desde abajo, se va solo a los 6 s, se para al pasar el ratón, con el foco o con la pestaña oculta, y se cierra con «×». Los errores siguen junto al formulario | La confirmación se ve sin mover la pantalla |
| Conceptos de oficio sin explicar (escandallo, variantes, extra, anticipo, rectificativa) | «¿Cómo funciona…?» plegable en el catálogo, el presupuesto y la factura emitida; recuerda si lo dejaste abierto | Ayuda donde hace falta, sin estorbar a quien ya lo sabe |
| Primera visita sin presentación | Bienvenida de tres pantallas (qué es, el botón «Crear», el asistente Gubia), con «Saltar», puntos de progreso y anuncio para lector de pantalla; sale una vez por navegador (`?bienvenida=1` la vuelve a enseñar) | Orientación de 20 segundos el primer día |

Guardar sigue siendo un envío normal del formulario (la página se carga de nuevo con el aviso): hacerlo sin recargar exigiría reescribir cada guardado en el servidor y se deja para más adelante si hace falta.

Detalles: la bienvenida escala desde el centro (diálogo, `scale(0.96)` y opacidad); los pasos entran con un desplazamiento corto (220 ms, ease-out); con «reducir movimiento», solo fundidos. Las pruebas de pantalla de presupuesto y factura recorren los pasos en el móvil (`tests-e2e-turia/pasos.ts`) y hay una nueva, `rediseno.spec.ts`.

## Pendiente (propuestas)
1. Guardar sin recargar (presupuesto, factura, cliente) con el aviso flotante.
2. Gastos, portafolio y catálogo (familias, variantes) con el estado vacío nuevo.
3. Pedido de material por pasos en el móvil, como presupuesto y factura.
