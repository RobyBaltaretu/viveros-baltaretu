import { TEMAS, type Tema } from '../server/panel/ayuda.ts';

/**
 * Ayuda de la carpintería (Turia): las mismas reglas que la del vivero (pasos
 * cortos, con el nombre exacto de cada botón), pero con sus pantallas. La del
 * vivero sigue en src/server/panel/ayuda.ts.
 */
const comun = (id: string) => TEMAS.find((t) => t.id === id)!;

export const TEMAS_TALLER: Tema[] = [
  comun('entrar'),
  {
    id: 'empezar',
    titulo: 'Empezar el primer día',
    pasos: [
      'En «Inicio» tienes «Primeros pasos»: datos de la empresa, primer cliente, catálogo, primer presupuesto y primer ticket. Pulsa «Empezar» en el siguiente que toque.',
      'Los datos de la empresa (razón social, NIF y dirección) salen en cada presupuesto y factura: complétalos antes de emitir la primera factura.',
      'El botón «+» (abajo en el móvil, «Crear» arriba en el ordenador) hace un presupuesto, una factura, un gasto o un pedido estés donde estés.',
    ],
    enlace: { href: '/panel', texto: 'Ir al inicio' },
  },
  {
    id: 'presupuesto',
    titulo: 'Hacer un presupuesto',
    pasos: [
      'Pulsa «Presupuestos» y «Nuevo presupuesto». En el móvil va por pasos: Cliente, Trabajos y Condiciones.',
      'Elige el cliente (o «¿No está? Añadir un cliente») y escribe qué se presupuesta.',
      'Añade las líneas a mano o con «Añadir del catálogo». Los precios van sin IVA; el total con IVA sale solo, abajo.',
      'Marca «Extra» en lo que ofreces aparte (no suma al total) y elige el anticipo (30 %, 40 %…).',
      'Pulsa «Guardar el presupuesto». Desde su ficha lo envías por WhatsApp o correo y, cuando el cliente responda, pulsas «El cliente lo acepta».',
    ],
    enlace: { href: '/panel/presupuestos-cliente', texto: 'Ir a Presupuestos' },
  },
  {
    id: 'trabajo',
    titulo: 'Calcular el precio de un mueble con sus medidas',
    pasos: [
      'En «Catálogo», pestaña «Trabajos», pulsa «Calcular el precio» en el trabajo (armario, cocina, puerta…).',
      'Escribe las medidas en cm y elige los materiales: el precio se recalcula al momento con las piezas, cantos, herrajes y horas.',
      'Pulsa «Llevar al presupuesto» para meterlo en uno nuevo o en uno que ya tengas, o «Pedir el material» para pedírselo al proveedor.',
    ],
    enlace: { href: '/panel/catalogo', texto: 'Ir al Catálogo' },
  },
  {
    id: 'facturas',
    titulo: 'Facturar un presupuesto aceptado',
    pasos: [
      'En la ficha del presupuesto aceptado pulsa «Hacer la factura de anticipo» (si tiene anticipo) y, al terminar, «Hacer la factura final»: descuenta el anticipo sola.',
      'También puedes hacer una desde cero en «Facturas» → «Nueva factura».',
      'Revisa las líneas y pulsa «Emitir la factura». El cliente necesita su NIF: si falta, el panel te avisa con «Completar su ficha».',
      'Una factura emitida no se cambia ni se borra: si hay un error, pulsa «Corregir o anular (rectificativa)».',
      'Cuando te paguen, pulsa «Marcar como cobrada».',
    ],
    enlace: { href: '/panel/facturas', texto: 'Ir a Facturas' },
  },
  {
    id: 'gastos',
    titulo: 'Apuntar un gasto con la foto del ticket',
    pasos: [
      'Pulsa «Gastos» y «Añadir un ticket»: «Hacer foto al ticket» o «Elegir una foto de la galería». También puedes adjuntarla en el chat de Gubia.',
      'El panel lee la tienda, la fecha y el total. Compáralo con la foto, elige el tipo de gasto y pulsa «Guardar el gasto». Hasta entonces queda «por revisar» y no cuenta.',
      'Si es la primera vez que compras ahí, te pregunta si guardas la tienda como proveedor.',
      'Para la gestoría, en «Gastos» pulsa «Descargar» en la tarjeta «Para la gestoría».',
    ],
    enlace: { href: '/panel/gastos', texto: 'Ir a Gastos' },
  },
  {
    id: 'pedidos',
    titulo: 'Pedir material a un proveedor',
    pasos: [
      'Pulsa «Pedidos» y «Nuevo pedido», o desde un trabajo del catálogo «Pedir el material».',
      'Elige el proveedor, añade el material del catálogo o a mano y pulsa «Guardar el pedido».',
      'Envíaselo por WhatsApp y pulsa «Ya se lo he enviado». Cuando llegue, márcalo como recibido y apunta su gasto.',
    ],
    enlace: { href: '/panel/pedidos', texto: 'Ir a Pedidos' },
  },
  {
    id: 'importar',
    titulo: 'Cargar la tarifa de un proveedor (PDF)',
    pasos: [
      'En «Catálogo» pulsa «Más acciones» → «Importar PDF con Gubia».',
      'Escribe el proveedor, elige el PDF y pulsa «Analizar PDF con Gubia». El PDF se lee en tu móvil u ordenador; solo se envía el texto.',
      'Revisa las fichas propuestas (nombre, referencia, medidas y precio), quita las que no quieras y pulsa «Crear artículos seleccionados».',
      'El precio de la tarifa queda como coste del artículo: compruébalo y ajusta tu margen en el catálogo.',
    ],
    enlace: { href: '/panel/catalogo/importar', texto: 'Importar una tarifa' },
  },
  {
    id: 'studio',
    titulo: 'Diseñar con boceto y probar acabados',
    pasos: [
      '«Diseñar con boceto»: crea el proyecto, sube la foto del espacio y la del boceto en papel y pulsa «Leer el boceto con IA» (o «Poner yo las medidas»).',
      'Revisa las medidas en cm, lo que lleva cada módulo y el material de cada pieza; pulsa «Aprobar el diseño» y después «Generar la imagen».',
      '«Probar acabados»: haz una foto del espacio y prueba suelos, paredes y frentes antes de decidir.',
    ],
    enlace: { href: '/panel/studio-bocetos', texto: 'Ir a Diseñar con boceto' },
  },
  {
    id: 'asistente',
    titulo: 'Pedir cosas a Gubia',
    pasos: [
      'Abre «Asistente Gubia» y escribe o pulsa el micrófono para dictar: «¿qué facturas tengo sin cobrar?», «calcula un armario de 240 por 250», «haz un presupuesto para Marta».',
      'Con el clip adjuntas la foto de un ticket: queda en «Gastos» por revisar.',
      'Si va a cambiar algo, verás una tarjeta con lo que hará. No se cambia nada hasta que pulses «Sí, hazlo».',
      'Con «Nueva conversación» empiezas de cero.',
    ],
    enlace: { href: '/panel/asistente', texto: 'Ir a Gubia' },
  },
  comun('informes'),
];
