import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { AJUSTES_VACIOS, clienteVacio } from '../../src/server/facturas/facturas.ts';
import { calcularTotales } from '../../src/server/facturas/importes.ts';
import { baseParaTotal, facturables, facturarLoQueToca, facturarPresupuesto, porFacturar } from '../../src/server/presupuestos-cliente/facturar.ts';
import { cambiarEstado, crearPresupuesto } from '../../src/server/presupuestos-cliente/presupuestos.ts';
import { d1DePrueba } from '../panel/d1.ts';

let repos: Repositorios;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  const { db, cerrar: c } = await d1DePrueba();
  cerrar = c;
  await aplicarMigraciones(db);
  repos = crearRepositoriosD1(db);
  await repos.clientes.guardar({ ...clienteVacio('cli-f'), nombre: 'Cliente factura', nif: '12345678Z' }, yo);
}, 30_000);
afterAll(() => cerrar());

const yo = 'propietario@example.com';

describe('del presupuesto a la factura', () => {
  it('la base de la factura de anticipo da exactamente el anticipo con IVA', () => {
    let exactas = 0;
    for (let c = 1; c < 200_000; c += 37) {
      const total = c / 100;
      const base = baseParaTotal(total, 21);
      const t = calcularTotales([{ concepto: 'x', cantidad: 1, precio: base, descuento: 0, iva: 21 }]).total;
      expect(Math.abs(Math.round(t * 100) - c)).toBeLessThanOrEqual(1);
      if (Math.round(t * 100) === c) exactas++;
    }
    // Con el 21 % casi todos los importes tienen una base exacta.
    expect(exactas / Math.ceil(200_000 / 37)).toBeGreaterThan(0.75);
    expect(baseParaTotal(692.12, 21)).toBe(572);
  });

  it('solo de un presupuesto aceptado; una factura de anticipo y una final que descuenta el anticipo', async () => {
    const r = await crearPresupuesto(
      repos,
      { clienteId: 'cli-f', concepto: 'Armario', fecha: '2026-10-29', lineas: [{ concepto: 'Armario', cantidad: 1, precio: 1250, material: 'Melamina', extra: false }, { concepto: 'Montaje', cantidad: 1, precio: 180, material: '', extra: false }, { concepto: 'LED', cantidad: 1, precio: 95, material: '', extra: true }], iva: 21, anticipoPct: 40 },
      yo,
      21,
    );
    if (!r.ok) throw new Error(r.error);
    const id = r.presupuesto.id;
    expect(await facturarPresupuesto(repos, id, 'anticipo', yo, AJUSTES_VACIOS)).toMatchObject({ ok: false });
    await cambiarEstado(repos, id, 'enviado', yo, '2026-10-30');
    await cambiarEstado(repos, id, 'aceptado', yo, '2026-10-30');

    const a = await facturarPresupuesto(repos, id, 'anticipo', yo, AJUSTES_VACIOS);
    if (!a.ok) throw new Error(a.error);
    expect(a.factura).toMatchObject({ estado: 'borrador', clienteId: 'cli-f', totales: { base: 572, total: 692.12 } });
    expect(a.factura.lineas[0].concepto).toContain('Anticipo del 40 % del presupuesto P2026-0001');
    // Pulsar otra vez no crea otra.
    const otra = await facturarPresupuesto(repos, id, 'anticipo', yo, AJUSTES_VACIOS);
    expect(otra.ok && otra.factura.id).toBe(a.factura.id);

    const f = await facturarPresupuesto(repos, id, 'final', yo, AJUSTES_VACIOS);
    if (!f.ok) throw new Error(f.error);
    expect(f.factura.lineas.map((l) => [l.concepto, l.cantidad, l.precio, l.iva])).toEqual([
      ['Armario (Melamina)', 1, 1250, 21],
      ['Montaje', 1, 180, 21],
      ['Anticipo ya facturado', -1, 572, 21],
    ]);
    // Lo que queda por facturar es el restante del presupuesto (al céntimo).
    expect(f.factura.totales.total).toBe(r.presupuesto.totales.restante);
    expect(await repos.presupuestosCliente.obtener(id)).toMatchObject({ facturaAnticipoId: a.factura.id, facturaId: f.factura.id });
  });

  it('qué toca facturar y la lista de facturables (aceptados y enviados vigentes)', () => {
    const base = { totales: { total: 1210, anticipo: 484, restante: 726 }, facturaAnticipoId: null, facturaId: null, fecha: '2026-10-01', validez: '2026-11-30' };
    const mk = (id: string, cambios: object) => ({ ...base, id, ...cambios }) as unknown as Parameters<typeof porFacturar>[0] & { id: string };
    expect(porFacturar(mk('a', {}))).toBe('anticipo');
    expect(porFacturar(mk('a', { facturaAnticipoId: 'f1' }))).toBe('final');
    expect(porFacturar(mk('a', { facturaAnticipoId: 'f1', facturaId: 'f2' }))).toBeNull();
    expect(porFacturar(mk('a', { totales: { total: 100, anticipo: 0, restante: 100 } }))).toBe('final');
    const lista = facturables(
      [
        mk('enviado', { estado: 'enviado', fecha: '2026-10-20' }),
        mk('caducado', { estado: 'enviado', validez: '2026-10-01' }),
        mk('borrador', { estado: 'borrador' }),
        mk('hecho', { estado: 'aceptado', facturaAnticipoId: 'f1', facturaId: 'f2' }),
        mk('final', { estado: 'aceptado', facturaAnticipoId: 'f1' }),
      ] as never,
      '2026-10-30',
    );
    expect(lista.map((x) => [x.p.id, x.que, x.importe, x.acepta])).toEqual([
      ['final', 'final', 726, false],
      ['enviado', 'anticipo', 484, true],
    ]);
  });

  it('facturar lo que toca: un enviado se da por aceptado; después la final; uno caducado, no', async () => {
    const r = await crearPresupuesto(repos, { clienteId: 'cli-f', concepto: 'Puerta', fecha: '2026-10-29', validez: '2026-11-28', lineas: [{ concepto: 'Puerta', cantidad: 1, precio: 500, material: '', extra: false }], iva: 21, anticipoPct: 30 }, yo, 21);
    if (!r.ok) throw new Error(r.error);
    const id = r.presupuesto.id;
    expect(await facturarLoQueToca(repos, id, yo, AJUSTES_VACIOS, '2026-10-30')).toMatchObject({ ok: false });
    await cambiarEstado(repos, id, 'enviado', yo, '2026-10-30');
    expect(await facturarLoQueToca(repos, id, yo, AJUSTES_VACIOS, '2026-12-01')).toMatchObject({ ok: false, error: expect.stringContaining('caducado') });
    const a = await facturarLoQueToca(repos, id, yo, AJUSTES_VACIOS, '2026-10-30');
    if (!a.ok) throw new Error(a.error);
    expect(a.factura.totales.total).toBe(181.5);
    expect((await repos.presupuestosCliente.obtener(id))?.estado).toBe('aceptado');
    const f = await facturarLoQueToca(repos, id, yo, AJUSTES_VACIOS, '2026-10-30');
    if (!f.ok) throw new Error(f.error);
    expect(f.factura.id).not.toBe(a.factura.id);
    expect(f.factura.totales.total).toBe(423.5);
    // Ya está todo: devuelve la final, sin crear otra.
    const otra = await facturarLoQueToca(repos, id, yo, AJUSTES_VACIOS, '2026-10-30');
    expect(otra.ok && otra.factura.id).toBe(f.factura.id);
  });
});
