import { describe, expect, it } from 'vitest';
import type { PresupuestoCliente } from '../../src/server/data/tipos.ts';
import { recorrido, siguientePaso } from '../../src/panel-nuevo/presupuestos/pasos.ts';

const p = (cambios: Partial<PresupuestoCliente>): PresupuestoCliente =>
  ({ estado: 'borrador', fecha: '2026-10-10', validez: '2026-11-09', totales: { total: 1210, anticipo: 484, restante: 726 }, facturaAnticipoId: null, facturaId: null, cobroAnticipo: null, cobroResto: null, ...cambios }) as PresupuestoCliente;
const hoy = '2026-10-29';

describe('siguiente paso de un presupuesto', () => {
  it('de borrador a cobrado', () => {
    expect(siguientePaso(p({}), hoy).texto).toBe('Terminar y enviar');
    expect(siguientePaso(p({ estado: 'enviado' }), hoy)).toEqual({ texto: 'Esperando respuesta · hecho hace 19 días', urgente: false });
    expect(siguientePaso(p({ estado: 'enviado', validez: '2026-11-01' }), hoy)).toEqual({ texto: 'Caduca en 3 días: llamar al cliente', urgente: true });
    expect(siguientePaso(p({ estado: 'enviado', validez: '2026-10-20' }), hoy).texto).toBe('Caducado: llamar o rehacerlo');
    expect(siguientePaso(p({ estado: 'aceptado' }), hoy)).toEqual({ texto: 'Facturar el anticipo (484,00 €)', urgente: true });
    expect(siguientePaso(p({ estado: 'aceptado', facturaAnticipoId: 'f1' }), hoy).texto).toBe('Cobrar el anticipo (484,00 €)');
    expect(siguientePaso(p({ estado: 'aceptado', facturaAnticipoId: 'f1', cobroAnticipo: '2026-10-20' }), hoy).texto).toBe('Al terminar, factura final (726,00 €)');
    expect(siguientePaso(p({ estado: 'aceptado', facturaAnticipoId: 'f1', cobroAnticipo: '2026-10-20', facturaId: 'f2' }), hoy).texto).toBe('Cobrar el resto (726,00 €)');
    expect(siguientePaso(p({ estado: 'aceptado', facturaAnticipoId: 'f1', cobroAnticipo: '2026-10-20', facturaId: 'f2', cobroResto: '2026-10-28' }), hoy).texto).toBe('Terminado y cobrado');
    expect(siguientePaso(p({ estado: 'aceptado', totales: { total: 100, anticipo: 0, restante: 100 } as PresupuestoCliente['totales'] }), hoy).texto).toBe('Al terminar, hacer la factura');
  });

  it('recorrido con el paso actual marcado; sin anticipo, sin su paso', () => {
    expect(recorrido(p({ estado: 'enviado' }), hoy).map((h) => [h.texto, h.hecho, h.actual])).toEqual([
      ['Hecho', true, false],
      ['Enviado', true, false],
      ['Aceptado', false, true],
      ['Anticipo cobrado', false, false],
      ['Factura final', false, false],
      ['Cobrado', false, false],
    ]);
    expect(recorrido(p({ estado: 'aceptado', totales: { total: 100, anticipo: 0, restante: 100 } as PresupuestoCliente['totales'] }), hoy).map((h) => h.texto)).not.toContain('Anticipo cobrado');
  });
});
