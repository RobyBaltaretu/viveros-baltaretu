import type { APIRoute } from 'astro';
import { accesoContenido, respuestaJson } from '../../../server/contenido/api.ts';
import { importarContenido, type EntradaImportada } from '../../../server/contenido/importacion.ts';

export const prerender = false;

/** Carga inicial o restauración del contenido (las fotos se suben antes con PUT /api/contenido/foto). */
export const POST: APIRoute = async ({ request }) => {
  const repos = await accesoContenido(request);
  if (repos instanceof Response) return repos;
  const cuerpo = (await request.json().catch(() => null)) as { entradas?: EntradaImportada[] } | null;
  if (!cuerpo || !Array.isArray(cuerpo.entradas)) return respuestaJson({ ok: false, codigo: 'formato' }, 400);
  const fotos = new Set((await repos.fotos.listar()).map((f) => f.ruta));
  const informe = await importarContenido(repos, cuerpo.entradas, fotos, 'importacion');
  return respuestaJson({ ok: informe.importadas > 0, ...informe }, informe.importadas > 0 ? 200 : 422);
};
