import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { AJUSTES_VACIOS, clienteVacio, codigoDe, nuevaFactura } from '../../src/server/facturas/facturas.ts';
import { calcularTotales } from '../../src/server/facturas/importes.ts';
import { d1DePrueba } from '../panel/d1.ts';

let repos: Repositorios;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  const { db, cerrar: c } = await d1DePrueba();
  cerrar = c;
  await aplicarMigraciones(db);
  repos = crearRepositoriosD1(db);
}, 30_000);
afterAll(() => cerrar());

const cliente = { ...clienteVacio('c1'), nombre: 'Jardinería Ejemplo SL', nif: 'A58818501' };
const emisor = { ...AJUSTES_VACIOS, nombre: 'Vivero', nif: 'B12345674' };

const borrador = async (total = 10) => {
  const f = { ...nuevaFactura(cliente, 'g@example.com', AJUSTES_VACIOS), fecha: '2026-03-01', lineas: [{ concepto: 'Olivo', cantidad: 1, precio: total, descuento: 0, iva: 10 }] };
  f.totales = calcularTotales(f.lineas);
  await repos.facturas.guardarBorrador(f);
  return f;
};
const emitir = (id: string) =>
  repos.facturas.emitir(id, { serie: 'F2026', fecha: '2026-03-01', emisor, cliente, huellaAnterior: null, codigo: (n) => codigoDe('F2026', n), huella: async (n) => `h${n}` });

describe('repositorio de facturas', () => {
  it('guarda clientes y ajustes privados', async () => {
    await repos.clientes.guardar(cliente, 'g@example.com');
    expect((await repos.clientes.listar()).map((c) => c.nombre)).toEqual(['Jardinería Ejemplo SL']);
    await repos.clientes.guardar({ ...cliente, archivado: true }, 'g@example.com');
    expect(await repos.clientes.listar()).toEqual([]);
    expect(await repos.clientes.listar({ incluirArchivados: true })).toHaveLength(1);
    await repos.ajustesPrivados.guardar('facturacion', { nif: 'B12345674' }, 'g@example.com');
    expect(await repos.ajustesPrivados.obtener('facturacion')).toEqual({ nif: 'B12345674' });
  });

  it('numera seguido al emitir y no deja tocar una emitida', async () => {
    const a = await borrador(10);
    const b = await borrador(20);
    expect((await emitir(a.id))?.codigo).toBe('F2026-0001');
    expect((await emitir(b.id))?.codigo).toBe('F2026-0002');
    expect(await emitir(a.id)).toBeNull();
    expect(await repos.facturas.guardarBorrador({ ...a, notas: 'cambio' })).toBe(false);
    expect(await repos.facturas.borrarBorrador(a.id)).toBe(false);
    const leida = await repos.facturas.obtener(a.id);
    expect(leida).toMatchObject({ estado: 'emitida', numero: 1, huella: 'h1', notas: '' });
    expect((await repos.facturas.ultimaEmitida('F2026'))?.codigo).toBe('F2026-0002');
    expect(await repos.facturas.ultimaHuella()).toBe('h2');
  });

  it('marca el cobro y filtra por estado', async () => {
    const [f] = await repos.facturas.listar({ estado: 'emitida', limite: 1 });
    expect(await repos.facturas.marcarCobrada(f.id, '2026-03-10')).toBe(true);
    expect((await repos.facturas.obtener(f.id))?.cobradaEl).toBe('2026-03-10');
    expect((await repos.facturas.listar({ estado: 'cobrada' })).map((x) => x.id)).toEqual([f.id]);
    const c = await borrador(5);
    expect(await repos.facturas.marcarCobrada(c.id, '2026-03-10')).toBe(false);
    expect(await repos.facturas.borrarBorrador(c.id)).toBe(true);
  });
});
