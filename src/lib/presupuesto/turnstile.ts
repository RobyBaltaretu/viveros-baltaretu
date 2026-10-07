const URL_SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Claves de prueba oficiales de Cloudflare: la de sitio siempre muestra el widget y la
 * secreta siempre valida. Solo se usan en desarrollo local, nunca en producción.
 */
export const TURNSTILE_PRUEBA = {
  claveSitio: '1x00000000000000000000AA',
  claveSecreta: '1x0000000000000000000000000000000AA',
} as const;

interface RespuestaSiteverify {
  success: boolean;
  'error-codes'?: string[];
}

/** Valida en servidor el token de Turnstile (obligatorio: el widget solo no protege). */
export async function verificarTurnstile(
  token: string,
  claveSecreta: string,
  ip: string | undefined,
  hacerFetch: typeof fetch = fetch,
): Promise<boolean> {
  const cuerpo = new FormData();
  cuerpo.append('secret', claveSecreta);
  cuerpo.append('response', token);
  if (ip) cuerpo.append('remoteip', ip);
  try {
    const respuesta = await hacerFetch(URL_SITEVERIFY, { method: 'POST', body: cuerpo });
    if (!respuesta.ok) return false;
    const datos = (await respuesta.json()) as RespuestaSiteverify;
    return datos.success === true;
  } catch {
    return false;
  }
}
