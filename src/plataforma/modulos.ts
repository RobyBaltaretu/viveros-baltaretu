import type { Modulo } from './configuracion.ts';

/**
 * A qué módulo pertenece cada parte de la plataforma. Un módulo apagado en la
 * configuración del cliente se oculta en el menú (navegacion.ts), da 404 en el
 * servidor (middleware.ts) y desaparece de las herramientas del asistente.
 * Lo que no está aquí (inicio, textos, publicar, personas, ayuda…) es del núcleo.
 */
const RUTAS: [prefijo: string, modulo: Modulo][] = [
  ['/panel/presupuestos', 'presupuestosWeb'],
  ['/api/panel/presupuestos.csv', 'presupuestosWeb'],
  ['/api/presupuesto', 'presupuestosWeb'],
  ['/panel/facturas', 'facturas'],
  ['/api/panel/factura-pdf', 'facturas'],
  ['/api/panel/facturas-copia', 'facturas'],
  ['/api/panel/facturas.csv', 'facturas'],
  ['/panel/plantas', 'catalogo'],
  ['/panel/inventario', 'catalogo'],
  ['/panel/fotos', 'catalogo'],
  ['/api/panel/foto', 'catalogo'],
  ['/panel/gastos', 'gastos'],
  ['/api/panel/gastos.csv', 'gastos'],
  ['/api/panel/ticket', 'gastos'],
  ['/panel/informes', 'informes'],
  ['/panel/asistente', 'asistente'],
];

/** Módulo de una ruta (el del prefijo más largo), o null si es del núcleo. */
export function moduloDeRuta(ruta: string): Modulo | null {
  const limpia = ruta.replace(/\/+$/, '') || '/';
  let mejor: [string, Modulo] | null = null;
  for (const r of RUTAS) {
    if ((limpia === r[0] || limpia.startsWith(`${r[0]}/`)) && (!mejor || r[0].length > mejor[0].length)) mejor = r;
  }
  return mejor?.[1] ?? null;
}

/** Herramientas del asistente: por su permiso y, las de plantas (permiso «editar» o «asistente»), por su nombre. */
const POR_PERMISO: Partial<Record<string, Modulo>> = {
  presupuestos: 'presupuestosWeb',
  facturas: 'facturas',
  gastos: 'gastos',
  informes: 'informes',
  inventario: 'catalogo',
};
const DEL_CATALOGO = new Set(['buscar_plantas', 'cambiar_planta', 'crear_planta', 'quitar_o_recuperar_planta', 'cambiar_plantas']);

/** Módulo de una herramienta (además, todas dependen del módulo `asistente`). */
export const moduloDeHerramienta = (h: { nombre: string; permiso: string }): Modulo | null => (DEL_CATALOGO.has(h.nombre) ? 'catalogo' : (POR_PERMISO[h.permiso] ?? null));
