import { clienteActual, moduloActivoAhora } from '../../plataforma/actual.ts';
import type { Gasto, Proveedor, Repositorios } from '../data/tipos.ts';
import { nifValido } from '../facturas/nif.ts';
import { claveProveedor, proveedorVacio } from '../proveedores/proveedores.ts';

/**
 * Después de guardar un gasto, en la carpintería se pregunta si su tienda se
 * guarda también como proveedor (con lo leído del ticket: NIF, dirección,
 * teléfono…). Solo si aún no es proveedor: mismo nombre (sin tildes, mayúsculas
 * ni «SL») o mismo NIF.
 */
export function proveedorDeGasto(g: Pick<Gasto, 'proveedor' | 'nifProveedor' | 'categoria' | 'contactoProveedor'>): Omit<Proveedor, 'actualizado'> {
  const c = g.contactoProveedor;
  const nif = g.nifProveedor.trim().toUpperCase();
  return {
    ...proveedorVacio(),
    nombre: g.proveedor.trim().slice(0, 120),
    nif: nif && nifValido(nif) ? nif : '',
    direccion: (c?.direccion ?? '').slice(0, 200),
    poblacion: (c?.poblacion ?? '').slice(0, 80),
    telefono: (c?.telefono ?? '').slice(0, 40),
    email: (c?.email ?? '').slice(0, 120),
    web: (c?.web ?? '').slice(0, 200),
    notas: 'Dado de alta desde un ticket.',
  };
}

/** El proveedor que se propondría guardar, o null (otro sector, sin el módulo, sin tienda o ya es proveedor). */
export async function proveedorPorGuardar(repos: Repositorios, g: Gasto): Promise<Omit<Proveedor, 'actualizado'> | null> {
  if (clienteActual().sector !== 'carpinteria' || !moduloActivoAhora('proveedores') || !g.proveedor.trim()) return null;
  const nuevo = proveedorDeGasto(g);
  const clave = claveProveedor(nuevo.nombre);
  const ya = (await repos.proveedores.listar({ incluirArchivados: true })).some((p) => (clave && claveProveedor(p.nombre) === clave) || (nuevo.nif && p.nif === nuevo.nif));
  return ya ? null : nuevo;
}
