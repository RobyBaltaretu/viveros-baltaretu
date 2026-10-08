import { getCollection, getEntry } from 'astro:content';
import { filtrarPublicables } from '../catalogo/publicacion';
import { entornoActual, esEntornoDePrueba } from '../entorno';
import { paginasDePrueba } from '../pruebas/datos';
import { rellenarConPrueba } from '../pruebas/rellenar';
import type { ClavePagina, Pagina } from './schema';

export async function obtenerPagina(clave: ClavePagina): Promise<Pagina> {
  const entrada = await getEntry('paginas', clave);
  if (!entrada) throw new Error(`Falta src/content/paginas/${clave}.yaml`);
  return esEntornoDePrueba() ? rellenarConPrueba(entrada.data, paginasDePrueba[clave]) : entrada.data;
}


/** Proyectos y guías publicables (misma regla que el catálogo: nada sin revisar en producción). */
export async function obtenerProyectos() {
  return filtrarPublicables(await getCollection('proyectos'), entornoActual());
}

export async function obtenerGuias() {
  return filtrarPublicables(await getCollection('guias'), entornoActual());
}

/** Párrafos de un texto: se separan con una línea en blanco. */
export const parrafos = (texto: string) =>
  texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
