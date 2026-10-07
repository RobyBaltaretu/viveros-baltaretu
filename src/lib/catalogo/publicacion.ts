/**
 * Regla de CLAUDE.md: nada con `revisado: false` se publica en producción.
 *
 * Las fichas sin revisar solo se muestran en desarrollo local y en los
 * despliegues de preview de Vercel (VERCEL_ENV=preview). Cualquier otro build,
 * incluido el de producción, las excluye.
 */
export interface EntornoPublicacion {
  dev: boolean;
  vercelEnv?: string | undefined;
}

export function mostrarNoRevisadas({ dev, vercelEnv }: EntornoPublicacion): boolean {
  return dev || vercelEnv === 'preview';
}

export function filtrarPublicables<T extends { data: { revisado: boolean } }>(
  entradas: T[],
  entorno: EntornoPublicacion,
): T[] {
  if (mostrarNoRevisadas(entorno)) return entradas;
  return entradas.filter((entrada) => entrada.data.revisado);
}
