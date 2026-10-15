/** Archivo que deja `descargar.ts` con la hora hasta la que el build incluye lo publicado. */
export const MARCA_DESCARGA = '.contenido-descargado.json';

export type Modo = 'desplegar' | 'subir-version';

/**
 * Qué hace el paso de despliegue de Workers Builds:
 * - Si el build lleva publicaciones del panel que aún no están en la web, o el
 *   propietario lo pide con `PUBLICAR_SIEMPRE=1`: `wrangler deploy` (sale ya a la web).
 * - Si no (por ejemplo, un cambio de código en `main`): `wrangler versions upload`,
 *   y el propietario la publica en Cloudflare como hasta ahora.
 */
export function modoDespliegue(pendientes: number, publicarSiempre: string | undefined): Modo {
  return pendientes > 0 || publicarSiempre === '1' ? 'desplegar' : 'subir-version';
}
