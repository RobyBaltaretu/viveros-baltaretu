import { describe, expect, it } from 'vitest';
import { categoriasGastoCarpinteria } from '../../paquetes-sector/carpinteria/gastos.ts';
import { categoriasGastoVivero } from '../../paquetes-sector/vivero/gastos.ts';
import { AJUSTES_VACIOS, clienteVacio, leerCliente, nuevaFactura } from '../../src/server/facturas/facturas.ts';
import { CATEGORIAS, nombreCategoria, sugerirCategoria } from '../../src/server/gastos/gastos.ts';

const formulario = (datos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(datos)) f.set(k, v);
  return f;
};

describe('clientes con datos ampliados (D-06)', () => {
  it('el formulario nuevo guarda contacto, obra y forma de pago', () => {
    const r = leerCliente(formulario({ nombre: 'Reformas Prueba SL', pais: 'España', contacto: ' Andrés ', direccionObra: 'Calle Mayor 5, Alfafar', formaPago: 'Transferencia' }), clienteVacio('c1'));
    expect(r.errores).toEqual([]);
    expect(r.cliente).toMatchObject({ contacto: 'Andrés', direccionObra: 'Calle Mayor 5, Alfafar', formaPago: 'Transferencia' });
  });

  it('el formulario de siempre (sin esos campos) no los toca ni los añade', () => {
    const previo = { ...clienteVacio('c2'), nombre: 'Antes', formaPago: 'Bizum' };
    const r = leerCliente(formulario({ nombre: 'Después', pais: 'España' }), previo);
    expect(r.cliente.formaPago).toBe('Bizum');
    const sin = leerCliente(formulario({ nombre: 'Nuevo', pais: 'España' }), clienteVacio('c3')).cliente;
    expect(Object.keys(sin)).not.toContain('contacto');
    expect(Object.keys(sin)).not.toContain('formaPago');
  });

  it('la factura nueva propone la forma de pago habitual del cliente; sin ella, la de los ajustes', () => {
    const ajustes = { ...AJUSTES_VACIOS, formaPago: 'Transferencia bancaria' };
    expect(nuevaFactura({ ...clienteVacio('c4'), formaPago: 'Bizum' }, 'yo@example.com', ajustes).formaPago).toBe('Bizum');
    expect(nuevaFactura(clienteVacio('c5'), 'yo@example.com', ajustes).formaPago).toBe('Transferencia bancaria');
  });
});

describe('categorías de gasto por sector (T-20)', () => {
  it('sin cliente configurado (Baltaretu), las del vivero de siempre', () => {
    expect(CATEGORIAS).toBe(categoriasGastoVivero);
    expect(CATEGORIAS.map((c) => c.id)).toEqual(['planta', 'sustratos', 'macetas', 'fitosanitarios', 'riego', 'combustible', 'transporte', 'herramientas', 'mantenimiento', 'suministros', 'oficina', 'comidas', 'otros']);
  });

  it('las de la carpintería: ids únicos, «otros» al final y un ticket de taller va a su sitio', () => {
    const ids = categoriasGastoCarpinteria.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.at(-1)).toBe('otros');
    const linea = (concepto: string) => [{ concepto, cantidad: 1, importe: 10 }];
    expect(sugerirCategoria('Maderas del Turia', linea('Tablero melamina blanca 19 mm'), categoriasGastoCarpinteria)).toBe('tableros');
    expect(sugerirCategoria('Herrajes SL', linea('Bisagra cazoleta Blum'), categoriasGastoCarpinteria)).toBe('herrajes');
    expect(sugerirCategoria('Pinturas', linea('Laca poliuretano mate'), categoriasGastoCarpinteria)).toBe('acabados');
    expect(sugerirCategoria('Repsol', linea('Gasóleo'), categoriasGastoCarpinteria)).toBe('combustible');
    expect(sugerirCategoria('Bar Pepe', linea('Menú del día'), categoriasGastoCarpinteria)).toBe('comidas');
  });

  it('el nombre de una categoría de otro sector se sigue viendo', () => {
    expect(nombreCategoria('tableros')).toBe('Tableros y madera');
    expect(nombreCategoria('planta')).toBe('Planta y semillas');
    expect(nombreCategoria('inventada')).toBe('Sin categoría');
  });
});
