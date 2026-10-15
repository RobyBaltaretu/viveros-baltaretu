import type { APIRoute } from 'astro';
import { sesionCon } from '../../../server/panel/pagina.ts';

export const prerender = false;

/** Foto de un ticket (solo en el panel; nunca sale en la web). */
export const GET: APIRoute = async ({ locals, url }) => {
  const s = sesionCon(locals, 'gastos');
  if (!s) return new Response(null, { status: 403 });
  const t = await s.repos.tickets.obtener(url.searchParams.get('id') ?? '');
  if (!t) return new Response(null, { status: 404 });
  return new Response(new Blob([t.bytes as Uint8Array<ArrayBuffer>], { type: t.tipo }), { headers: { 'Content-Type': t.tipo } });
};
