import { getPlatformProxy } from 'wrangler';
import { asegurarEsquema, crearRepositoriosD1 } from '../../src/server/data/index.ts';
import type { BaseD1 } from '../../src/server/data/d1/base.ts';

/** Repositorios sobre la D1 local de wrangler (entorno `desarrollo`), la misma que usa `npm run dev`. */
export async function reposLocales(opciones: { persistir?: boolean } = {}) {
  const p = await getPlatformProxy<{ DB: BaseD1 }>({ environment: 'desarrollo', persist: opciones.persistir ?? true });
  await asegurarEsquema(p.env.DB);
  return { repos: crearRepositoriosD1(p.env.DB), cerrar: () => p.dispose() };
}

/** Lee `--nombre valor` de los argumentos. */
export const argumento = (nombre: string) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
