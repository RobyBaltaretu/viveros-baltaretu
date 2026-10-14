import type { BaseD1 } from './d1/base.ts';
import { crearRepositoriosD1 } from './d1/index.ts';
import { asegurarEsquema } from './d1/migraciones.ts';
import type { Repositorios } from './tipos.ts';

export type * from './tipos.ts';
export { COLECCIONES, ESTADOS_PRESUPUESTO, ROLES } from './tipos.ts';

/** Bindings del Worker que usa la capa de datos. */
export interface EntornoDatos {
  DB?: unknown;
}

/** Repositorios sobre la base del entorno, con el esquema al día. `null` si no hay base configurada. */
export async function repositorios(env: EntornoDatos): Promise<Repositorios | null> {
  if (!env.DB) return null;
  const db = env.DB as BaseD1;
  await asegurarEsquema(db);
  return crearRepositoriosD1(db);
}

/** Para scripts y tests que ya tienen una base local. */
export { crearRepositoriosD1, asegurarEsquema };
export { aplicarMigraciones } from './d1/migraciones.ts';
