/**
 * Acceso de máquina a `/api/contenido/*` (build, importación y copias):
 * cabecera `Authorization: Bearer <CONTENIDO_TOKEN>`. Sin token configurado, cerrado.
 */
export async function tokenValido(request: Request, esperado: string | undefined): Promise<boolean> {
  if (!esperado || esperado.length < 32) return false;
  const recibido = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const hash = async (t: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
  const [a, b] = await Promise.all([hash(recibido), hash(esperado)]);
  let distinto = 0;
  for (let i = 0; i < a.length; i++) distinto |= a[i] ^ b[i];
  return distinto === 0;
}
