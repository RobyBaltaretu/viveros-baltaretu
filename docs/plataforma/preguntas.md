# Preguntas abiertas

Cada pregunta trae una **recomendación por defecto**. Mientras no haya respuesta se trabaja con ella, y la respuesta se anota aquí con su fecha. Las preguntas a Creaciones Turia están en la sección B, para la reunión de validación.

## A · Para el propietario de la plataforma

| # | Pregunta | Por defecto | Bloquea |
| --- | --- | --- | --- |
| P-01 | Con 10 bases de D1 por cuenta en el plan gratuito ([D-02](discrepancias.md)), ¿qué hacemos a partir del cliente 9? | Workers Paid cuando lo paguen las suscripciones. Mientras tanto, una sola cuenta. | Cliente 9 |
| P-02 | ¿Cómo se reparte el cupo de Workers AI entre clientes ([D-12](discrepancias.md))? | Baltaretu conserva 7.000 neuronas al día mientras sea el único con IA. Después, un tope por cliente en su configuración (por ejemplo, 2.000 para Turia), con un aviso en el panel al llegar al 80 %. | 3.11 y 4.3 |
| P-03 | Antes de la primera migración nueva, ¿haces la exportación completa con `wrangler d1 export` además de `contenido:copia` ([D-04](discrepancias.md))? | Sí, guardada fuera del repositorio. | La PR con la migración 10 |
| P-04 | Para enviar presupuestos por correo al cliente final, el plan gratuito de Email Service no sirve ([D-13](discrepancias.md)). ¿Basta con abrir el correo de la persona (mailto) y compartir por WhatsApp? | Sí: mailto y WhatsApp, con el PDF descargado. | 3.1 |
| P-05 | ¿Nombre del Worker, de la D1 y dominio de Turia? | Worker `creaciones-turia`, D1 `creaciones-turia` y dominio `[PLACEHOLDER]`. | 1.1 (solo la semilla) |
| P-06 | ¿Arreglamos el formato de la PR 60 en una PR de estilo ([D-15](discrepancias.md))? | Sí, sin añadir configuración de Prettier. | Nada |
| P-07 | ¿Se puede permitir `developers.cloudflare.com` en la red de las sesiones, para citar las cifras desde la fuente? | Sí. Mientras tanto, las cifras van «por confirmar». | Decisiones de escala |
| P-08 | ¿Quién tiene acceso a Cloudflare Access para el panel de Turia? ¿El mismo equipo de Access con otra aplicación? | Una aplicación de Access por cliente dentro del mismo equipo. | 3.1 en producción |
| P-09 | El nombre del asistente: Baltaretu tiene «AgricolAI». ¿Y Turia? | `[PLACEHOLDER]`; mientras tanto, «Asistente». | 3.11 |
| P-10 | ¿Planes de suscripción (qué módulos entran en cada uno)? | Un solo plan con módulos por cliente; el campo `plan` se guarda, pero no decide nada todavía. | 5.x |

## B · Para validar con Creaciones Turia

Salen de [dominio-carpinteria.md](dominio-carpinteria.md). Son hipótesis del sector: no son requisitos hasta que Turia las confirme.

| # | Pregunta | Por defecto |
| --- | --- | --- |
| T-01 | «Frontal / trasero» en los materiales: ¿son las dos caras de un tablero, o las piezas vistas frente a fondos y traseras del mueble? | Se modela como **ubicación de uso** (frontal = pieza vista, trasero = fondo o trasera) y admite estar vacío. |
| T-02 | ¿Qué trabajos hacéis de verdad (armarios, vestidores, cocinas, puertas, escaleras, suelos, exterior, mobiliario, locales, restauración…)? | La lista completa como «tipos de trabajo», editable. |
| T-03 | ¿Las categorías de materiales son las del documento o queréis otras? ¿Qué campos necesita cada una (herrajes: medida, referencia, acabado)? | Tableros, macizas, chapas, acabados, cantos, herrajes, cristal y espejo, iluminación, encimeras, accesorios y consumibles, con atributos propios por categoría. |
| T-04 | ¿Trabajáis siempre por obra (cliente y dirección)? ¿Un presupuesto puede no tener obra? | Todo presupuesto lleva obra; se crea en el mismo paso si no existe. |
| T-05 | Anticipo: ¿qué porcentaje soléis pedir? ¿Emitís factura de anticipo? | 40 % propuesto y editable en cada presupuesto; botón «Factura de anticipo». |
| T-06 | Validez de un presupuesto: ¿cuántos días? | 30 días, editable. |
| T-07 | ¿Cuándo cuenta un presupuesto como «sin respuesta» para el aviso? | 15 días después de enviarlo. |
| T-08 | ¿Series de numeración (presupuestos y facturas)? ¿Una por año? | `P2026-0001` y `F2026-0001`, correlativas por año, como en Baltaretu. |
| T-09 | Formas de pago habituales y plazos con proveedores. | Transferencia, Bizum, efectivo y tarjeta; plazo en días. |
| T-10 | ¿Necesitáis albarán de entrega y hoja de garantía? | Fuera de la primera versión; se valoran tras 3.9. |
| T-11 | Garantía: ¿qué plazo aplicáis? (lo confirma vuestro asesor; no lo fijamos nosotros) | `[PLACEHOLDER]`; las incidencias se registran sin plazo calculado. |
| T-12 | ¿Qué fotos van en el presupuesto (del espacio, renders, muestras)? | Hasta 6 fotos opcionales por presupuesto. |
| T-13 | Pedido a proveedor: ¿el pedido lleva referencias del proveedor o solo nombre, medida y cantidad? | Nombre, referencia (si la hay), medida, color y espesor, cantidad y notas. Nunca un precio interno. |
| T-14 | Agenda: ¿la lleváis varias personas? ¿Necesitáis exportarla al móvil? | Una sola agenda con exportación ICS. |
| T-15 | Web: ¿zona de trabajo (localidades) y servicios con página propia? | Una página por servicio y la provincia de Valencia como zona, `[PLACEHOLDER]` hasta que lo confirméis. |
| T-16 | Portafolio: ¿tenéis fotos de antes y después? ¿Con permiso de los clientes? | Solo se publican proyectos con `revisado: true` y con permiso confirmado. |
| T-17 | Simulador: ¿qué muebles primero (armario empotrado, vestidor, cocina)? ¿Qué opciones (material, color, acabado, tirador, distribución)? | Armario empotrado, con material, color, acabado y tirador. |
| T-18 | Textos legales, datos fiscales, logotipo, colores y tipografías. | `[PLACEHOLDER]` hasta recibirlos. Los legales los revisa un asesor. |
| T-19 | ¿Margen por obra con coste de materiales, gastos y horas? ¿Apuntáis horas? | Materiales (pedidos) + gastos de la obra; sin horas en la primera versión. |
