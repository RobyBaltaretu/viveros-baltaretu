import type { APIRoute } from 'astro';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { respuestaImagenPrivada } from '../../../server/panel/imagen-privada.ts';

export const prerender = false;

/** Foto privada de un ticket, no cacheable y nunca con MIME confiado a D1. */
export const GET: APIRoute = async ({ locals, url }) => {
  const s = sesionCon(locals, 'gastos');
  if (!s) return new Response(null, { status: 403 });
  const ticket = await s.repos.tickets.obtener(url.searchParams.get('id') ?? '');
  if (!ticket) return new Response(null, { status: 404 });
  return respuestaImagenPrivada(ticket.bytes);
};
