import { describe, expect, it } from 'vitest';
import {
  SIN_FILTROS,
  contarActivos,
  cumpleFiltros,
  escribirFiltros,
  leerFiltros,
  type DatosFiltrables,
} from '../src/lib/catalogo/filtros';

const palmera: DatosFiltrables = { familia: 'palmeras', alturaMin: 2, alturaMax: 10, formatos: ['contenedor', 'cepellon'] };
const olivo: DatosFiltrables = {
  familia: 'olivos',
  alturaMin: 2.5,
  alturaMax: 6,
  formatos: ['cepellon'],
  perimetro: [80, 250],
};

describe('cumpleFiltros', () => {
  it('sin filtros cumple todo', () => {
    expect(cumpleFiltros(palmera, SIN_FILTROS)).toBe(true);
  });
  it('altura: basta con que los rangos se solapen', () => {
    expect(cumpleFiltros(olivo, { ...SIN_FILTROS, altura: [5, 8] })).toBe(true);
    expect(cumpleFiltros(olivo, { ...SIN_FILTROS, altura: [7, 9] })).toBe(false);
    expect(cumpleFiltros(olivo, { ...SIN_FILTROS, altura: [0, 2.5] })).toBe(true);
  });
  it('familias y formatos: cualquiera de los marcados', () => {
    expect(cumpleFiltros(palmera, { ...SIN_FILTROS, familias: ['olivos', 'palmeras'] })).toBe(true);
    expect(cumpleFiltros(palmera, { ...SIN_FILTROS, familias: ['olivos'] })).toBe(false);
    expect(cumpleFiltros(palmera, { ...SIN_FILTROS, formatos: ['raiz-desnuda', 'cepellon'] })).toBe(true);
    expect(cumpleFiltros(olivo, { ...SIN_FILTROS, formatos: ['contenedor'] })).toBe(false);
  });
  it('perímetro: las especies sin dato no pasan el filtro', () => {
    expect(cumpleFiltros(olivo, { ...SIN_FILTROS, perimetro: 'mas-80' })).toBe(true);
    expect(cumpleFiltros(olivo, { ...SIN_FILTROS, perimetro: 'hasta-30' })).toBe(false);
    expect(cumpleFiltros(palmera, { ...SIN_FILTROS, perimetro: '30-80' })).toBe(false);
  });
  it('venta por unidad: solo las especies marcadas', () => {
    expect(cumpleFiltros({ ...palmera, ventaUnitaria: true }, { ...SIN_FILTROS, unidad: true })).toBe(true);
    expect(cumpleFiltros(palmera, { ...SIN_FILTROS, unidad: true })).toBe(false);
  });
});

describe('estado en la URL', () => {
  it('ida y vuelta', () => {
    const estado = {
      altura: [2, 5] as [number, number],
      familias: ['olivos' as const],
      formatos: ['cepellon' as const],
      perimetro: '30-80' as const,
      unidad: true,
    };
    const params = escribirFiltros(estado);
    expect(params.toString()).toBe('altura=2-5&familia=olivos&formato=cepellon&perimetro=30-80&unidad=1');
    expect(leerFiltros(params, 10)).toEqual(estado);
    expect(contarActivos(estado)).toBe(5);
  });
  it('ignora valores no válidos y rangos que no filtran nada', () => {
    const e = leerFiltros(new URLSearchParams('altura=0-10&familia=cactus,olivos&formato=x&perimetro=enorme'), 10);
    expect(e).toEqual({ ...SIN_FILTROS, familias: ['olivos'] });
    expect(leerFiltros(new URLSearchParams('altura=6-2'), 10).altura).toBeNull();
    expect(leerFiltros(new URLSearchParams('altura=3-50'), 10).altura).toEqual([3, 10]);
  });
});
