import type { Rol } from '../data/tipos.ts';
import { puede, type Accion } from './permisos.ts';

/**
 * Menú fijo del panel: las secciones principales, siempre a mano, para no
 * depender de la cadena de "volver". Solo salen las que el rol puede usar.
 */
export interface SeccionMenu {
  href: string;
  texto: string;
  permiso?: Accion;
}

export const MENU: SeccionMenu[] = [
  { href: '/panel', texto: 'Inicio' },
  { href: '/panel/plantas', texto: 'Plantas', permiso: 'editar' },
  { href: '/panel/presupuestos', texto: 'Presupuestos', permiso: 'presupuestos' },
  { href: '/panel/facturas', texto: 'Facturas', permiso: 'facturas' },
  { href: '/panel/gastos', texto: 'Gastos', permiso: 'gastos' },
  { href: '/panel/textos', texto: 'Textos', permiso: 'editar' },
  { href: '/panel/publicar', texto: 'Publicar', permiso: 'publicar' },
];

export const menuDe = (rol: Rol) => MENU.filter((s) => !s.permiso || puede(rol, s.permiso));

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
