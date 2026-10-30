import type { Modulo, SECTORES } from './configuracion.ts';

type Sector = (typeof SECTORES)[number];

/**
 * A qué módulo pertenece cada parte de la plataforma. Un módulo apagado en la
 * configuración del cliente se oculta en el menú (navegacion.ts), da 404 en el
 * servidor (middleware.ts) y desaparece de las herramientas del asistente.
 * Lo que no está aquí (inicio, textos, publicar, personas, ayuda…) es del núcleo.
 * Las pantallas propias de un sector (las plantas del vivero) solo existen en
 * los clientes de ese sector.
 */
const RUTAS: [prefijo: string, modulo: Modulo, sector?: Sector][] = [
  ['/panel/presupuestos', 'presupuestosWeb'],
  ['/api/panel/presupuestos.csv', 'presupuestosWeb'],
  ['/api/presupuesto', 'presupuestosWeb'],
  ['/panel/presupuestos-cliente', 'presupuestosCliente'],
  ['/panel/facturas', 'facturas'],
  ['/api/panel/factura-pdf', 'facturas'],
  ['/api/panel/facturas-copia', 'facturas'],
  ['/api/panel/facturas.csv', 'facturas'],
  ['/panel/plantas', 'catalogo', 'vivero'],
  ['/panel/inventario', 'catalogo', 'vivero'],
  ['/panel/fotos', 'catalogo', 'vivero'],
  ['/api/panel/foto', 'catalogo', 'vivero'],
  ['/panel/portafolio', 'catalogo', 'carpinteria'],
  ['/api/panel/adjunto', 'catalogo', 'carpinteria'],
  // Catálogo de la carpintería: artículos, precios y plantillas con su escandallo.
  ['/panel/catalogo', 'materiales', 'carpinteria'],
  ['/api/panel/catalogo-trabajo', 'materiales', 'carpinteria'],
  // Proveedores de la carpintería (a quién se compra el material).
  ['/panel/proveedores', 'proveedores', 'carpinteria'],
  ['/api/panel/proveedores.csv', 'proveedores', 'carpinteria'],
  // Pedidos de material a proveedor.
  ['/panel/pedidos', 'pedidosProveedor', 'carpinteria'],
  // Simulador de reformas en vivo con IA.
  ['/panel/simulador', 'simulador', 'carpinteria'],
  ['/api/panel/simulador', 'simulador', 'carpinteria'],
  ['/panel/gastos', 'gastos'],
  ['/api/panel/gastos.csv', 'gastos'],
  ['/api/panel/ticket', 'gastos'],
  ['/panel/informes', 'informes'],
  ['/panel/asistente', 'asistente'],
];

/**
 * Pantallas y APIs de la web pública (textos, publicar, cambios y la API de
 * contenido que usa el build): solo existen en clientes con `webPublica`.
 */
const RUTAS_WEB = ['/panel/textos', '/panel/publicar', '/panel/cambios', '/api/contenido'];
export const esDeLaWeb = (ruta: string) => {
  const limpia = ruta.replace(/\/+$/, '') || '/';
  return RUTAS_WEB.some((r) => limpia === r || limpia.startsWith(`${r}/`));
};

/** Módulo y sector de una ruta (los del prefijo más largo); módulo null = núcleo. */
export function moduloDeRuta(ruta: string): Modulo | null {
  return parteDeRuta(ruta).modulo;
}
export function parteDeRuta(ruta: string): { modulo: Modulo | null; sector: Sector | null } {
  const limpia = ruta.replace(/\/+$/, '') || '/';
  let mejor: (typeof RUTAS)[number] | null = null;
  for (const r of RUTAS) {
    if ((limpia === r[0] || limpia.startsWith(`${r[0]}/`)) && (!mejor || r[0].length > mejor[0].length)) mejor = r;
  }
  return { modulo: mejor?.[1] ?? null, sector: mejor?.[2] ?? null };
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

/** Herramientas que leen o cambian la web pública (textos, publicar, deshacer cambios). */
const DE_LA_WEB = new Set(['ver_textos_web', 'cambiar_texto_web', 'cambiar_textos_web', 'publicar_cambios', 'cambios_recientes', 'deshacer_cambio']);
export const herramientaDeLaWeb = (h: { nombre: string }) => DE_LA_WEB.has(h.nombre);

/** Las herramientas de plantas e inventario son del vivero. */
export const sectorDeHerramienta = (h: { nombre: string; permiso: string }): Sector | null => (DEL_CATALOGO.has(h.nombre) || h.permiso === 'inventario' ? 'vivero' : null);
