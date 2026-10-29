import { describe, expect, it } from 'vitest';
import type { Factura, PresupuestoCliente } from '../../src/server/data/tipos.ts';
import { clienteVacio } from '../../src/server/facturas/facturas.ts';
import { evolucion, kpis, porHacer, saludo, type DatosInicio } from '../../src/panel-nuevo/inicio.ts';

const cliente = { ...clienteVacio('c1'), nombre: 'Cliente de prueba' };
const factura = (id: string, estado: Factura['estado'], fecha: string, vencimiento: string, base: number): Factura =>
  ({ id, estado, fecha, vencimiento, codigo: `F-${id}`, cliente, prueba: false, totales: { base, total: Math.round(base * 121) / 100 } }) as unknown as Factura;
const presupuesto = (id: string, estado: PresupuestoCliente['estado'], fecha: string, validez: string | null, extra: Partial<PresupuestoCliente> = {}): PresupuestoCliente =>
  ({ id, codigo: `P-${id}`, concepto: `Trabajo ${id}`, estado, fecha, validez, cliente, anticipoPct: 40, totales: { total: 1000, anticipo: 400, restante: 600 }, facturaAnticipoId: null, cobroAnticipo: null, ...extra }) as unknown as PresupuestoCliente;

const base = (cambios: Partial<DatosInicio> = {}): DatosInicio => ({
  hoy: '2026-10-29',
  facturas: [],
  gastosMes: [],
  ticketsPorRevisar: 0,
  presupuestos: [],
  ver: { facturas: true, presupuestos: true, gastos: true, informes: true },
  ...cambios,
});

describe('inicio del diseño nuevo', () => {
  it('KPIs: facturado del mes frente al anterior, por cobrar, presupuestos en juego y aceptación', () => {
    const d = base({
      facturas: [factura('1', 'cobrada', '2026-10-05', '2026-11-04', 1500), factura('2', 'emitida', '2026-09-10', '2026-10-10', 1000), factura('3', 'borrador', '2026-10-20', '2026-11-20', 999)],
      presupuestos: [
        presupuesto('a', 'enviado', '2026-10-20', '2026-11-19'),
        presupuesto('b', 'enviado', '2026-09-01', '2026-10-01'), // caducado: no está en juego
        presupuesto('c', 'aceptado', '2026-10-01', null),
        presupuesto('d', 'rechazado', '2026-09-15', null),
      ],
    });
    const k = Object.fromEntries(kpis(d).map((x) => [x.id, x]));
    expect(k.facturado).toMatchObject({ valor: 1500, nota: 'sin IVA · +50 % que septiembre' });
    expect(k.porCobrar).toMatchObject({ valor: 1210, tono: 'aviso', nota: expect.stringContaining('1 factura vencida') });
    expect(k.enJuego).toMatchObject({ valor: 1000, nota: '1 enviado, esperando respuesta' });
    // b caducó, c aceptado, d rechazado: 1 de 3.
    expect(k.aceptacion).toMatchObject({ valor: 33, formato: 'porcentaje' });
  });

  it('sin permiso o sin módulo, sin sus cifras', () => {
    expect(kpis(base({ ver: { facturas: false, presupuestos: true, gastos: false, informes: false } })).map((k) => k.id)).toEqual(['enJuego', 'aceptacion']);
    expect(kpis(base()).find((k) => k.id === 'aceptacion')?.valor).toBeNull();
  });

  it('por hacer: de lo más urgente a lo menos, cada cosa con su acción', () => {
    const d = base({
      ticketsPorRevisar: 2,
      facturas: [factura('v', 'emitida', '2026-09-01', '2026-10-01', 100), factura('b', 'borrador', '2026-10-28', '2026-11-28', 50)],
      presupuestos: [
        presupuesto('borr', 'borrador', '2026-10-28', '2026-11-27'),
        presupuesto('lento', 'enviado', '2026-10-10', '2026-11-09'),
        presupuesto('caduca', 'enviado', '2026-10-01', '2026-10-31'),
        presupuesto('acept', 'aceptado', '2026-10-27', null),
        presupuesto('cobrar', 'aceptado', '2026-10-20', null, { facturaAnticipoId: 'f9' }),
      ],
    });
    const t = porHacer(d);
    expect(t.map((x) => x.id)).toEqual(['vencida-v', 'caduca-caduca', 'anticipo-acept', 'cobro-cobrar', 'respuesta-lento', 'borrador-borr', 'facturas-borrador', 'tickets']);
    expect(t[0]).toMatchObject({ color: 'rojo', detalle: 'Cliente de prueba · venció hace 28 días · 121,00 €', href: '/panel/facturas/v' });
    expect(t[1]).toMatchObject({ color: 'naranja', titulo: 'Trabajo caduca: caduca en 2 días' });
    expect(t[2]).toMatchObject({ accion: 'Facturar', detalle: expect.stringContaining('40 % = 400,00 €') });
    expect(t.at(-2)).toMatchObject({ titulo: '1 factura en borrador', href: '/panel/facturas?estado=borrador' });
  });

  it('nada pendiente, lista vacía; sin permiso, sin sus tareas', () => {
    expect(porHacer(base())).toEqual([]);
    expect(porHacer(base({ ticketsPorRevisar: 3, ver: { facturas: true, presupuestos: true, gastos: false, informes: true } }))).toEqual([]);
  });

  it('evolución de seis meses, con el actual al final', () => {
    const e = evolucion(base({ facturas: [factura('1', 'cobrada', '2026-10-05', '2026-11-04', 1500), factura('2', 'emitida', '2026-06-10', '2026-07-10', 300), factura('3', 'borrador', '2026-10-06', '2026-11-06', 999)] }));
    expect(e.map((m) => m.etiqueta)).toEqual(['may', 'jun', 'jul', 'ago', 'sep', 'oct']);
    expect(e.map((m) => m.base)).toEqual([0, 300, 0, 0, 0, 1500]);
    expect(e.at(-1)?.actual).toBe(true);
  });

  it('saludo según la hora', () => {
    expect([saludo(8), saludo(15), saludo(22), saludo(3)]).toEqual(['Buenos días', 'Buenas tardes', 'Buenas noches', 'Buenas noches']);
  });
});
