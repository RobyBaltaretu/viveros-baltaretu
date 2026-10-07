import { describe, expect, it } from 'vitest';
import { representantesPorFamilia } from '../src/lib/portada/seleccion';

const especie = (slug: string, familia: string, alturaMax: number, destacada = false) =>
  ({ id: slug, data: { slug, familia, alturaMax, destacada } }) as unknown as Parameters<typeof representantesPorFamilia>[0][number];

describe('representantesPorFamilia', () => {
  it('elige una especie por familia: la destacada o, si no hay, la más alta', () => {
    const elegidas = representantesPorFamilia([
      especie('palmito', 'palmeras', 3),
      especie('washingtonia', 'palmeras', 10),
      especie('olivo-copa', 'olivos', 4, true),
      especie('olivo-grande', 'olivos', 6),
    ]).map((e) => e.data.slug);
    expect(elegidas).toEqual(['olivo-copa', 'washingtonia']);
  });

  it('sin especies devuelve una lista vacía', () => {
    expect(representantesPorFamilia([])).toEqual([]);
  });
});
