import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { leerContenido } from '../../scripts/contenido/archivos.mjs';
import { aplicarAccion, prepararAccion } from '../../src/server/asistente/acciones.ts';
import { buscarPlanta } from '../../src/server/asistente/coincidencia.ts';
import { importarContenido, type EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
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

const gerente = 'gerente' as const;

describe('acciones del asistente', () => {
  it('encuentra la planta con faltas y sin tildes', () => {
    const c = [
      { id: 'washingtonia-robusta', nombres: ['Washingtonia robusta', 'Mexican fan palm'] },
      { id: 'higuera-comun', nombres: ['Higuera común', 'Ficus carica'] },
    ];
    expect(buscarPlanta('la washintonia', c)).toMatchObject({ tipo: 'una', elegida: { id: 'washingtonia-robusta' } });
    expect(buscarPlanta('higuera comun', c)).toMatchObject({ tipo: 'una', elegida: { id: 'higuera-comun' } });
    expect(buscarPlanta('tomate', c)).toEqual({ tipo: 'ninguna' });
  });

  it('pregunta cuál si el nombre vale para varias', async () => {
    const r = await prepararAccion(repos, gerente, { tipo: 'cambiar_precio', planta: 'phoenix', valor: 20 });
    expect(r.estado).toBe('elegir-planta');
  });

  it('prepara el resumen sin cambiar nada y aplica solo al confirmar', async () => {
    const r = await prepararAccion(repos, gerente, { tipo: 'cambiar_precio', planta: 'washingtonia', valor: 20 });
    expect(r.estado).toBe('lista');
    expect(r.estado === 'lista' && r.resumen.replace(/\s/g, ' ')).toBe('Voy a cambiar el precio de Washingtonia robusta de 18 € a 20 €.');
    expect((await repos.contenido.pendientes()).length).toBe(0);
    const hecho = await aplicarAccion(repos, gerente, 'g@example.com', { tipo: 'cambiar_precio', planta: 'washingtonia-robusta', valor: 20 });
    expect(hecho.ok).toBe(true);
    const e = await repos.contenido.obtener('catalogo', 'washingtonia-robusta');
    expect(e?.borrador.datos.precioDesde).toBe(20);
    expect(JSON.stringify(e?.borrador.datos.seo)).toContain('20');
    expect(e?.publicado?.datos.precioDesde).toBe(18);
    expect((await repos.contenido.historial({ limite: 1 }))[0].origen).toBe('asistente');
  });

  it('respeta las reglas del vivero y los permisos', async () => {
    expect((await prepararAccion(repos, gerente, { tipo: 'cambiar_precio_unidad', planta: 'washingtonia-robusta', valor: 30 })).estado).toBe('no-puedo');
    expect((await prepararAccion(repos, 'editor', { tipo: 'contar_presupuestos' })).estado).toBe('no-puedo');
    expect((await prepararAccion(repos, gerente, { tipo: 'cambiar_precio', planta: 'washingtonia-robusta', valor: -3 })).estado).toBe('falta');
    expect((await prepararAccion(repos, gerente, { tipo: 'cambiar_disponibilidad', planta: 'washingtonia-robusta', valor: 'regalada' })).estado).toBe('falta');
    expect((await prepararAccion(repos, gerente, { tipo: 'borrar_todo' as never })).estado).toBe('no-puedo');
  });

  it('cuenta los presupuestos nuevos', async () => {
    expect(await prepararAccion(repos, gerente, { tipo: 'contar_presupuestos' })).toEqual({ estado: 'respuesta', texto: 'No hay presupuestos nuevos.' });
  });
});
