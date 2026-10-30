import type { APIRoute } from 'astro';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { processCarpentryAssistantMessage } from '../../../services/aiAssistantService.ts';

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  const s = sesionCon(locals, 'asistente');
  if (!s) {
    return new Response(JSON.stringify({ ok: false, error: 'Acceso no autorizado' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await request.json()) as {
      message?: string;
      hfToken?: string;
    };

    if (!body || !body.message) {
      return new Response(JSON.stringify({ ok: false, error: 'Falta el mensaje del usuario' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await processCarpentryAssistantMessage(body.message, {
      repos: s.repos,
      email: s.usuario.email,
      hfToken: body.hfToken,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno del asistente';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
