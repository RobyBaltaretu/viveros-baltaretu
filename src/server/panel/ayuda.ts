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
