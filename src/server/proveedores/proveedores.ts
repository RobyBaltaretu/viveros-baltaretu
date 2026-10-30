import type { ArticuloCatalogo, Gasto, Proveedor } from '../data/tipos.ts';
import { CATEGORIAS } from '../catalogo/catalogo.ts';
import { nifValido, normalizarNif } from '../facturas/nif.ts';
import { celdaCsv } from '../panel/presupuestos.ts';

/**
 * Reglas de los proveedores (módulo `proveedores`): alta y cambio con los
 * datos validados, qué artículos del catálogo se les compran (por el nombre
 * del proveedor escrito en el artículo) y el CSV. Todo privado.
 */
export interface Error {
  campo: string;
  mensaje: string;
}

export function proveedorVacio(id: string = crypto.randomUUID()): Omit<Proveedor, 'actualizado'> {
  return { id, nombre: '', nif: '', contacto: '', telefono: '', email: '', direccion: '', poblacion: '', web: '', categorias: [], plazoDias: null, formaPago: '', notas: '', archivado: false };
}

const recorta = (t: string, max: number) => t.trim().slice(0, max);

/** Lee el formulario de la ficha. El NIF es opcional, pero si se escribe tiene que ser válido. */
export function leerProveedor(form: FormData, previo: Omit<Proveedor, 'actualizado'>): { proveedor: Omit<Proveedor, 'actualizado'>; errores: Error[] } {
  const v = (n: string) => String(form.get(n) ?? '');
  const plazo = v('plazoDias').trim();
  const proveedor = {
    ...previo,
    nombre: recorta(v('nombre'), 120),
    nif: normalizarNif(recorta(v('nif'), 20)),
    contacto: recorta(v('contacto'), 120),
    telefono: recorta(v('telefono'), 40),
    email: recorta(v('email'), 120),
    direccion: recorta(v('direccion'), 200),
    poblacion: recorta(v('poblacion'), 80),
    web: recorta(v('web'), 200),
    categorias: form.getAll('categorias').map(String).filter((c) => CATEGORIAS.some((x) => x.id === c)),
    plazoDias: plazo === '' ? null : Number(plazo),
    formaPago: recorta(v('formaPago'), 80),
    notas: recorta(v('notas'), 1000),
  };
  const errores: Error[] = [];
  if (!proveedor.nombre) errores.push({ campo: 'nombre', mensaje: 'Escribe el nombre del proveedor.' });
  if (proveedor.nif && !nifValido(proveedor.nif)) errores.push({ campo: 'nif', mensaje: 'El NIF no es correcto: revisa la letra o el número.' });
  if (proveedor.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(proveedor.email)) errores.push({ campo: 'email', mensaje: 'El correo no parece correcto.' });
  if (proveedor.plazoDias !== null && !(Number.isInteger(proveedor.plazoDias) && proveedor.plazoDias >= 0 && proveedor.plazoDias <= 365)) errores.push({ campo: 'plazoDias', mensaje: 'El plazo va en días: un número entre 0 y 365.' });
  return { proveedor, errores };
}

/** Nombre para comparar: sin tildes, mayúsculas, «SL»/«SA», «(prueba)» ni signos. */
export const claveProveedor = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(s\.?l\.?u?|s\.?a\.?)\b|\(prueba\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** ¿Este artículo se compra a este proveedor? Por el nombre escrito en el artículo (sin tildes, mayúsculas ni «SL»). */
export const esDelProveedor = (a: Pick<ArticuloCatalogo, 'proveedor'>, p: Pick<Proveedor, 'nombre'>) => !!a.proveedor.trim() && claveProveedor(a.proveedor) === claveProveedor(p.nombre);

/** Lo que se ha gastado con un proveedor (gastos revisados con el mismo nombre o NIF). */
export function gastadoCon(p: Pick<Proveedor, 'nombre' | 'nif'>, gastos: Gasto[]): number {
  const suyos = gastos.filter((g) => g.estado === 'confirmado' && ((p.nif && normalizarNif(g.nifProveedor) === p.nif) || claveProveedor(g.proveedor) === claveProveedor(p.nombre)));
  return Math.round(suyos.reduce((t, g) => t + g.total, 0) * 100) / 100;
}

export const nombresCategorias = (ids: string[]) => ids.map((id) => CATEGORIAS.find((c) => c.id === id)?.nombre ?? id);

/** CSV de proveedores (separado por «;», como el resto de descargas). */
export function csvProveedores(ps: Proveedor[]): string {
  const cabecera = ['Nombre', 'NIF', 'Contacto', 'Teléfono', 'Correo', 'Dirección', 'Población', 'Web', 'Suministra', 'Plazo (días)', 'Forma de pago', 'Notas', 'Oculto'].map(celdaCsv).join(';');
  const filas = ps.map((p) => [p.nombre, p.nif, p.contacto, p.telefono, p.email, p.direccion, p.poblacion, p.web, nombresCategorias(p.categorias).join(', '), p.plazoDias ?? '', p.formaPago, p.notas, p.archivado ? 'sí' : ''].map(celdaCsv).join(';'));
  return [cabecera, ...filas].join('\r\n');
}
