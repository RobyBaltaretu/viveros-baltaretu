import { getCollection } from 'astro:content';
import { entornoActual } from '../entorno';
import { filtrarPublicables } from './publicacion';

/** Especies que se pueden mostrar en el build actual, ordenadas por nombre. */
export async function obtenerEspecies(idioma: 'es' | 'en') {
  const especies = filtrarPublicables(await getCollection('catalogo'), entornoActual());
  return especies.sort((a, b) => a.data.nombre[idioma].localeCompare(b.data.nombre[idioma], idioma));
}
