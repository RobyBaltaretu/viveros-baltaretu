import { getCollection } from 'astro:content';
import { filtrarPublicables } from './publicacion';

/** Especies que se pueden mostrar en el build actual, ordenadas por nombre. */
export async function obtenerEspecies(idioma: 'es' | 'en') {
  const especies = filtrarPublicables(await getCollection('catalogo'), {
    dev: import.meta.env.DEV,
    vercelEnv: process.env.VERCEL_ENV,
  });
  return especies.sort((a, b) => a.data.nombre[idioma].localeCompare(b.data.nombre[idioma], idioma));
}
