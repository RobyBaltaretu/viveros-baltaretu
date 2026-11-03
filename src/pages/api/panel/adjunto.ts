import type { APIRoute } from 'astro';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { fotoDeProyecto } from '../../../server/portafolio/portafolio.ts';
import { respuestaImagenPrivada } from '../../../server/panel/imagen-privada.ts';

export const prerender = false;

/** Foto privada del portafolio. Solo dentro del panel (el middleware exige la sesión) y nunca en caché compartida. */
export const GET: APIRoute = async ({ locals, url }) => {
  const s = sesionCon(locals, 'inventario');
  if (!s) return new Response(null, { status: 403 });
  const a = await fotoDeProyecto(s.repos, url.searchParams.get('id') ?? '');
  if (!a) return new Response(null, { status: 404 });
  return respuestaImagenPrivada(a.bytes, 'portafolio');
};
