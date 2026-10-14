import type { Coleccion, Documento, Repositorios } from '../data/tipos.ts';
import { fotosDe } from './validacion.ts';

export interface Exportacion {
  entradas: { coleccion: Coleccion; id: string; datos: Record<string, unknown>; cuerpo: string }[];
  /** Rutas de las fotos que usan las entradas publicadas (relativas a `src/assets`). */
  fotos: string[];
}

/** Lo mínimo que debe tener una exportación para construir la web. */
export const OBLIGATORIAS: [Coleccion, string][] = [
  ['ajustes', 'empresa'],
  ['ajustes', 'condiciones'],
  ['ajustes', 'portada'],
  ['ajustes', 'catalogo'],
  ['paginas', 'nosotros'],
  ['paginas', 'reparto'],
  ['paginas', 'aviso-legal'],
  ['paginas', 'privacidad'],
  ['paginas', 'cookies'],
];

/** Contenido publicado, en el formato de los archivos de `src/content`. */
export async function exportarPublicado(repos: Repositorios): Promise<Exportacion> {
  const publicadas = await repos.contenido.publicadas();
  const fotos = new Set<string>();
  for (const p of publicadas) for (const f of fotosDe(p.documento)) fotos.add(f);
  return {
    entradas: publicadas.map(({ coleccion, id, documento }: { coleccion: Coleccion; id: string; documento: Documento }) => ({
      coleccion,
      id,
      datos: documento.datos,
      cuerpo: documento.cuerpo,
    })),
    fotos: [...fotos].sort(),
  };
}

/** Qué falta para poder construir la web (vacío = completa). */
export function faltantes(exportacion: Exportacion): string[] {
  const hay = new Set(exportacion.entradas.map((e) => `${e.coleccion}/${e.id}`));
  return OBLIGATORIAS.map(([c, id]) => `${c}/${id}`).filter((k) => !hay.has(k));
}
