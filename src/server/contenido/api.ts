import { env } from 'cloudflare:workers';
import { repositorios } from '../data/index.ts';
import type { Repositorios } from '../data/tipos.ts';
import { tokenValido } from './token.ts';

interface EntornoContenido {
  DB?: unknown;
  CONTENIDO_TOKEN?: string;
}

export const respuestaJson = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** Comprueba el token y la base; devuelve los repositorios o la respuesta de error. */
export async function accesoContenido(request: Request): Promise<Repositorios | Response> {
  const e = env as EntornoContenido;
  if (!(await tokenValido(request, e.CONTENIDO_TOKEN))) return respuestaJson({ ok: false, codigo: 'token' }, 401);
  const repos = await repositorios(e);
  return repos ?? respuestaJson({ ok: false, codigo: 'sin-base' }, 503);
}
