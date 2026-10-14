import type { Coleccion, Documento, Repositorios } from '../data/tipos.ts';
import { fotosDe, validarEntrada, type ErrorCampo } from './validacion.ts';

export interface EntradaImportada {
  coleccion: Coleccion;
  id: string;
  documento: Documento;
}

export interface InformeImportacion {
  importadas: number;
  errores: { coleccion: string; id: string; errores: ErrorCampo[] }[];
  fotosQueFaltan: string[];
}

/**
 * Carga inicial (o restauración) del contenido. Si una sola entrada no pasa la
 * validación no se importa nada: la web no puede quedar a medias.
 */
export async function importarContenido(
  repos: Repositorios,
  entradas: EntradaImportada[],
  fotosDisponibles: Set<string>,
  email: string,
): Promise<InformeImportacion> {
  const errores: InformeImportacion['errores'] = [];
  const fotosQueFaltan = new Set<string>();
  for (const e of entradas) {
    const r = validarEntrada(e.coleccion, e.id, e.documento);
    if (!r.ok) errores.push({ coleccion: e.coleccion, id: e.id, errores: r.errores });
    for (const f of fotosDe(e.documento)) if (!fotosDisponibles.has(f)) fotosQueFaltan.add(f);
  }
  if (errores.length || fotosQueFaltan.size) return { importadas: 0, errores, fotosQueFaltan: [...fotosQueFaltan] };
  const importadas = await repos.contenido.importar(entradas, { email, origen: 'importacion' });
  await repos.auditoria.registrar(email, 'importar contenido', `${importadas} entradas`);
  return { importadas, errores, fotosQueFaltan: [] };
}
