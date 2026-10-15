import type { APIRoute } from 'astro';
import { accesoContenido, respuestaJson } from '../../../server/contenido/api.ts';

export const prerender = false;

/**
 * Publicación automática (scripts/contenido/desplegar.ts):
 * - GET: hora del servidor y cuántas publicaciones del panel esperan llegar a la web.
 * - POST `{ hasta }`: tras desplegar, marca como en la web las lanzadas hasta esa hora.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const repos = await accesoContenido(request);
  if (repos instanceof Response) return repos;
  const ahora = new Date().toISOString();
  const hasta = url.searchParams.get('hasta') ?? ahora;
  return respuestaJson({ ahora, pendientes: await repos.publicaciones.pendientes(hasta) });
};

export const POST: APIRoute = async ({ request }) => {
  const repos = await accesoContenido(request);
  if (repos instanceof Response) return repos;
  const cuerpo = (await request.json().catch(() => null)) as { hasta?: unknown } | null;
  const hasta = typeof cuerpo?.hasta === 'string' && !Number.isNaN(Date.parse(cuerpo.hasta)) ? cuerpo.hasta : null;
  if (!hasta) return respuestaJson({ ok: false, codigo: 'hasta' }, 400);
  const marcadas = await repos.publicaciones.marcarEnWeb(hasta);
  await repos.auditoria.registrar('sistema', 'en-la-web', `${marcadas} publicaciones`);
  return respuestaJson({ ok: true, marcadas });
};
