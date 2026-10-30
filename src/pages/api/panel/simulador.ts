import type { APIRoute } from 'astro';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { generateRenovationImage } from '../../../services/renovationAiService.ts';
import { resolveRenovationConfig, type RenovationConfig, type RenovationRequestPayload } from '../../../server/simulador/materiales.ts';

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
      config?: RenovationConfig | RenovationRequestPayload;
      options?: { hfToken?: string; geminiApiKey?: string };
    };

    if (!body || !body.image || !body.config) {
      return new Response(JSON.stringify({ ok: false, error: 'Faltan parámetros requeridos (image, config)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resolvedConfig = resolveRenovationConfig(body.config);
    const result = await generateRenovationImage(body.image, resolvedConfig, body.options || {});

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
