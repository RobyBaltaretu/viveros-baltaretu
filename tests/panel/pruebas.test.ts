import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { leerContenido } from '../../scripts/contenido/archivos.mjs';
import { importarContenido, type EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { AJUSTES_VACIOS, clienteVacio, nuevaFactura } from '../../src/server/facturas/facturas.ts';
import { nifValido } from '../../src/server/facturas/nif.ts';
import { calcularTotales } from '../../src/server/facturas/importes.ts';
import { emitirFactura, libroFacturasCsv, modoPruebas } from '../../src/server/panel/facturacion.ts';
import { cargarDatosPrueba, quitarDatosPrueba } from '../../src/server/panel/pruebas.ts';
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

describe('datos de prueba', () => {
  it('carga unos 5 de cada cosa y activa el modo de pruebas', async () => {
    const r = await cargarDatosPrueba(repos, 'p@example.com', '2026-10-15');
    expect(r).toEqual({ clientes: 5, presupuestos: 5, facturas: 5, gastos: 5, proyectos: 4, guias: 4 });
    expect(await modoPruebas(repos)).toBe(true);
    const clientes = await repos.clientes.listar();
    expect(clientes.every((c) => nifValido(c.nif))).toBe(true);
    const facturas = await repos.facturas.listar();
    expect(facturas.filter((f) => f.estado === 'cobrada')).toHaveLength(2);
    expect(facturas.filter((f) => f.estado === 'borrador')).toHaveLength(1);
    expect(facturas.filter((f) => f.codigo).every((f) => f.codigo!.startsWith('PRUEBA-F2026-'))).toBe(true);
    // Fuera del libro para la gestoría.
    expect(libroFacturasCsv(facturas).split('\r\n').filter(Boolean)).toHaveLength(1);
    // Cargar dos veces no duplica.
    await cargarDatosPrueba(repos, 'p@example.com', '2026-10-15');
    expect(await repos.facturas.listar()).toHaveLength(5);
    expect((await repos.contenido.listar('proyectos')).find((e) => e.id.startsWith('prueba-'))?.borrador.datos.revisado).toBe(false);
  });

  it('en modo de pruebas, lo que se emite va a la serie de prueba y no toca la cadena real', async () => {
    const c = { ...clienteVacio('real-1'), nombre: 'Cliente real', nif: 'A58818501', direccion: 'Calle 1', codigoPostal: '28001', poblacion: 'Madrid' };
    await repos.clientes.guardar(c, 'p@example.com');
    const f = { ...nuevaFactura(c, 'p@example.com', AJUSTES_VACIOS), lineas: [{ concepto: 'Olivo', cantidad: 1, precio: 10, descuento: 0, iva: 10 }] };
    f.totales = calcularTotales(f.lineas);
    await repos.facturas.guardarBorrador(f);
    const r = await emitirFactura(repos, f, 'p@example.com');
    expect(r.ok && r.factura.codigo).toMatch(/^PRUEBA-F\d{4}-\d{4}$/);
    expect(await repos.facturas.ultimaHuella()).toBeNull();
  });

  it('al quitarlos no queda nada de prueba y se apaga el modo', async () => {
    const r = await quitarDatosPrueba(repos, 'p@example.com');
    expect(r).toMatchObject({ clientes: 5, presupuestos: 5, facturas: 6, gastos: 5, proyectos: 4, guias: 4 });
    expect(await modoPruebas(repos)).toBe(false);
    expect(await repos.facturas.listar()).toEqual([]);
    expect((await repos.clientes.listar()).map((c) => c.id)).toEqual(['real-1']);
    expect((await repos.presupuestos.listar()).some((p) => p.id.startsWith('prueba-'))).toBe(false);
    expect((await repos.contenido.listar('guias')).some((e) => e.id.startsWith('prueba-'))).toBe(false);
  });
});
