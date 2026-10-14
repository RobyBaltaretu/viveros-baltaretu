import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { mismoOrigen, sesionPanel, type EntornoPanel } from './server/panel/acceso.ts';

/**
 * Protege el panel (`/panel` y `/api/panel/*`): Cloudflare Access delante y,
 * además, validación del token y del rol en cada petición. El resto de la web
 * es estática y no pasa por aquí.
 */
const CABECERAS = {
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
};

export const onRequest = defineMiddleware(async (contexto, siguiente) => {
  const ruta = contexto.url.pathname;
  const esApi = ruta.startsWith('/api/panel');
  if (!esApi && !(ruta === '/panel' || ruta.startsWith('/panel/'))) return siguiente();

  const json = (codigo: string, estado: number) =>
    new Response(JSON.stringify({ ok: false, codigo }), { status: estado, headers: { 'Content-Type': 'application/json', ...CABECERAS } });

  if (!mismoOrigen(contexto.request)) return json('origen', 403);
  const sesion = await sesionPanel(contexto.request, env as EntornoPanel);
  if (esApi && sesion.estado !== 'ok') return json(sesion.estado, sesion.estado === 'sin-activar' ? 503 : 401);
  contexto.locals.panel = sesion;

  const respuesta = await siguiente();
  for (const [k, v] of Object.entries(CABECERAS)) respuesta.headers.set(k, v);
  return respuesta;
});
