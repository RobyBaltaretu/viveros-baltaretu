import type { APIRoute } from 'astro';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { respuestaImagenPrivada } from '../../../server/panel/imagen-privada.ts';

export const prerender = false;

/** Foto privada del panel: solo bytes de imágenes raster válidas. */
export const GET: APIRoute = async ({ locals, url }) => {
  const s = sesionCon(locals);
  if (!s) return new Response(null, { status: 401 });
  const foto = await s.repos.fotos.obtener(url.searchParams.get('ruta') ?? '');
  if (!foto) return new Response(null, { status: 404 });
  return respuestaImagenPrivada(foto.bytes, 'foto');
};
