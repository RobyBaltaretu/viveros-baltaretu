/**
 * Regla de CLAUDE.md: nada con `revisado: false` se publica en producción.
 *
 * Las fichas sin revisar solo se muestran en desarrollo local y en los builds
 * de Cloudflare Workers Builds de ramas que no son la de producción
 * (WORKERS_CI_BRANCH distinta de PRODUCTION_BRANCH, por defecto `main`).
 * Cualquier otro build, incluido el de producción y el de la CI, las excluye.
 */
export interface EntornoPublicacion {
  dev: boolean;
  /** Rama que está construyendo Workers Builds (`WORKERS_CI_BRANCH`). */
  ramaCi?: string | undefined;
  ramaProduccion?: string | undefined;
}

export function mostrarNoRevisadas({ dev, ramaCi, ramaProduccion }: EntornoPublicacion): boolean {
  if (dev) return true;
  if (!ramaCi) return false;
  return ramaCi !== (ramaProduccion || 'main');
}

export function filtrarPublicables<T extends { data: { revisado: boolean } }>(
  entradas: T[],
  entorno: EntornoPublicacion,
): T[] {
  if (mostrarNoRevisadas(entorno)) return entradas;
  return entradas.filter((entrada) => entrada.data.revisado);
}
