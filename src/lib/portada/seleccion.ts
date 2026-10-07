import type { CollectionEntry } from 'astro:content';

type Especie = CollectionEntry<'catalogo'>;

/**
 * Una especie por familia: la destacada o, si no hay, la más alta. Ordenadas con
 * las destacadas primero y, dentro, de mayor a menor altura: cuanto más grande es
 * el ejemplar junto a la persona, más clara es la escala.
 */
export function representantesPorFamilia(especies: Especie[]): Especie[] {
  const porFamilia = new Map<string, Especie>();
  for (const e of especies) {
    const actual = porFamilia.get(e.data.familia);
    const mejor =
      !actual ||
      Number(e.data.destacada) > Number(actual.data.destacada) ||
      (e.data.destacada === actual.data.destacada && e.data.alturaMax > actual.data.alturaMax);
    if (mejor) porFamilia.set(e.data.familia, e);
  }
  return [...porFamilia.values()].sort(
    (a, b) => Number(b.data.destacada) - Number(a.data.destacada) || b.data.alturaMax - a.data.alturaMax,
  );
}
