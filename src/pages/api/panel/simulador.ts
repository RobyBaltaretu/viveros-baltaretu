import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { iaDe } from '../../../plataforma/configuracion.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { claveGemini, simular } from '../../../server/simulador/cuota.ts';
import { resolveRenovationConfig, type RenovationConfig, type RenovationRequestPayload } from '../../../server/simulador/materiales.ts';

export const prerender = false;

const json = (estado: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });

/**
 * Proxy del simulador: la foto, la zona marcada y la configuración llegan del
 * navegador; la clave de Gemini se pone aquí (secreto del Worker). Cualquier
 * clave que llegara en la petición se ignora.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  const s = sesionCon(locals, 'editar');
  if (!s) return json(403, { ok: false, error: 'Acceso no autorizado' });

  let body: { image?: unknown; mask?: unknown; config?: RenovationConfig | RenovationRequestPayload } | null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if (!body || typeof body.image !== 'string' || !body.config) return json(400, { ok: false, error: 'Faltan la foto o la configuración.' });

  let config: RenovationConfig;
  try {
    config = resolveRenovationConfig(body.config);
  } catch {
    return json(400, { ok: false, error: 'La configuración de la reforma no es válida.' });
  }
  const cliente = clienteActual();
  const r = await simular(
    { cliente: cliente.id, ia: iaDe(cliente), apiKey: claveGemini(env as Record<string, unknown>), uso: s.repos.usoSimulador },
    { image: body.image, mascara: typeof body.mask === 'string' && body.mask ? body.mask : undefined, config },
  );
  return json(r.estado, r.cuerpo);
};
