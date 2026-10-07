import { getEntry } from 'astro:content';
import type { Empresa } from './schema';

export { esPlaceholder } from './schema';
export type { Empresa } from './schema';

/** Datos de la empresa gestionados desde el panel (src/content/ajustes/empresa.yaml). */
export async function obtenerEmpresa(): Promise<Empresa> {
  const entrada = await getEntry('empresa', 'empresa');
  if (!entrada) throw new Error('Falta src/content/ajustes/empresa.yaml');
  return entrada.data;
}
