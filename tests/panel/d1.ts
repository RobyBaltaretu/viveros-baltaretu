import { getPlatformProxy } from 'wrangler';
import type { BaseD1 } from '../../src/server/data/d1/base.ts';

/** D1 local y vacía (en memoria de workerd) para los tests. */
export async function d1DePrueba() {
  const plataforma = await getPlatformProxy<{ DB: BaseD1 }>({ environment: 'desarrollo', persist: false });
  return { db: plataforma.env.DB, cerrar: () => plataforma.dispose() };
}
