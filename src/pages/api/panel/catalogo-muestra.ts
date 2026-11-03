import type { APIRoute } from 'astro';
import { sesionCon } from '../../../server/panel/pagina';
import { respuestaImagenPrivada } from '../../../server/panel/imagen-privada';

export const prerender = false;
export const GET: APIRoute = async ({locals,url}) => {
  const s = sesionCon(locals,'facturas');
  if (!s) return new Response(null,{status:403});
  const ruta = url.searchParams.get('ruta') || '';
  if (!/^catalogo-materiales\/[a-z0-9-]+\/muestra\.webp$/i.test(ruta)) return new Response(null,{status:404});
  const foto = await s.repos.fotos.obtener(ruta);
  return foto ? respuestaImagenPrivada(foto.bytes,'foto') : new Response(null,{status:404});
};
