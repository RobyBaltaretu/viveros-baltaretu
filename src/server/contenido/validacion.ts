import { z } from 'astro/zod';
import { crearEsquemaEspecie } from '../../lib/catalogo/schema';
import { esquemaTextosCatalogo } from '../../lib/catalogo/textos-schema';
import { esquemaCondiciones } from '../../lib/condiciones/schema';
import { esquemaEmpresa } from '../../lib/empresa/schema';
import { crearEsquemaProyecto, esquemaGuia, esquemaPagina, PAGINAS } from '../../lib/paginas/schema';
import { esquemaPortada } from '../../lib/portada/schema';
import { COLECCIONES, type Coleccion, type Documento } from '../data/tipos.ts';

/**
 * Validación del contenido con los mismos esquemas que usa el build
 * (`src/content.config.ts`). En el panel las fotos son rutas: el build las
 * convierte en imágenes optimizadas.
 */
export const PREFIJO_FOTO = '../../assets/';
const rutaFoto = z.string().startsWith(PREFIJO_FOTO, 'La foto debe estar en la carpeta de fotos');

export const AJUSTES = { empresa: esquemaEmpresa, condiciones: esquemaCondiciones, portada: esquemaPortada, catalogo: esquemaTextosCatalogo } as const;
export type ClaveAjuste = keyof typeof AJUSTES;

export function esquemaDe(coleccion: Coleccion, id: string): z.ZodType | null {
  switch (coleccion) {
    case 'catalogo':
      return crearEsquemaEspecie(rutaFoto);
    case 'proyectos':
      return crearEsquemaProyecto(rutaFoto);
    case 'guias':
      return esquemaGuia;
    case 'paginas':
      return (PAGINAS as readonly string[]).includes(id) ? esquemaPagina : null;
    case 'ajustes':
      return id in AJUSTES ? AJUSTES[id as ClaveAjuste] : null;
  }
}

export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

export type ResultadoValidacion = { ok: true } | { ok: false; errores: ErrorCampo[] };

const ID_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validarEntrada(coleccion: string, id: string, documento: Documento): ResultadoValidacion {
  if (!(COLECCIONES as readonly string[]).includes(coleccion)) return { ok: false, errores: [{ campo: '', mensaje: 'Colección desconocida' }] };
  if (!ID_VALIDO.test(id)) return { ok: false, errores: [{ campo: '', mensaje: 'Identificador no válido' }] };
  const esquema = esquemaDe(coleccion as Coleccion, id);
  if (!esquema) return { ok: false, errores: [{ campo: '', mensaje: 'Esta entrada no existe en la web' }] };
  const r = esquema.safeParse(documento.datos);
  if (!r.success) return { ok: false, errores: r.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })) };
  // En el catálogo, proyectos y guías el nombre del archivo es el slug.
  const slug = (documento.datos as { slug?: unknown }).slug;
  if (slug !== undefined && slug !== id) return { ok: false, errores: [{ campo: 'slug', mensaje: 'El slug no coincide con el identificador' }] };
  return { ok: true };
}

/** Rutas (relativas a `src/assets`) de las fotos que usa una entrada. */
export function fotosDe(documento: Documento): string[] {
  const fotos = (documento.datos as { fotos?: { imagen?: unknown }[] }).fotos;
  if (!Array.isArray(fotos)) return [];
  return fotos
    .map((f) => f?.imagen)
    .filter((r): r is string => typeof r === 'string' && r.startsWith(PREFIJO_FOTO))
    .map((r) => r.slice(PREFIJO_FOTO.length));
}

/** Ruta de foto segura: sin subir de carpeta y con extensión de imagen. */
export const RUTA_FOTO_VALIDA = /^(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9_.-]*\.(?:jpe?g|png|webp|avif)$/i;
export const esRutaFotoValida = (ruta: string) => RUTA_FOTO_VALIDA.test(ruta) && !ruta.includes('..');
