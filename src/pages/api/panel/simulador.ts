import type { APIRoute } from 'astro';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { generateRenovationImage } from '../../../services/renovationAiService.ts';
import type { RenovationConfig } from '../../../server/simulador/materiales.ts';

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  const s = sesionCon(locals, 'editar');
  if (!s) {
    return new Response(JSON.stringify({ ok: false, error: 'Acceso no autorizado' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await request.json()) as {
      image?: string;
      config?: RenovationConfig;
      options?: { hfToken?: string; geminiApiKey?: string };
    };

    if (!body || !body.image || !body.config) {
      return new Response(JSON.stringify({ ok: false, error: 'Faltan parámetros requeridos (image, config)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await generateRenovationImage(body.image, body.config, body.options || {});

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno al procesar el simulador';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
