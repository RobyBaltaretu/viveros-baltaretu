/**
 * Datos de prueba: rellenan los huecos pendientes ([PLACEHOLDER] o vacíos) para
 * ver la web completa en local y en las vistas previas de rama. Nunca sustituyen
 * un dato real y nunca se usan en producción (ver `esEntornoDePrueba`).
 */
export type Parcial<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly (Parcial<U> | undefined)[]
    : T extends object
      ? { readonly [K in keyof T]?: Parcial<T[K]> }
      : T;

export const estaPendiente = (texto: string) => texto.trim() === '' || texto.includes('[PLACEHOLDER');

export function rellenarConPrueba<T>(real: T, prueba: Parcial<T> | undefined): T {
  if (prueba === undefined || prueba === null) return real;
  if (typeof real === 'string') {
    return (estaPendiente(real) && typeof prueba === 'string' ? prueba : real) as T;
  }
  if (Array.isArray(real)) {
    const lista = prueba as readonly unknown[];
    return real.map((item, i) => rellenarConPrueba(item, lista[i] as Parcial<typeof item>)) as T;
  }
  if (real && typeof real === 'object') {
    const resultado: Record<string, unknown> = { ...(real as Record<string, unknown>) };
    for (const [clave, valor] of Object.entries(resultado)) {
      resultado[clave] = rellenarConPrueba(valor, (prueba as Record<string, unknown>)[clave] as Parcial<typeof valor>);
    }
    return resultado as T;
  }
  return real;
}
