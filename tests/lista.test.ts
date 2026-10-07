import { describe, expect, it } from 'vitest';
import { agregar, cambiarCantidad, leerLista, quitar, totalUnidades } from '../src/lib/presupuesto/lista';

describe('lista de presupuesto', () => {
  it('agrega, suma cantidades y quita', () => {
    let l = agregar([], 'phoenix-canariensis');
    l = agregar(l, 'phoenix-canariensis', 3);
    l = agregar(l, 'olivo-ornamental-copa', 2);
    expect(l).toEqual([
      { slug: 'phoenix-canariensis', cantidad: 4 },
      { slug: 'olivo-ornamental-copa', cantidad: 2 },
    ]);
    expect(totalUnidades(l)).toBe(6);
    expect(quitar(l, 'phoenix-canariensis')).toEqual([{ slug: 'olivo-ornamental-copa', cantidad: 2 }]);
  });

  it('limita las cantidades entre 1 y el máximo', () => {
    const l = agregar([], 'higuera-comun');
    expect(cambiarCantidad(l, 'higuera-comun', 0)[0]!.cantidad).toBe(1);
    expect(cambiarCantidad(l, 'higuera-comun', 2.6)[0]!.cantidad).toBe(3);
    expect(cambiarCantidad(l, 'higuera-comun', 1e9)[0]!.cantidad).toBe(10_000);
  });

  it('lee lo guardado descartando datos corruptos o repetidos', () => {
    expect(leerLista('no es json')).toEqual([]);
    expect(leerLista('{"a":1}')).toEqual([]);
    expect(
      leerLista(
        JSON.stringify([
          { slug: 'cica', cantidad: 2 },
          { slug: 'cica', cantidad: 5 },
          { slug: '<script>', cantidad: 1 },
          { slug: 'yuca', cantidad: 'muchas' },
        ]),
      ),
    ).toEqual([{ slug: 'cica', cantidad: 2 }]);
  });
});
