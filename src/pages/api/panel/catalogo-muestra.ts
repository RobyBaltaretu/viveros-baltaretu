import type { APIRoute } from 'astro';
import { sesionCon } from '../../../server/panel/pagina';
import { respuestaImagenPrivada } from '../../../server/panel/imagen-privada';

export const prerender = false;
export const GET: APIRoute = async ({locals,url}) => {
  const s = sesionCon(locals,'facturas');
  if (!s) return new Response(null,{status:403});
  const ruta = url.searchParams.get('ruta') || '';
  if (!/^catalogo-materiales\/[a-z0-9-]+\/muestra\.webp$/i.test(ruta)) return new Response(null,{status:404});
  // Las nuevas muestras se guardan en adjuntos privados. Soporte de lectura
  // para las importaciones antiguas, hasta completar su migración controlada.
  const adjunto = await s.repos.adjuntos.obtener(ruta);
  if (adjunto?.ambito === 'catalogo') return respuestaImagenPrivada(adjunto.bytes);
  const antigua = await s.repos.fotos.obtener(ruta);
  return antigua ? respuestaImagenPrivada(antigua.bytes) : new Response(null,{status:404});
};
