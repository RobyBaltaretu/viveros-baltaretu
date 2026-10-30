import { describe, expect, it } from 'vitest';
import { enlaceNuevoPresupuesto, lineasDelTrabajo, llevaDelTrabajo } from '../../src/server/catalogo/al-presupuesto.ts';
import type { ResultadoEscandallo } from '../../src/server/catalogo/escandallo.ts';

const e = {
  precio: 734.07,
  grupos: [
    { grupo: 'Materiales', coste: 155.77, precio: 202.43 },
    { grupo: 'Herrajes y accesorios', coste: 121.2, precio: 157.6 },
    { grupo: 'Mano de obra', coste: 247.72, precio: 374.04 },
  ],
  descripcion: '200 × 240 × 60 cm · 2 puertas · Material del cuerpo: Melamina blanca 19 mm · Material de las puertas: Roble',
} as unknown as ResultadoEscandallo;

describe('del catálogo al presupuesto', () => {
  it('en una línea: el trabajo con sus medidas y los materiales; nunca costes', () => {
    expect(lineasDelTrabajo({ nombre: 'Armario empotrado' }, e, 'una')).toEqual([
      { concepto: 'Armario empotrado (200 × 240 × 60 cm, 2 puertas)', cantidad: 1, precio: 734.07, material: 'Melamina blanca 19 mm, Roble', extra: false },
    ]);
  });

  it('por partes: una línea por grupo y la suma es el precio del trabajo', () => {
    const l = lineasDelTrabajo({ nombre: 'Armario empotrado' }, e, 'partes');
    expect(l.map((x) => x.concepto)).toEqual(['Materiales: Armario empotrado (200 × 240 × 60 cm, 2 puertas)', 'Herrajes y accesorios: Armario empotrado', 'Mano de obra: Armario empotrado']);
    expect(Math.round(l.reduce((t, x) => t + x.precio, 0) * 100)).toBe(73407);
  });

  it('textos largos recortados a lo que admite el presupuesto, y enlace a uno nuevo con las líneas', () => {
    const largo = lineasDelTrabajo({ nombre: 'x'.repeat(250) }, { ...e, descripcion: `10 cm · Material: ${'m'.repeat(200)}` }, 'una')[0]!;
    expect(largo.concepto.length).toBe(200);
    expect(largo.material.length).toBe(120);
    const url = new URL(enlaceNuevoPresupuesto(lineasDelTrabajo({ nombre: 'Armario' }, e, 'una'), 'Armario'), 'https://x');
    expect(url.pathname).toBe('/panel/presupuestos-cliente/nuevo');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ concepto: 'Armario', filas: '1', 'l0.precio': '734,07', 'l0.cantidad': '1' });
  });

  it('material a material: un artículo por línea (juntos si se repite), con cantidad y precio por unidad', () => {
    const lineas = [
      { articuloId: 'mel', articulo: 'Melamina blanca 19 mm', unidad: 'm²', cantidad: 3.3, precioUnidad: 20, grupo: 'Materiales' },
      { articuloId: 'bis', articulo: 'Bisagra cazoleta', unidad: 'ud', cantidad: 8, precioUnidad: 2.4, grupo: 'Herrajes y accesorios' },
      { articuloId: 'mel', articulo: 'Melamina blanca 19 mm', unidad: 'm²', cantidad: 1.25, precioUnidad: 20, grupo: 'Materiales' },
    ];
    const conLineas = { ...e, lineas } as unknown as ResultadoEscandallo;
    expect(llevaDelTrabajo(conLineas).map((x) => [x.articulo, x.cantidad])).toEqual([
      ['Melamina blanca 19 mm', 4.55],
      ['Bisagra cazoleta', 8],
    ]);
    expect(lineasDelTrabajo({ nombre: 'Armario' }, conLineas, 'detalle')).toEqual([
      { concepto: 'Melamina blanca 19 mm (m²)', cantidad: 4.55, precio: 20, material: '', extra: false },
      { concepto: 'Bisagra cazoleta', cantidad: 8, precio: 2.4, material: '', extra: false },
    ]);
  });
});
