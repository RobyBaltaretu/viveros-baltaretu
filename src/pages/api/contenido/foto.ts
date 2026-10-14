import type { APIRoute } from 'astro';
import { accesoContenido, respuestaJson } from '../../../server/contenido/api.ts';
import { esRutaFotoValida } from '../../../server/contenido/validacion.ts';
import { MAXIMO_FOTO } from '../../../server/panel/fotos.ts';

export const prerender = false;

const TIPOS: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };

/** Descarga una foto (build y copias). */
export const GET: APIRoute = async ({ request, url }) => {
  const repos = await accesoContenido(request);
  if (repos instanceof Response) return repos;
  const foto = await repos.fotos.obtener(url.searchParams.get('ruta') ?? '');
  if (!foto) return respuestaJson({ ok: false, codigo: 'no-existe' }, 404);
  return new Response(foto.bytes as Uint8Array<ArrayBuffer>, { headers: { 'Content-Type': foto.tipo, 'Cache-Control': 'no-store' } });
};

/** Sube una foto (importación y restauración). */
export const PUT: APIRoute = async ({ request, url }) => {
  const repos = await accesoContenido(request);
  if (repos instanceof Response) return repos;
  const ruta = url.searchParams.get('ruta') ?? '';
  if (!esRutaFotoValida(ruta)) return respuestaJson({ ok: false, codigo: 'ruta' }, 400);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAXIMO_FOTO) return respuestaJson({ ok: false, codigo: 'tamano' }, 413);
  await repos.fotos.guardar({ ruta, tipo: TIPOS[ruta.split('.').pop()!.toLowerCase()], bytes }, 'importacion');
  return respuestaJson({ ok: true });
};
