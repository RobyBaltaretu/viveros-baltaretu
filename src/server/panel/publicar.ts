import type { Cambio, Coleccion, Documento, Entrada, Repositorios } from '../data/tipos.ts';
import { seccionDe } from './textos.ts';

/**
 * "Publicar cambios": pasa los borradores a publicado y lanza un build con el
 * Deploy Hook de Workers Builds. El build sube una versión nueva que el
 * propietario revisa y publica en Cloudflare (decisión del propietario).
 */
export interface EntornoPublicar {
  DEPLOY_HOOK_URL?: string;
}

const NOMBRE_COLECCION: Record<Coleccion, string> = {
  catalogo: 'Planta',
  ajustes: 'Textos',
  paginas: 'Página',
  proyectos: 'Proyecto',
  guias: 'Guía',
};

/** Nombre legible de una entrada: el de la planta, el título o el de la sección del panel. */
export function nombreEntrada(coleccion: Coleccion, id: string, doc: Documento | null): string {
  const d = (doc?.datos ?? {}) as { nombre?: { es?: string }; titulo?: { es?: string } };
  const nombre = coleccion === 'catalogo' ? d.nombre?.es : coleccion === 'ajustes' || coleccion === 'paginas' ? seccionDe(coleccion, id)?.titulo : d.titulo?.es;
  return `${NOMBRE_COLECCION[coleccion]}: ${nombre || id}`;
}

export function describirPendiente(e: Entrada): string {
  const que = e.archivada ? 'se quita de la web' : e.publicado ? 'cambiada' : 'nueva';
  return `${nombreEntrada(e.coleccion, e.id, e.borrador)} (${que})`;
}

export function describirCambio(c: Cambio): string {
  const nombre = nombreEntrada(c.coleccion, c.entradaId, c.despues ?? c.antes);
  if (c.origen === 'importacion') return `${nombre}: carga inicial`;
  if (c.antes === null) return c.origen === 'deshacer' ? `${nombre}: recuperada` : `${nombre}: añadida`;
  if (c.despues === null) return `${nombre}: quitada de la web`;
  return c.origen === 'deshacer' ? `${nombre}: cambio deshecho` : `${nombre}: cambiada`;
}

export type ResultadoPublicar = { estado: 'lanzada' | 'sin-cambios' | 'sin-configurar' | 'error'; cambios: number };

/** Validar que la URL es un Deploy Hook de Cloudflare (no se llama a cualquier dirección). */
export const esDeployHook = (url: string | undefined): url is string =>
  !!url && /^https:\/\/api\.cloudflare\.com\/client\/v4\/workers\/builds\/deploy_hooks\/[\w-]+$/.test(url);

export async function publicarCambios(repos: Repositorios, email: string, env: EntornoPublicar, llamar: typeof fetch = fetch): Promise<ResultadoPublicar> {
  const cambios = await repos.contenido.publicarTodo();
  if (cambios === 0) {
    await repos.publicaciones.registrar(email, 'sin-cambios');
    return { estado: 'sin-cambios', cambios };
  }
  if (!esDeployHook(env.DEPLOY_HOOK_URL)) {
    await repos.publicaciones.registrar(email, 'error', 'Falta DEPLOY_HOOK_URL');
    await repos.auditoria.registrar(email, 'publicar', `${cambios} cambios (sin Deploy Hook)`);
    return { estado: 'sin-configurar', cambios };
  }
  try {
    const r = await llamar(env.DEPLOY_HOOK_URL, { method: 'POST' });
    if (!r.ok) throw new Error(`Deploy Hook respondió ${r.status}`);
    await repos.publicaciones.registrar(email, 'lanzada', `${cambios} cambios`);
    await repos.auditoria.registrar(email, 'publicar', `${cambios} cambios`);
    return { estado: 'lanzada', cambios };
  } catch (error) {
    await repos.publicaciones.registrar(email, 'error', String(error).slice(0, 200));
    return { estado: 'error', cambios };
  }
}
