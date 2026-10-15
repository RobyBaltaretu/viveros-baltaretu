import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import frases from './frases.json';
import { leerContenido } from '../../scripts/contenido/archivos.mjs';
import { medirBanco } from '../../src/server/asistente/banco.ts';
import { deRespuestaModelo, interpretarConRespaldo, interpreteLocal, type Interprete } from '../../src/server/asistente/interprete.ts';
import { importarContenido, type EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { d1DePrueba } from '../panel/d1.ts';

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

describe('banco de frases del asistente (intérprete local)', () => {
  it('entiende al menos el 85 % y ninguna frase fuera de tema acaba en un cambio', async () => {
    const r = await medirBanco(repos, [interpreteLocal], frases);
    console.log(`Precisión del intérprete local: ${r.aciertos}/${r.total} (${Math.round(r.precision * 100)} %)`);
    if (r.fallos.length) console.log(r.fallos);
    expect(r.peligrosas).toEqual([]);
    expect(r.precision).toBeGreaterThanOrEqual(0.85);
  });
});

describe('proveedor intercambiable y respaldo', () => {
  it('si el modelo falla, usa el siguiente intérprete', async () => {
    const roto: Interprete = { nombre: 'roto', interpretar: async () => { throw new Error('cupo agotado'); } };
    const r = await interpretarConRespaldo([roto, interpreteLocal], 'sube la yuca a 12', { plantas: [] });
    expect(r).toMatchObject({ tipo: 'accion', interprete: 'reglas' });
  });

  it('la salida del modelo se limita a la lista cerrada', () => {
    expect(deRespuestaModelo('{"tipo":"borrar_todo"}')).toEqual({ tipo: 'no-entiendo' });
    expect(deRespuestaModelo('no es json')).toEqual({ tipo: 'no-entiendo' });
    expect(deRespuestaModelo({ tipo: 'fuera_de_tema' })).toEqual({ tipo: 'fuera-de-tema' });
    expect(deRespuestaModelo({ tipo: 'cambiar_precio', planta: 'Yuca', precio: 12 })).toEqual({ tipo: 'accion', accion: { tipo: 'cambiar_precio', planta: 'Yuca', valor: 12 } });
  });
});

describe('frases de control (no se usan para ajustar las reglas)', () => {
  it('mide la precisión con frases nuevas y nunca aplica nada fuera de tema', async () => {
    const control = (await import('./frases-control.json')).default;
    const r = await medirBanco(repos, [interpreteLocal], control);
    console.log(`Precisión del intérprete local con frases de control: ${r.aciertos}/${r.total} (${Math.round(r.precision * 100)} %)`);
    if (r.fallos.length) console.log(r.fallos);
    expect(r.peligrosas).toEqual([]);
  });
});
