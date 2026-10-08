import { getEntry } from 'astro:content';
import { esEntornoDePrueba } from '../entorno';
import { portadaDePrueba } from '../pruebas/datos';
import { rellenarConPrueba } from '../pruebas/rellenar';
import type { Portada } from './schema';

/** Textos de la portada gestionados desde el panel (src/content/ajustes/portada.yaml). */
export async function obtenerPortada(): Promise<Portada> {
  const entrada = await getEntry('portada', 'portada');
  if (!entrada) throw new Error('Falta src/content/ajustes/portada.yaml');
  return esEntornoDePrueba() ? rellenarConPrueba(entrada.data, portadaDePrueba) : entrada.data;
}
