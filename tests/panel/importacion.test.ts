import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { importarContenido, type EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { tokenValido } from '../../src/server/contenido/token.ts';
import { esRutaFotoValida, validarEntrada } from '../../src/server/contenido/validacion.ts';
import { leerContenido } from '../../scripts/contenido/archivos.mjs';
import { d1DePrueba } from './d1.ts';

let repos: Repositorios;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  const { db, cerrar: c } = await d1DePrueba();
  cerrar = c;
  await aplicarMigraciones(db);
  repos = crearRepositoriosD1(db);
}, 30_000);
afterAll(() => cerrar());

const contenido = await leerContenido(process.cwd());
const entradas = contenido.entradas.map((e) => ({
  coleccion: e.coleccion,
  id: e.id,
  documento: { datos: e.datos, cuerpo: e.cuerpo },
})) as EntradaImportada[];
const fotos = new Set<string>(contenido.fotos.map((f: { ruta: string }) => f.ruta));

describe('importación', () => {
  it('rechaza todo si una entrada no cumple las reglas del vivero', async () => {
    const mala = structuredClone(entradas.find((e) => e.coleccion === 'catalogo')!);
    mala.documento.datos.alturaMax = 6;
    const informe = await importarContenido(repos, [...entradas.slice(1), mala], fotos, 'test');
    expect(informe.importadas).toBe(0);
    expect(informe.errores[0].errores[0].campo).toBe('alturaMax');
    expect(await repos.contenido.publicadas()).toEqual([]);
  });

  it('rechaza si falta una foto', async () => {
    const informe = await importarContenido(repos, entradas, new Set(), 'test');
    expect(informe.fotosQueFaltan.length).toBeGreaterThan(0);
  });

  it('importa el contenido actual completo y publicado', async () => {
    const informe = await importarContenido(repos, entradas, fotos, 'test');
    expect(informe.importadas).toBe(entradas.length);
    expect(await repos.contenido.publicadas()).toHaveLength(entradas.length);
    expect(await repos.contenido.pendientes()).toEqual([]);
  });

  it('valida identificadores, colecciones y slugs', () => {
    expect(validarEntrada('otra', 'x', { datos: {}, cuerpo: '' }).ok).toBe(false);
    expect(validarEntrada('ajustes', 'inventado', { datos: {}, cuerpo: '' }).ok).toBe(false);
    expect(validarEntrada('catalogo', '../x', { datos: {}, cuerpo: '' }).ok).toBe(false);
  });
});

describe('seguridad de /api/contenido', () => {
  const peticion = (token?: string) => new Request('https://x/', token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  const bueno = 'a'.repeat(40);
  it('exige un token largo y correcto', async () => {
    expect(await tokenValido(peticion(bueno), bueno)).toBe(true);
    expect(await tokenValido(peticion('otro'), bueno)).toBe(false);
    expect(await tokenValido(peticion(), bueno)).toBe(false);
    expect(await tokenValido(peticion('corto'), 'corto')).toBe(false);
    expect(await tokenValido(peticion(), undefined)).toBe(false);
  });
  it('solo admite rutas de foto seguras', () => {
    expect(esRutaFotoValida('catalogo/olivo/a.jpg')).toBe(true);
    expect(esRutaFotoValida('../secreto.jpg')).toBe(false);
    expect(esRutaFotoValida('catalogo/a.exe')).toBe(false);
  });
});
