import { describe, expect, it } from 'vitest';
import type { Factura, Gasto, Presupuesto } from '../../src/server/data/tipos.ts';
import { AJUSTES_VACIOS, clienteVacio, nuevaFactura } from '../../src/server/facturas/facturas.ts';
import { calcularTotales } from '../../src/server/facturas/importes.ts';
import { gastoVacio } from '../../src/server/gastos/gastos.ts';
import {
  cifras,
  cobros,
  conclusiones,
  conversion,
  evolucionMensual,
  gastosPorCategoria,
  masVendido,
  mejoresClientes,
  periodoAnterior,
  periodoDe,
  variacion,
} from '../../src/server/informes/informes.ts';

const cliente = (n: string) => ({ ...clienteVacio(n), nombre: n });
function factura(c: string, fecha: string, lineas: [string, number, number][], extra: Partial<Factura> = {}): Factura {
  const f = { ...nuevaFactura(cliente(c), 'g', AJUSTES_VACIOS), estado: 'emitida' as const, fecha, vencimiento: fecha, lineas: lineas.map(([concepto, cantidad, precio]) => ({ concepto, cantidad, precio, descuento: 0, iva: 10 })), ...extra };
  return { ...f, totales: calcularTotales(f.lineas) };
}
const gasto = (fecha: string, categoria: string, total: number, base: number | null = null): Gasto => ({ ...gastoVacio('g'), estado: 'confirmado', fecha, categoria, total, base });

const facturas = [
  factura('Jardines Turia', '2026-10-03', [['Olivo', 10, 40]]),
  factura('Paisajes Sur', '2026-10-20', [['Palmera', 2, 150], ['Olivo', 5, 40]], { presupuestoId: 'p1' }),
  factura('Jardines Turia', '2026-09-10', [['Olivo', 5, 40]], { estado: 'cobrada', cobradaEl: '2026-10-01' }),
  factura('Jardines Turia', '2026-10-25', [['Olivo', -2, 40]], { tipo: 'rectificativa' }),
  { ...factura('Borrador SL', '2026-10-05', [['Olivo', 100, 40]]), estado: 'borrador' as const },
];
const gastos = [gasto('2026-10-02', 'sustratos', 121, 100), gasto('2026-10-15', 'combustible', 60), gasto('2026-09-15', 'combustible', 30), { ...gasto('2026-10-16', 'otros', 999), estado: 'revisar' as const }];
const presupuestos = [{ id: 'p1', fecha: '2026-10-01T10:00:00Z' }, { id: 'p2', fecha: '2026-10-09T10:00:00Z' }] as Presupuesto[];

describe('periodos', () => {
  it('mes, trimestre y año, y el anterior', () => {
    expect(periodoDe('mes', '2026-02-14')).toMatchObject({ desde: '2026-02-01', hasta: '2026-02-28', etiqueta: 'febrero de 2026' });
    expect(periodoDe('trimestre', '2026-05-01')).toMatchObject({ desde: '2026-04-01', hasta: '2026-06-30', etiqueta: '2.º trimestre de 2026' });
    expect(periodoAnterior(periodoDe('mes', '2026-01-10')).desde).toBe('2025-12-01');
    expect(periodoAnterior(periodoDe('anio', '2026-01-10')).etiqueta).toBe('año 2025');
  });
});

describe('cifras', () => {
  const oct = periodoDe('mes', '2026-10-01');
  it('ingresos sin IVA con rectificativas, gastos revisados y resultado', () => {
    const c = cifras(facturas, gastos, presupuestos, oct);
    expect(c).toMatchObject({ ingresos: 820, gastos: 160, resultado: 660, facturas: 2, clientes: 2, ticketMedio: 450, cobrado: 220, presupuestos: 2 });
    expect(c.margen).toBe(80.5);
    expect(c.ivaRepercutido).toBe(82);
    expect(c.ivaSoportado).toBe(0);
    expect(variacion(c.ingresos, cifras(facturas, gastos, [], periodoAnterior(oct)).ingresos)).toBe(310);
  });

  it('reparto, mejores clientes, lo más vendido, cobros y conversión', () => {
    expect(gastosPorCategoria(gastos, oct)).toEqual([
      { nombre: 'Sustratos y abonos', valor: 100 },
      { nombre: 'Combustible', valor: 60 },
    ]);
    expect(mejoresClientes(facturas, oct).map((p) => p.nombre)).toEqual(['Paisajes Sur', 'Jardines Turia']);
    expect(masVendido(facturas, oct)[0]).toEqual({ nombre: 'Olivo', valor: 520, detalle: '13 uds.' });
    expect(cobros(facturas, '2026-10-21')).toMatchObject({ facturas: 3, vencidas: 2 });
    expect(conversion(facturas, presupuestos, oct)).toEqual({ recibidos: 2, facturados: 1, tasa: 50 });
    const evo = evolucionMensual(facturas, gastos, '2026-10-31');
    expect(evo).toHaveLength(12);
    expect(evo.at(-1)).toMatchObject({ mes: '2026-10', ingresos: 820, gastos: 160 });
    expect(evo[0].mes).toBe('2025-11');
  });

  it('las conclusiones salen solo con datos', () => {
    const datos = (fs: Factura[], gs: Gasto[]) => ({
      actual: cifras(fs, gs, presupuestos, oct),
      anterior: cifras(fs, gs, presupuestos, periodoAnterior(oct)),
      periodo: oct,
      cobros: cobros(fs, '2026-10-21'),
      categorias: gastosPorCategoria(gs, oct),
      categoriasAntes: gastosPorCategoria(gs, periodoAnterior(oct)),
      clientes: mejoresClientes(fs, oct),
      evolucion: evolucionMensual(fs, gs, '2026-10-31'),
      conversion: conversion(fs, presupuestos, oct),
      porRevisar: 1,
    });
    const frases = conclusiones(datos(facturas, gastos));
    expect(frases.join('\n')).toContain('Los ingresos suben un 310 %');
    expect(frases.join('\n')).toContain('Mejor cliente: Paisajes Sur');
    expect(frases.join('\n')).toContain('fecha de pago pasada');
    expect(frases.join('\n')).toContain('1 ticket por revisar');
    expect(conclusiones(datos([], [])).filter((f) => !f.includes('presupuestos') && !f.includes('revisar'))).toEqual([]);
  });
});
