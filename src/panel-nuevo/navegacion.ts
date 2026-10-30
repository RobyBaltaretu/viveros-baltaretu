import type { NombreIcono } from '../server/panel/iconos.ts';
import { MAS, type SeccionMenu, type Zona, type ZonaMenu } from '../server/panel/navegacion.ts';

/**
 * Navegación del diseño nuevo, a partir del mismo mapa del panel
 * (src/server/panel/navegacion.ts): mismas secciones, permisos y módulos.
 */

export interface GrupoLateral {
  /** Rótulo del grupo; vacío para Inicio y el asistente. */
  texto: string;
  secciones: SeccionMenu[];
}

/**
 * Barra lateral: todas las secciones a la vista, agrupadas por zona (sin
 * pestañas que abrir). Inicio y el asistente, arriba y sin rótulo; los ajustes,
 * al final. Un grupo de una sola sección con el mismo nombre no lleva rótulo.
 */
export function gruposLateral(zonas: ZonaMenu[]): GrupoLateral[] {
  const sinRotulo: Zona[] = ['inicio', 'asistente'];
  const arriba = zonas.filter((z) => sinRotulo.includes(z.zona));
  const resto = zonas.filter((z) => !sinRotulo.includes(z.zona));
  return [
    { texto: '', secciones: arriba.flatMap((z) => z.secciones) },
    ...resto.map((z) => ({ texto: z.secciones.length === 1 && z.secciones[0]!.texto === z.texto ? '' : z.texto, secciones: z.secciones })),
  ].filter((g) => g.secciones.length);
}

export interface AccionCrear {
  href: string;
  texto: string;
  descripcion: string;
  icono: NombreIcono;
}

/** Lo que se puede crear desde cualquier pantalla, según las secciones que ve cada rol. */
const CREAR: (AccionCrear & { seccion: string })[] = [
  { seccion: '/panel/presupuestos-cliente', href: '/panel/presupuestos-cliente/nuevo', texto: 'Presupuesto', descripcion: 'Para un cliente, con su anticipo', icono: 'presupuestos' },
  { seccion: '/panel/facturas', href: '/panel/facturas/nueva', texto: 'Factura', descripcion: 'Para un cliente o desde un presupuesto', icono: 'facturas' },
  { seccion: '/panel/gastos', href: '/panel/gastos/nuevo', texto: 'Gasto o ticket', descripcion: 'Hazle una foto y se apunta solo', icono: 'ticket' },
  { seccion: '/panel/facturas/clientes', href: '/panel/facturas/clientes/nuevo', texto: 'Cliente', descripcion: 'Nombre, contacto y datos para facturar', icono: 'clientes' },
  { seccion: '/panel/pedidos', href: '/panel/pedidos/nuevo', texto: 'Pedido de material', descripcion: 'A un proveedor, del catálogo o de un trabajo', icono: 'pedidos' },
  { seccion: '/panel/catalogo', href: '/panel/catalogo/articulos/nuevo', texto: 'Artículo del catálogo', descripcion: 'Material, herraje u hora de trabajo con su precio', icono: 'catalogo' },
  { seccion: '/panel/portafolio', href: '/panel/portafolio/nuevo', texto: 'Proyecto del portafolio', descripcion: 'Fotos de antes y después', icono: 'fotos' },
];

export const accionesCrear = (menu: SeccionMenu[]): AccionCrear[] =>
  CREAR.filter((c) => menu.some((s) => s.href === c.seccion)).map(({ seccion: _s, ...c }) => c);

export type PestanaMovil = { tipo: 'enlace'; href: string; texto: string; icono: NombreIcono; activa: boolean } | { tipo: 'crear' };

/**
 * Barra de abajo del móvil: Inicio, Ventas, «Crear» en el centro, la zona del
 * sector (catálogo o portafolio) y «Más». El asistente está en «Más» y en la
 * barra lateral: lo primero es lo que se hace cada día.
 */
export function pestanasMovil(zonas: ZonaMenu[], zona: Zona | null, enMas: boolean, hayCrear: boolean): PestanaMovil[] {
  const de = (z: Zona) => zonas.find((x) => x.zona === z);
  const elegidas = (['inicio', 'ventas', 'plantas'] as Zona[]).map(de).filter((z): z is ZonaMenu => !!z);
  if (elegidas.length < 2) return [];
  const enlaces: PestanaMovil[] = elegidas.map((z) => ({ tipo: 'enlace', href: z.href, texto: z.texto, icono: z.icono, activa: z.zona === zona }));
  const fuera = !enMas && !!zona && !elegidas.some((z) => z.zona === zona);
  if (hayCrear) enlaces.splice(2, 0, { tipo: 'crear' });
  enlaces.push({ tipo: 'enlace', href: MAS, texto: 'Más', icono: 'mas', activa: enMas || fuera });
  return enlaces;
}
