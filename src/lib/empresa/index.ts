import { getEntry } from 'astro:content';
import { esEntornoDePrueba } from '../entorno';
import { empresaDePrueba } from '../pruebas/datos';
import { rellenarConPrueba } from '../pruebas/rellenar';
import type { Empresa } from './schema';

export { esPlaceholder } from './schema';
export type { Empresa } from './schema';

/** Datos de la empresa gestionados desde el panel (src/content/ajustes/empresa.yaml). */
export async function obtenerEmpresa(): Promise<Empresa> {
  const entrada = await getEntry('empresa', 'empresa');
  if (!entrada) throw new Error('Falta src/content/ajustes/empresa.yaml');
  return esEntornoDePrueba() ? rellenarConPrueba(entrada.data, empresaDePrueba) : entrada.data;
}
