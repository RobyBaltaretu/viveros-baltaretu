import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarMigraciones, crearRepositoriosD1, type LineaPresupuestoCliente, type Repositorios } from '../../src/server/data/index.ts';
import { clienteVacio } from '../../src/server/facturas/facturas.ts';
import { apuntarCobro, calcularPresupuesto, cambiarEstado, cambiarPresupuesto, crearPresupuesto, estadoEfectivo, type EntradaPresupuesto } from '../../src/server/presupuestos-cliente/presupuestos.ts';
import { d1DePrueba } from '../panel/d1.ts';

let repos: Repositorios;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  const { db, cerrar: c } = await d1DePrueba();
  cerrar = c;
  await aplicarMigraciones(db);
  repos = crearRepositoriosD1(db);
  await repos.clientes.guardar({ ...clienteVacio('cli-1'), nombre: 'Cliente de prueba', nif: '12345678Z', email: 'cliente@example.com' }, yo);
}, 30_000);
afterAll(() => cerrar());

const yo = 'propietario@example.com';
const l = (concepto: string, cantidad: number, precio: number, extra = false): LineaPresupuestoCliente => ({ concepto, cantidad, precio, material: '', extra });
const base: EntradaPresupuesto = {
  clienteId: 'cli-1',
  concepto: 'Armario empotrado del dormitorio',
  fecha: '2026-10-29',
  validez: '2026-11-28',
  lineas: [l('Armario de dos puertas', 1, 1250), l('Montaje', 1, 180), l('Iluminación LED interior', 1, 95, true)],
  iva: 21,
  anticipoPct: 40,
  formaPago: 'Transferencia',
  notas: '',
};

describe('cálculo del presupuesto (céntimos)', () => {
  it('total con IVA, anticipo y restante; los extras van aparte', () => {
    expect(calcularPresupuesto(base.lineas as LineaPresupuestoCliente[], 21, 40)).toEqual({ base: 1430, cuotaIva: 300.3, total: 1730.3, anticipo: 692.12, restante: 1038.18, baseExtras: 95 });
  });

  it('redondea cada línea a céntimos y el anticipo sobre el total con IVA', () => {
    const t = calcularPresupuesto([l('Listón', 3, 33.333), l('Tornillería', 7, 0.015)], 21, 33.33);
    expect(t.base).toBe(100.11); // 99,999 → 100,00 y 0,105 → 0,11 (como en las facturas)
    expect(t.cuotaIva).toBe(21.02);
    expect(t.total).toBe(121.13);
    expect(t.anticipo).toBe(40.37); // 33,33 % de 121,13 = 40,3726…
    expect(t.restante).toBe(80.76);
  });

  it('anticipo + restante = total siempre, con cualquier porcentaje', () => {
    for (let i = 0; i < 500; i++) {
      const lineas = [l('A', 1 + (i % 7), ((i * 37.17) % 900) + 0.01), l('B', (i % 3) + 0.5, (i * 3.33) % 50)];
      const pct = (i * 7.77) % 100;
      const t = calcularPresupuesto(lineas, 21, pct);
      expect(Math.round(t.anticipo * 100) + Math.round(t.restante * 100)).toBe(Math.round(t.total * 100));
      expect(Number.isInteger(Math.round(t.anticipo * 100) / 1)).toBe(true);
    }
    expect(calcularPresupuesto([l('A', 1, 100)], 21, 0)).toMatchObject({ anticipo: 0, restante: 121 });
    expect(calcularPresupuesto([l('A', 1, 100)], 21, 100)).toMatchObject({ anticipo: 121, restante: 0 });
  });
});

describe('presupuestos a cliente', () => {
  it('numeración correlativa por serie y año, también con altas a la vez', async () => {
    const a = await crearPresupuesto(repos, base, yo, 21);
    expect(a.ok && a.presupuesto).toMatchObject({ serie: 'P2026', numero: 1, codigo: 'P2026-0001', estado: 'borrador', anticipoPct: 40, cliente: { nombre: 'Cliente de prueba' } });
    const varios = await Promise.all([1, 2, 3, 4].map(() => crearPresupuesto(repos, base, yo, 21)));
    expect(varios.map((r) => (r.ok ? r.presupuesto.numero : 0)).sort()).toEqual([2, 3, 4, 5]);
    const otroAnio = await crearPresupuesto(repos, { ...base, fecha: '2027-01-02', validez: null }, yo, 21);
    expect(otroAnio.ok && otroAnio.presupuesto.codigo).toBe('P2027-0001');
  });

  it('IVA fijo del cliente (21 %) aunque llegue otro; sin IVA fijo, el elegido', async () => {
    const fijo = await crearPresupuesto(repos, { ...base, iva: 10 }, yo, 21);
    expect(fijo.ok && fijo.presupuesto.iva).toBe(21);
    const libre = await crearPresupuesto(repos, { ...base, iva: 10 }, yo, null);
    expect(libre.ok && libre.presupuesto.totales.total).toBe(1573);
  });

  it('valida lo que se escribe', async () => {
    expect(await crearPresupuesto(repos, { ...base, clienteId: 'no-existe' }, yo, 21)).toEqual({ ok: false, error: 'Ese cliente no existe.' });
    expect(await crearPresupuesto(repos, { ...base, lineas: [l('Solo extra', 1, 10, true)] }, yo, 21)).toMatchObject({ ok: false, error: expect.stringContaining('al menos una línea') });
    expect(await crearPresupuesto(repos, { ...base, anticipoPct: 120 }, yo, 21)).toMatchObject({ ok: false, error: expect.stringContaining('0 a 100') });
    expect(await crearPresupuesto(repos, { ...base, validez: '2026-01-01' }, yo, 21)).toMatchObject({ ok: false, error: expect.stringContaining('validez') });
    expect(await crearPresupuesto(repos, { ...base, lineas: [l('', 1, 10)] }, yo, 21)).toMatchObject({ ok: false, error: expect.stringContaining('concepto') });
    expect(await crearPresupuesto(repos, { ...base, lineas: [l('X', 0, 10)] }, yo, 21)).toMatchObject({ ok: false, error: expect.stringContaining('cantidad') });
  });

  it('estados: borrador → enviado → aceptado; caduca al pasar la validez; solo se cambia en borrador', async () => {
    const r = await crearPresupuesto(repos, base, yo, 21);
    if (!r.ok) throw new Error(r.error);
    const id = r.presupuesto.id;
    expect(await cambiarEstado(repos, id, 'aceptado', yo, '2026-10-30')).toMatchObject({ ok: false });
    expect((await cambiarEstado(repos, id, 'enviado', yo, '2026-10-30')).ok).toBe(true);
    expect(await cambiarPresupuesto(repos, id, { ...base, anticipoPct: 50 }, yo, 21)).toMatchObject({ ok: false, error: expect.stringContaining('borrador') });
    const enviado = (await repos.presupuestosCliente.obtener(id))!;
    expect(estadoEfectivo(enviado, '2026-11-28')).toBe('enviado');
    expect(estadoEfectivo(enviado, '2026-11-29')).toBe('caducado');
    expect(await apuntarCobro(repos, id, 'anticipo', '2026-11-02', yo)).toMatchObject({ ok: false });
    expect((await cambiarEstado(repos, id, 'aceptado', yo, '2026-11-01')).ok).toBe(true);
    expect(await apuntarCobro(repos, id, 'anticipo', '2026-11-02', yo)).toMatchObject({ ok: true, presupuesto: { cobroAnticipo: '2026-11-02', cobroResto: null } });
    expect(await cambiarEstado(repos, id, 'borrador', yo, '2026-11-03')).toMatchObject({ ok: false });
  });

  it('en borrador se cambian los datos y se recalcula; la serie y el número se quedan', async () => {
    const r = await crearPresupuesto(repos, base, yo, 21);
    if (!r.ok) throw new Error(r.error);
    const c = await cambiarPresupuesto(repos, r.presupuesto.id, { ...base, fecha: '2027-02-01', validez: null, anticipoPct: 50 }, yo, 21);
    expect(c.ok && c.presupuesto).toMatchObject({ codigo: r.presupuesto.codigo, anticipoPct: 50, totales: { total: 1730.3, anticipo: 865.15, restante: 865.15 } });
    const lista = await repos.presupuestosCliente.listar({ clienteId: 'cli-1' });
    expect(lista.length).toBeGreaterThan(5);
  });
});
