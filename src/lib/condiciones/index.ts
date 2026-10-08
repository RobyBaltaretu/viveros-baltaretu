import { getEntry } from 'astro:content';
import { esEntornoDePrueba } from '../entorno';
import { condicionesDePrueba } from '../pruebas/datos';
import { rellenarConPrueba } from '../pruebas/rellenar';
import type { Condiciones } from './schema';

/** Condiciones de venta del panel (src/content/ajustes/condiciones.yaml). */
export async function obtenerCondiciones(): Promise<Condiciones> {
  const entrada = await getEntry('condiciones', 'condiciones');
  if (!entrada) throw new Error('Falta src/content/ajustes/condiciones.yaml');
  return esEntornoDePrueba() ? rellenarConPrueba(entrada.data, condicionesDePrueba) : entrada.data;
}
