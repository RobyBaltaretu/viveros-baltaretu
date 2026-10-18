import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { leerContenido } from '../../scripts/contenido/archivos.mjs';
import { importarContenido, type EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { aplicarMigraciones, crearRepositoriosD1, type Factura, type Repositorios } from '../../src/server/data/index.ts';
import { AJUSTES_VACIOS, clienteVacio, leerBorrador, nuevaFactura, rectificativaDe } from '../../src/server/facturas/facturas.ts';
import { descontarFactura, inventarioCompleto, moverInventario } from '../../src/server/panel/inventario.ts';
import { d1DePrueba } from './d1.ts';

let repos: Repositorios;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  const { db, cerrar: c } = await d1DePrueba();
  cerrar = c;
  await aplicarMigraciones(db);
  repos = crearRepositoriosD1(db);
  const { entradas, fotos } = await leerContenido(process.cwd());
  for (const f of fotos) await repos.fotos.guardar({ ruta: f.ruta, tipo: 'image/jpeg', bytes: f.bytes }, 't');
  const lista = entradas.map((e) => ({ coleccion: e.coleccion, id: e.id, documento: { datos: e.datos, cuerpo: e.cuerpo } })) as EntradaImportada[];
  await importarContenido(repos, lista, new Set(fotos.map((f) => f.ruta)), 't');
}, 30_000);
afterAll(() => cerrar());

const yo = 'inv@example.com';
const hay = async (id: string) => (await repos.inventario.existencias())[id] ?? { disponible: 0, desperdicio: 0 };

describe('inventario', () => {
  it('entradas, salidas y bajas con motivo; no se puede quitar más de lo que hay', async () => {
    expect(await moverInventario(repos, 'yucca-elephantipes', { tipo: 'entrada', cantidad: 50, motivo: 'Producción propia' }, yo)).toMatchObject({ ok: true, disponible: 50 });
    expect(await moverInventario(repos, 'yucca-elephantipes', { tipo: 'baja', cantidad: 4, motivo: 'Se ha muerto' }, yo)).toMatchObject({ ok: true, disponible: 46 });
    expect(await moverInventario(repos, 'yucca-elephantipes', { tipo: 'salida', cantidad: 6, motivo: 'Regalo o muestra' }, yo)).toMatchObject({ ok: true, disponible: 40 });
    expect(await hay('yucca-elephantipes')).toMatchObject({ disponible: 40, desperdicio: 4 });

    expect(await moverInventario(repos, 'yucca-elephantipes', { tipo: 'baja', cantidad: 41, motivo: 'Se ha muerto' }, yo)).toMatchObject({ ok: false, error: expect.stringContaining('Solo hay 40') });
    expect(await moverInventario(repos, 'yucca-elephantipes', { tipo: 'entrada', cantidad: 5, motivo: 'Se ha muerto' }, yo)).toMatchObject({ ok: false });
    expect(await moverInventario(repos, 'yucca-elephantipes', { tipo: 'entrada', cantidad: 5, motivo: 'Otro motivo' }, yo)).toMatchObject({ ok: false, error: expect.stringContaining('nota') });
    expect(await moverInventario(repos, 'yucca-elephantipes', { tipo: 'entrada', cantidad: 1.5, motivo: 'Producción propia' }, yo)).toMatchObject({ ok: false });
    expect(await moverInventario(repos, 'no-existe', { tipo: 'entrada', cantidad: 1, motivo: 'Producción propia' }, yo)).toMatchObject({ ok: false });

    const fila = (await inventarioCompleto(repos)).find((f) => f.id === 'yucca-elephantipes');
    expect(fila?.existencias.disponible).toBe(40);
    expect((await inventarioCompleto(repos)).find((f) => f.id === 'chamaerops-humilis')?.existencias.disponible).toBe(0);
  });

  it('una factura emitida resta sus plantas una sola vez; la rectificativa las devuelve; las de prueba no cuentan', async () => {
    await moverInventario(repos, 'chamaerops-humilis', { tipo: 'entrada', cantidad: 30, motivo: 'Producción propia' }, yo);
    const c = { ...clienteVacio('cli-inv'), nombre: 'Jardinería' };
    const f: Factura = {
      ...nuevaFactura(c, yo, AJUSTES_VACIOS),
      id: 'fac-inv',
      estado: 'emitida',
      codigo: 'F2026-0100',
      lineas: [
        { concepto: 'Palmito', cantidad: 12, precio: 10, descuento: 0, iva: 10, planta: 'chamaerops-humilis' },
        { concepto: 'Transporte', cantidad: 1, precio: 50, descuento: 0, iva: 21 },
      ],
    };
    expect(await descontarFactura(repos, f, yo)).toBe(1);
    expect(await descontarFactura(repos, f, yo)).toBe(0);
    expect((await hay('chamaerops-humilis')).disponible).toBe(18);

    const r = { ...rectificativaDe(f, yo, AJUSTES_VACIOS), estado: 'emitida' as const, codigo: 'R2026-0001' };
    expect(await descontarFactura(repos, r, yo)).toBe(1);
    expect((await hay('chamaerops-humilis')).disponible).toBe(30);

    expect(await descontarFactura(repos, { ...f, id: 'fac-prueba', prueba: true }, yo)).toBe(0);
    expect(await descontarFactura(repos, { ...f, id: 'fac-borrador', estado: 'borrador' }, yo)).toBe(0);
  });

  it('el borrador guarda la planta de cada línea (solo si existe en el catálogo)', () => {
    const previa = nuevaFactura({ ...clienteVacio('x'), nombre: 'X' }, yo, AJUSTES_VACIOS);
    const form = new FormData();
    form.set('lineas', '2');
    for (const [i, planta] of ['chamaerops-humilis', 'inventada'].entries()) {
      form.set(`l${i}.concepto`, `Línea ${i}`);
      form.set(`l${i}.cantidad`, '2');
      form.set(`l${i}.precio`, '5');
      form.set(`l${i}.iva`, '10');
      form.set(`l${i}.planta`, planta);
    }
    const { factura } = leerBorrador(form, previa, [{ slug: 'chamaerops-humilis', nombre: 'Palmito', precio: 12 }]);
    expect(factura.lineas.map((l) => l.planta)).toEqual(['chamaerops-humilis', undefined]);
  });
});
