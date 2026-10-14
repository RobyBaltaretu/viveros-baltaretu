/**
 * Textos de interfaz del panel interno. Solo en español: el panel lo usan el
 * propietario y el gerente. Español llano, sin términos técnicos.
 */
export const tp = {
  tituloPanel: 'Panel del vivero',
  saltar: 'Saltar al contenido',
  salir: 'Salir',
  inicio: 'Inicio',
  sinActivarTitulo: 'El panel todavía no está activado',
  sinActivarTexto: 'Falta terminar la configuración. Avisa a la persona que lleva la web.',
  sinAccesoTitulo: 'No tienes acceso al panel',
  sinAccesoTexto: 'Tu correo no está dado de alta. Pide acceso a la persona que lleva la web.',
  hola: (nombre: string) => (nombre ? `Hola, ${nombre}` : 'Hola'),
  roles: { propietario: 'Propietario', gerente: 'Gerente', editor: 'Editor' },
} as const;
