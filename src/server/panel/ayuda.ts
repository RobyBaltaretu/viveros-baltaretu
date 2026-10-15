/**
 * Ayuda del panel: cada tarea en pasos cortos, con el nombre exacto de los
 * botones. Es la misma guía que `docs/panel-propio/guia-gerente.md`.
 */
export interface Tema {
  id: string;
  titulo: string;
  pasos: string[];
  enlace?: { href: string; texto: string };
}

export const TEMAS: Tema[] = [
  {
    id: 'entrar',
    titulo: 'Entrar al panel',
    pasos: [
      'Abre la dirección del panel que te ha dado el propietario (guárdala en favoritos).',
      'Escribe tu correo y pulsa «Send me a code».',
      'Mira tu correo: llega un código de 6 números. Escríbelo y pulsa «Sign in».',
      'El panel recuerda tu entrada una semana en ese móvil u ordenador.',
    ],
  },
  {
    id: 'precio',
    titulo: 'Cambiar el precio de una planta',
    pasos: ['Pulsa «Mis plantas» y elige la planta.', 'Pulsa «Cambiar el precio».', 'Escribe el precio (por ejemplo 18 o 18,50) y pulsa «Guardar el precio».', 'Para que salga en la web, publica los cambios.'],
    enlace: { href: '/panel/plantas', texto: 'Ir a Mis plantas' },
  },
  {
    id: 'hay',
    titulo: 'Marcar si hay o no hay',
    pasos: ['En «Mis plantas», elige la planta.', 'Pulsa «Cambiar si hay o no hay».', 'Elige «Disponible», «Bajo pedido» o «Agotado» y pulsa «Guardar».'],
  },
  {
    id: 'nueva',
    titulo: 'Añadir una planta nueva',
    pasos: [
      'En «Mis plantas», pulsa «Añadir una planta».',
      'Responde a cada pregunta y pulsa «Siguiente». Si te equivocas, pulsa «Atrás».',
      'Al final, marca «Está revisada y se puede publicar» solo si todo está bien.',
      'Después el panel te lleva a añadir fotos.',
    ],
    enlace: { href: '/panel/plantas/nueva', texto: 'Añadir una planta' },
  },
  {
    id: 'fotos',
    titulo: 'Subir fotos',
    pasos: [
      'Pulsa «Fotos» y elige la planta.',
      'Pulsa el botón de elegir archivo: puedes hacer la foto en ese momento o elegirla de la galería.',
      'Pulsa «Subir la foto». Se recorta y se reduce sola.',
      'Revisa «Qué se ve en la foto»: es lo que leen quienes no pueden ver la imagen y ayuda en Google.',
      'La primera foto es la que sale en el catálogo. Usa «Ponerla la primera» para cambiarla.',
    ],
    enlace: { href: '/panel/fotos', texto: 'Ir a Fotos' },
  },
  {
    id: 'textos',
    titulo: 'Cambiar textos de la web',
    pasos: [
      'Pulsa «Textos de la web» y elige qué quieres cambiar.',
      'Cada texto se escribe en español y en inglés.',
      'Los recuadros con el aviso «Falta este dato» todavía tienen un texto provisional: cámbialo por el real.',
      'Pulsa «Guardar». Si falta algo, el panel te dice qué.',
    ],
    enlace: { href: '/panel/textos', texto: 'Ir a Textos de la web' },
  },
  {
    id: 'publicar',
    titulo: 'Publicar los cambios',
    pasos: [
      'Lo que guardas no sale en la web hasta que publicas.',
      'Pulsa «Publicar cambios»: verás la lista de lo que va a cambiar.',
      'Pulsa «Sí, publicar». La web se actualiza sola en unos minutos; en «Últimas publicaciones» verás cuándo ya está.',
      'Las plantas sin revisar o de ejemplo no salen en la web aunque publiques.',
    ],
    enlace: { href: '/panel/publicar', texto: 'Ir a Publicar cambios' },
  },
  {
    id: 'asistente',
    titulo: 'Pedir cosas al asistente',
    pasos: [
      'Pulsa «Asistente» (en el móvil, el botón redondo del centro) y escribe lo que necesitas con tus palabras: «¿cuánto hemos facturado este mes?», «sube la palmera canaria a 40 €», «hazle una factura a Jardines Turia de 10 olivos a 25 €».',
      'Si pide hacer un cambio, verás una tarjeta con lo que va a hacer. No se cambia nada hasta que pulses «Sí, hazlo»; con «No» se descarta.',
      'Las facturas que prepara quedan como borrador: revísalas en «Facturas» o pídele que la emita.',
      'Si un día se agota el uso gratuito, sigue funcionando en modo básico (precios, disponibilidad y presupuestos) hasta el día siguiente.',
      'Con «Nueva conversación» empiezas de cero.',
    ],
    enlace: { href: '/panel/asistente', texto: 'Ir al asistente' },
  },
  {
    id: 'facturas',
    titulo: 'Hacer una factura',
    pasos: [
      'La primera vez, en «Facturas» pulsa «Datos de facturación» y completa la razón social, el NIF y la dirección de la empresa.',
      'Pulsa «Nueva factura» y elige el cliente (o «A un cliente nuevo»). Desde un presupuesto, pulsa «Hacer la factura de este pedido» y se rellena sola.',
      'Escribe cada línea: concepto, cantidad, precio sin IVA y el IVA (las plantas llevan el 10 %). Con «Añadir la planta» se copia el nombre y el precio del catálogo.',
      'Pulsa «Emitir la factura» y confirma con «Sí, emitir». El número se pone solo y ya no se puede cambiar: si hay un error, usa «Corregir o anular (rectificativa)».',
      'Pulsa «Enviar» para mandar el PDF por WhatsApp o correo, o «Descargar».',
      'Cuando te paguen, pulsa «Marcar como cobrada». Para la gestoría, descarga el libro de facturas del año.',
    ],
    enlace: { href: '/panel/facturas', texto: 'Ir a Facturas' },
  },
  {
    id: 'gastos',
    titulo: 'Apuntar un gasto con la foto del ticket',
    pasos: [
      'Pulsa «Gastos» y luego «Añadir un ticket».',
      'Pulsa el botón de elegir archivo: haz la foto al ticket (entero, recto y con luz) o elígela de la galería. Pulsa «Leer el ticket».',
      'En unos segundos verás lo que ha leído: dónde se compró, la fecha, lo comprado y el total. Compáralo con la foto y corrige lo que haga falta.',
      'Elige el tipo de gasto y pulsa «Guardar el gasto». Hasta entonces queda «por revisar» y no cuenta en las cuentas.',
      'Si no tienes ticket, pulsa «No tengo ticket: escribirlo a mano».',
    ],
    enlace: { href: '/panel/gastos', texto: 'Ir a Gastos' },
  },
  {
    id: 'informes',
    titulo: 'Ver cómo van las ventas y los gastos',
    pasos: [
      'Pulsa «Informes». Arriba eliges el mes, el trimestre o el año, y con «Anterior» y «Siguiente» te mueves.',
      'Verás los ingresos y los gastos sin IVA, el resultado, lo que falta por cobrar y la comparación con el periodo anterior.',
      '«Lo más importante» resume en frases lo que ha cambiado. Debajo, el gráfico de 12 meses (con sus datos en una tabla), en qué se gasta, los mejores clientes y lo más vendido.',
      'Solo cuentan las facturas emitidas y los tickets revisados.',
    ],
    enlace: { href: '/panel/informes', texto: 'Ir a Informes' },
  },
  {
    id: 'deshacer',
    titulo: 'Me he equivocado: deshacer',
    pasos: ['Pulsa «Cambios recientes».', 'Busca el cambio y pulsa «Deshacer»: queda como estaba antes.', 'Si ya estaba publicado, vuelve a publicar para que la web lo recoja.'],
    enlace: { href: '/panel/cambios', texto: 'Ir a Cambios recientes' },
  },
  {
    id: 'quitar',
    titulo: 'Quitar una planta de la web',
    pasos: ['En la planta, pulsa «Quitar de la web (archivar)» y confirma.', 'No se borra: se recupera con «Deshacer» en «Cambios recientes».'],
  },
];
