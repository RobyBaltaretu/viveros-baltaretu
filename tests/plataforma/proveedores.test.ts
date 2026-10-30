import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import type { Gasto } from '../../src/server/data/tipos.ts';
import { csvProveedores, esDelProveedor, gastadoCon, leerProveedor, proveedorVacio } from '../../src/server/proveedores/proveedores.ts';
import { d1DePrueba } from '../panel/d1.ts';

const formulario = (datos: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(datos)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

describe('proveedores: reglas', () => {
  it('lee la ficha, valida NIF, correo y plazo, y solo guarda categorías del catálogo', () => {
    const ok = leerProveedor(formulario({ nombre: ' Tableros Levante SL ', nif: 'b-12345674', email: 'pedidos@example.com', plazoDias: '3', categorias: ['tableros', 'herrajes', 'inventada'] }), proveedorVacio('p1'));
    expect(ok.errores).toEqual([]);
    expect(ok.proveedor).toMatchObject({ nombre: 'Tableros Levante SL', nif: 'B12345674', plazoDias: 3, categorias: ['tableros', 'herrajes'] });
    const mal = leerProveedor(formulario({ nombre: '', nif: 'B12345670', email: 'no', plazoDias: '2,5' }), proveedorVacio('p2'));
    expect(mal.errores.map((e) => e.campo)).toEqual(['nombre', 'nif', 'email', 'plazoDias']);
    expect(leerProveedor(formulario({ nombre: 'X', plazoDias: '' }), proveedorVacio('p3')).proveedor.plazoDias).toBeNull();
  });

  it('sus artículos y lo gastado con él: por el nombre (sin tildes, mayúsculas ni «SL») o el NIF', () => {
    const p = { nombre: 'Tableros Levante SL', nif: 'B12345674' };
    expect(esDelProveedor({ proveedor: 'tableros levante' }, p)).toBe(true);
    expect(esDelProveedor({ proveedor: 'Tableros Levante, S.L.' }, p)).toBe(true);
    expect(esDelProveedor({ proveedor: '' }, p)).toBe(false);
    expect(esDelProveedor({ proveedor: 'Tableros del Sur' }, p)).toBe(false);
    const g = (proveedor: string, nif: string, total: number, estado: Gasto['estado'] = 'confirmado') => ({ proveedor, nifProveedor: nif, total, estado }) as Gasto;
    expect(gastadoCon(p, [g('TABLEROS LEVANTE', '', 100), g('Otro nombre', 'B-12345674', 20.5), g('Tableros Levante', '', 999, 'revisar'), g('Herrajes', '', 50)])).toBe(120.5);
  });

  it('CSV sin fórmulas y con las categorías por su nombre', () => {
    const csv = csvProveedores([{ ...proveedorVacio('p4'), nombre: '=HYPERLINK()', telefono: '+34 600', categorias: ['tableros'], actualizado: '' }]);
    expect(csv.split('\r\n')[1]).toContain(`"'=HYPERLINK()"`);
    expect(csv).toContain('"Tableros"');
  });
});

describe('proveedores: repositorio', () => {
  let repos: Repositorios;
  let cerrar: () => Promise<void>;
  beforeAll(async () => {
    const { db, cerrar: c } = await d1DePrueba();
    cerrar = c;
    await aplicarMigraciones(db);
    repos = crearRepositoriosD1(db);
  }, 30_000);
  afterAll(() => cerrar());

  it('alta, cambio, ocultar y quitar los de prueba', async () => {
    await repos.proveedores.guardar({ ...proveedorVacio('prov-1'), nombre: 'zeta', categorias: ['herrajes'], plazoDias: 2 }, 'yo@example.com');
    await repos.proveedores.guardar({ ...proveedorVacio('prueba-proveedor-1'), nombre: 'Alfa (prueba)' }, 'yo@example.com');
    expect((await repos.proveedores.listar()).map((p) => p.nombre)).toEqual(['Alfa (prueba)', 'zeta']);
    const p = (await repos.proveedores.obtener('prov-1'))!;
    expect(p).toMatchObject({ categorias: ['herrajes'], plazoDias: 2, archivado: false });
    await repos.proveedores.guardar({ ...p, archivado: true }, 'yo@example.com');
    expect((await repos.proveedores.listar()).map((x) => x.id)).toEqual(['prueba-proveedor-1']);
    expect(await repos.proveedores.listar({ incluirArchivados: true })).toHaveLength(2);
    expect(await repos.proveedores.borrarPruebas()).toBe(1);
    expect(await repos.proveedores.obtener('prueba-proveedor-1')).toBeNull();
  });
});
