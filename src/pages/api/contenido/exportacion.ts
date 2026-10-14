import type { APIRoute } from 'astro';
import { accesoContenido, respuestaJson } from '../../../server/contenido/api.ts';
import { exportarPublicado } from '../../../server/contenido/exportacion.ts';

export const prerender = false;

/** Contenido publicado para el build (scripts/contenido/descargar.ts) y las copias de seguridad. */
export const GET: APIRoute = async ({ request }) => {
  const repos = await accesoContenido(request);
  if (repos instanceof Response) return repos;
  return respuestaJson(await exportarPublicado(repos));
};
