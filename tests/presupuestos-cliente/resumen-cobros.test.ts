import { describe, expect, it } from 'vitest';
import type { Factura, PresupuestoCliente } from '../../src/server/data/tipos.ts';
import { estadoTramo, nombreEstadoTramo, resumenCobros } from '../../src/server/presupuestos-cliente/resumen-cobros.ts';

const factura = (estado: Factura['estado']) => ({ estado }) as Factura;
const presupuesto = {
  totales: { anticipo: 484, restante: 726 },
  cobroAnticipo: null,
  cobroResto: null,
} as PresupuestoCliente;

describe('recorrido documental de presupuesto de Turia', () => {
  it('distingue factura pendiente, borrador, cobrada y ausencia de factura', () => {
    expect(estadoTramo(null, null)).toBe('sin-factura');
    expect(estadoTramo(factura('borrador'), null)).toBe('borrador');
    expect(estadoTramo(factura('emitida'), null)).toBe('pendiente');
    expect(estadoTramo(factura('cobrada'), '2026-10-31')).toBe('cobrado');
  });
  it('avisa si se recibió un anticipo sin factura', () => {
    const r = resumenCobros({ ...presupuesto, cobroAnticipo: '2026-10-31' }, null, null);
    expect(r.anticipo.estado).toBe('cobro-sin-factura');
    expect(nombreEstadoTramo[r.anticipo.estado]).toContain('falta factura');
    expect(r.resto.estado).toBe('sin-factura');
    expect([r.anticipo.importe, r.resto.importe]).toEqual([484, 726]);
  });
});
