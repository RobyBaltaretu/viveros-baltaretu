import { describe, expect, it } from 'vitest';
import { categoriaDe, depurarConCuenta, numeroDe, precioTarifa, unidadDe } from '../../src/server/catalogo/importacion-proveedor.ts';
import { interpretarTextoConGroq, repararJsonCortado } from '../../src/server/catalogo/interpretacion-groq.ts';

describe('importador: catálogos distintos, fichas tolerantes', () => {
  it('reconoce categorías y unidades escritas a la manera de cada proveedor', () => {
    expect(categoriaDe('Tableros')).toBe('tableros');
    expect(categoriaDe('Melamina')).toBe('tableros');
    expect(categoriaDe('', 'Bisagra cazoleta 35 mm')).toBe('herrajes');
    expect(categoriaDe('CANTOS PVC')).toBe('cantos');
    expect(categoriaDe('Barniz al agua')).toBe('acabados');
    expect(categoriaDe('folleto')).toBeNull();
    expect(unidadDe('m2')).toBe('m²');
    expect(unidadDe('Metros lineales')).toBe('ml');
    expect(unidadDe('pza.')).toBe('ud');
    expect(unidadDe('rollo')).toBeUndefined();
  });
  it('lee números en formato español e inglés', () => {
    expect(numeroDe('19 mm')).toBe(19);
    expect(numeroDe('1.234,56 €')).toBe(1234.56);
    expect(numeroDe('12,5')).toBe(12.5);
    expect(numeroDe('2,440')).toBe(2440);
    expect(numeroDe('n/d')).toBeNull();
  });
  it('no tira la ficha por un campo de más, mayúsculas o números como texto; el precio pasa a coste', () => {
    const { lista, descartadas } = depurarConCuenta([
      { categoria: 'Tableros', nombre: 'Melamina blanca', espesorMm: '19 mm', unidad: 'm2', precio: '12,40 €', descripcion: 'Uso interior', pagina: '3' },
      { categoria: 'Herrajes', nombre: 'Bisagra 110º', referencia: 12345, unidad: 'uds', brillo: 'raro' },
      { categoria: 'folleto', nombre: 'Llámenos' },
      { nombre: 'X' },
    ], 3, 3);
    expect(descartadas).toBe(2);
    expect(lista).toHaveLength(2);
    const [tablero, bisagra] = lista;
    expect(tablero).toMatchObject({ categoria: 'tableros', espesorMm: 19, unidad: 'm²', pagina: 3 });
    expect(tablero!.propiedades).toMatchObject({ precioTarifa: 12.4, descripcion: 'Uso interior' });
    expect(precioTarifa(tablero!)).toBe(12.4);
    expect(bisagra).toMatchObject({ categoria: 'herrajes', referencia: '12345', unidad: 'ud', brillo: null, pagina: 3 });
    expect(precioTarifa(bisagra!)).toBe(0);
  });
  it('aprovecha una respuesta cortada por el límite de tokens', () => {
    const cortada = '{"articulos":[{"categoria":"cantos","nombre":"Canto PVC 1 mm","pagina":1},{"categoria":"cantos","nombre":"Canto PVC 2 mm","pagina":1},{"categoria":"can';
    expect((repararJsonCortado(cortada) as { articulos: unknown[] }).articulos).toHaveLength(2);
  });
  it('de punta a punta: respuesta de Groq cortada y con otra clave', async () => {
    const contenido = '{"productos":[{"categoria":"Encimeras","nombre":"Encimera compacta 12 mm","precio":"180","pagina":2},{"categoria":"enc';
    const pedir = (async () => new Response(JSON.stringify({ choices: [{ message: { content: contenido } }] }), { status: 200 })) as unknown as typeof fetch;
    const r = await interpretarTextoConGroq('Proveedor X', [{ pagina: 2, texto: 'Encimera compacta 12 mm 180 €' }], { apiKey: 'k', fetch: pedir });
    expect(r.articulos).toHaveLength(1);
    expect(r.articulos[0]).toMatchObject({ categoria: 'encimeras', pagina: 2 });
    expect(r.articulos[0]!.propiedades.precioTarifa).toBe(180);
  });
});
