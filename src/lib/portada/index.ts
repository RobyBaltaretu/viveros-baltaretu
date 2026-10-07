import { getEntry } from 'astro:content';
import type { Portada } from './schema';

/** Textos de la portada gestionados desde el panel (src/content/ajustes/portada.yaml). */
export async function obtenerPortada(): Promise<Portada> {
  const entrada = await getEntry('portada', 'portada');
  if (!entrada) throw new Error('Falta src/content/ajustes/portada.yaml');
  return entrada.data;
}
