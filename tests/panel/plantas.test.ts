import { describe, expect, it } from 'vitest';
import { numero, revisarPlanta, seoPorDefecto, slugDesde } from '../../src/server/panel/plantas.ts';

const valida = {
  slug: 'olivo-de-copa',
  familia: 'olivos',
  nombre: { es: 'Olivo de copa', en: 'Olive tree' },
  nombreCientifico: 'Olea europaea',
  descripcion: { es: 'Bonito', en: 'Nice' },
  alturaMin: 1.5,
  alturaMax: 3,
  formatos: ['contenedor'],
  disponibilidad: 'disponible',
  precioDesde: 18.5,
  origen: 'Valencia',
};

describe('reglas de las plantas en el panel', () => {
  it('entiende números con coma y euros', () => {
    expect(numero('18,50 €')).toBe(18.5);
    expect(numero('')).toBeNull();
    expect(numero('mucho')).toBeNaN();
  });
  it('crea identificadores sin tildes', () => expect(slugDesde('Higuera común (ñ)')).toBe('higuera-comun-n'));
  it('acepta una planta correcta', () => expect(revisarPlanta(valida)).toEqual([]));
  it('no permite más de 4 m ni precio por unidad sin venta por unidad', () => {
    const e = revisarPlanta({ ...valida, alturaMax: 5, precioUnidad: 30 });
    expect(e.map((x) => x.campo)).toEqual(['alturaMax', 'precioUnidad']);
    expect(e[0].mensaje).toContain('4 m');
  });
  it('genera textos para buscadores con el precio', () => {
    expect(seoPorDefecto(valida).es.descripcion).toContain('desde 18.5 €');
  });
});
