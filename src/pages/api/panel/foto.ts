import type { APIRoute } from 'astro';
import { sesionCon } from '../../../server/panel/pagina.ts';

export const prerender = false;

/** Ver una foto dentro del panel (protegido por src/middleware.ts). */
export const GET: APIRoute = async ({ locals, url }) => {
  const s = sesionCon(locals);
  if (!s) return new Response(null, { status: 401 });
  const foto = await s.repos.fotos.obtener(url.searchParams.get('ruta') ?? '');
  if (!foto) return new Response(null, { status: 404 });
  return new Response(foto.bytes as Uint8Array<ArrayBuffer>, { headers: { 'Content-Type': foto.tipo, 'Cache-Control': 'private, max-age=3600' } });
};
