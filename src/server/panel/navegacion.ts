import type { Rol } from '../data/tipos.ts';
import type { NombreIcono } from './iconos.ts';
import { puede, type Accion } from './permisos.ts';

/**
 * Mapa del panel: cada sección con su grupo, icono, dibujo y una frase. Lo usan
 * la barra lateral (ordenador), la barra de abajo (móvil), «Más» y el inicio.
 * Solo salen las secciones que el rol puede usar.
 */
export type Grupo = 'dia' | 'vivero' | 'cuentas' | 'ajustes';

export interface SeccionMenu {
  href: string;
  texto: string;
  permiso?: Accion;
  grupo: Grupo;
  icono: NombreIcono;
  /** Dibujo de `Ilustracion.astro`. */
  escena?: string;
  descripcion: string;
}

export const GRUPOS: Record<Grupo, string> = {
  dia: 'Día a día',
  vivero: 'Vivero y web',
  cuentas: 'Cuentas',
  ajustes: 'Ajustes',
};

export const MENU: SeccionMenu[] = [
  { href: '/panel', texto: 'Inicio', grupo: 'dia', icono: 'inicio', descripcion: 'Lo pendiente de hoy' },
  { href: '/panel/asistente', texto: 'AgricolAI', permiso: 'asistente', grupo: 'dia', icono: 'asistente', escena: 'asistente', descripcion: 'Tu asistente: pide lo que necesites con tus palabras' },
  { href: '/panel/presupuestos', texto: 'Presupuestos', permiso: 'presupuestos', grupo: 'dia', icono: 'presupuestos', escena: 'presupuestos', descripcion: 'Lo que piden los clientes desde la web' },
  { href: '/panel/plantas', texto: 'Plantas', permiso: 'editar', grupo: 'vivero', icono: 'plantas', escena: 'plantas', descripcion: 'Precios, disponibilidad y plantas nuevas' },
  { href: '/panel/inventario', texto: 'Inventario', permiso: 'inventario', grupo: 'vivero', icono: 'inventario', escena: 'plantas', descripcion: 'Cuántas plantas hay, entradas, salidas y bajas' },
  { href: '/panel/fotos', texto: 'Fotos', permiso: 'editar', grupo: 'vivero', icono: 'fotos', escena: 'fotos', descripcion: 'Las fotos de cada planta' },
  { href: '/panel/textos', texto: 'Textos', permiso: 'editar', grupo: 'vivero', icono: 'textos', escena: 'textos', descripcion: 'Empresa, portada, condiciones y páginas' },
  { href: '/panel/publicar', texto: 'Publicar', permiso: 'publicar', grupo: 'vivero', icono: 'publicar', escena: 'publicar', descripcion: 'Llevar los cambios a la web' },
  { href: '/panel/cambios', texto: 'Cambios', permiso: 'editar', grupo: 'vivero', icono: 'cambios', escena: 'cambios', descripcion: 'Lo que se ha cambiado y deshacer' },
  { href: '/panel/facturas', texto: 'Facturas', permiso: 'facturas', grupo: 'cuentas', icono: 'facturas', escena: 'facturas', descripcion: 'Hacer facturas y ver lo que falta por cobrar' },
  { href: '/panel/facturas/clientes', texto: 'Clientes', permiso: 'facturas', grupo: 'cuentas', icono: 'clientes', escena: 'clientes', descripcion: 'Datos de cada cliente para facturar' },
  { href: '/panel/gastos', texto: 'Gastos', permiso: 'gastos', grupo: 'cuentas', icono: 'gastos', escena: 'gastos', descripcion: 'Tickets de compra y lo que se ha gastado' },
  { href: '/panel/informes', texto: 'Informes', permiso: 'informes', grupo: 'cuentas', icono: 'informes', escena: 'informes', descripcion: 'Ventas, gastos, resultado y cobros' },
  { href: '/panel/personas', texto: 'Personas', permiso: 'personas', grupo: 'ajustes', icono: 'personas', escena: 'personas', descripcion: 'Quién puede entrar al panel' },
  { href: '/panel/pruebas', texto: 'Datos de prueba', permiso: 'personas', grupo: 'ajustes', icono: 'nuevo', escena: 'cambios', descripcion: 'Cargar o quitar ejemplos para probar el panel' },
  { href: '/panel/ayuda', texto: 'Ayuda', grupo: 'ajustes', icono: 'ayuda', escena: 'ayuda', descripcion: 'Cómo se hace cada cosa' },
];

export const menuDe = (rol: Rol) => MENU.filter((s) => !s.permiso || puede(rol, s.permiso));

/** Secciones de un rol agrupadas, en el orden de `GRUPOS`. */
export const gruposDe = (rol: Rol) =>
  (Object.keys(GRUPOS) as Grupo[]).map((g) => ({ grupo: g, titulo: GRUPOS[g], secciones: menuDe(rol).filter((s) => s.grupo === g) })).filter((g) => g.secciones.length);

/** Barra de abajo del móvil: cuatro accesos (el asistente en el centro) y «Más». */
const PRIORIDAD_BARRA = ['/panel', '/panel/plantas', '/panel/asistente', '/panel/facturas', '/panel/presupuestos', '/panel/textos'];
export function barraDe(rol: Rol): SeccionMenu[] {
  const disponibles = menuDe(rol);
  const elegidas = PRIORIDAD_BARRA.map((h) => disponibles.find((s) => s.href === h)).filter((s): s is SeccionMenu => !!s).slice(0, 4);
  const asistente = elegidas.findIndex((s) => s.href === '/panel/asistente');
  // El asistente va en el centro (tercera posición) si está.
  if (asistente >= 0 && elegidas.length === 4 && asistente !== 2) elegidas.splice(2, 0, ...elegidas.splice(asistente, 1));
  return elegidas;
}

export const MAS = '/panel/mas';

/** La sección a la que pertenece una ruta: la de prefijo más largo. */
export function seccionActual(ruta: string, secciones: SeccionMenu[] = MENU): string | null {
  const limpia = ruta.replace(/\/+$/, '') || '/';
  let mejor: string | null = null;
  for (const s of secciones) {
    const coincide = s.href === '/panel' ? limpia === '/panel' : limpia === s.href || limpia.startsWith(`${s.href}/`);
    if (coincide && (!mejor || s.href.length > mejor.length)) mejor = s.href;
  }
  return mejor;
}
