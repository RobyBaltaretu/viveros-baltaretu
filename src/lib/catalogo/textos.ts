import { getEntry } from 'astro:content';
import type { TextosCatalogo } from './textos-schema';

export async function obtenerTextosCatalogo(): Promise<TextosCatalogo> {
  const entrada = await getEntry('textosCatalogo', 'catalogo');
  if (!entrada) throw new Error('Falta src/content/ajustes/catalogo.yaml');
  return entrada.data;
}
