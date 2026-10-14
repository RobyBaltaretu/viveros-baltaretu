import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { leerContenido } from '../../scripts/contenido/archivos.mjs';
import { crearCopia, deBase64, leerCopia } from '../../src/server/contenido/copia.ts';
import { exportarPublicado } from '../../src/server/contenido/exportacion.ts';
import { importarContenido, type EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { d1DePrueba } from './d1.ts';

const bases: { repos: Repositorios; cerrar: () => Promise<void> }[] = [];
beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const { db, cerrar } = await d1DePrueba();
    await aplicarMigraciones(db);
    bases.push({ repos: crearRepositoriosD1(db), cerrar });
  }
}, 30_000);
afterAll(async () => {
  for (const b of bases) await b.cerrar();
});

describe('copia de seguridad y restauración', () => {
  it('una copia restaurada en una base vacía deja el mismo contenido y las mismas fotos', async () => {
    const [origen, destino] = bases.map((b) => b.repos);
    const { entradas, fotos } = await leerContenido(process.cwd());
    for (const f of fotos) await origen.fotos.guardar({ ruta: f.ruta, tipo: 'image/jpeg', bytes: f.bytes }, 'test');
    const lista = entradas.map((e) => ({ coleccion: e.coleccion, id: e.id, documento: { datos: e.datos, cuerpo: e.cuerpo } })) as EntradaImportada[];
    expect((await importarContenido(origen, lista, new Set(fotos.map((f) => f.ruta)), 'test')).importadas).toBe(lista.length);

    const exportacion = await exportarPublicado(origen);
    const copia = leerCopia(JSON.stringify(await crearCopia(exportacion, async (r) => (await origen.fotos.obtener(r))?.bytes ?? null)));
    expect(copia.fotos).toHaveLength(exportacion.fotos.length);

    for (const f of copia.fotos) await destino.fotos.guardar({ ruta: f.ruta, tipo: 'image/jpeg', bytes: deBase64(f.base64) }, 'test');
    const restaurar = copia.entradas.map((e) => ({ coleccion: e.coleccion, id: e.id, documento: { datos: e.datos, cuerpo: e.cuerpo } }));
    expect((await importarContenido(destino, restaurar, new Set(copia.fotos.map((f) => f.ruta)), 'test')).importadas).toBe(lista.length);

    expect(await exportarPublicado(destino)).toEqual(exportacion);
    for (const ruta of exportacion.fotos) expect((await destino.fotos.obtener(ruta))?.bytes).toEqual((await origen.fotos.obtener(ruta))?.bytes);
  });

  it('rechaza archivos que no son copias', () => {
    expect(() => leerCopia('{"hola":1}')).toThrow('no es una copia');
  });
});
