import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { anadirFoto, categorias, fotoDeProyecto, guardarProyecto, MAXIMO_FOTOS_POR_LADO, quitarFoto } from '../../src/server/portafolio/portafolio.ts';
import { MAXIMO_FOTO } from '../../src/server/panel/fotos.ts';
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

const yo = 'propietario@example.com';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49]);

describe('portafolio privado', () => {
  it('crea y edita proyectos con sus datos, y valida lo que se escribe', async () => {
    const r = await guardarProyecto(repos, { titulo: 'Armario empotrado en Ruzafa', categoria: 'Armarios', descripcion: 'Puertas correderas lacadas.', materiales: 'MDF lacado blanco', anio: 2025, localidad: 'Valencia' }, yo);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proyecto).toMatchObject({ titulo: 'Armario empotrado en Ruzafa', categoria: 'Armarios', anio: 2025, antes: [], despues: [], archivado: false });
    expect(r.proyecto.id).toMatch(/^armario-empotrado-en-ruzafa-[a-z0-9]+$/);

    const editado = await guardarProyecto(repos, { id: r.proyecto.id, titulo: 'Armario empotrado', categoria: 'Armarios', anio: '2024' as unknown as number }, yo);
    expect(editado.ok && editado.proyecto).toMatchObject({ id: r.proyecto.id, titulo: 'Armario empotrado', anio: 2024, orden: r.proyecto.orden });

    expect(await guardarProyecto(repos, { titulo: '  ' }, yo)).toEqual({ ok: false, error: 'Escribe un título.' });
    expect(await guardarProyecto(repos, { titulo: 'X', anio: 1800 }, yo)).toMatchObject({ ok: false, error: expect.stringContaining('año') });
    expect(await guardarProyecto(repos, { id: 'no-existe', titulo: 'X' }, yo)).toEqual({ ok: false, error: 'Ese proyecto no existe.' });
  });

  it('fotos de antes y después: comprueba que son fotos, el tamaño y cuántas hay; nunca van a las fotos públicas', async () => {
    const r = await guardarProyecto(repos, { titulo: 'Cocina en Paterna', categoria: 'Cocinas' }, yo);
    if (!r.ok) throw new Error(r.error);
    const id = r.proyecto.id;
    const antes = await anadirFoto(repos, id, 'antes', JPEG, yo);
    const despues = await anadirFoto(repos, id, 'despues', PNG, yo);
    expect(antes.ok && despues.ok).toBe(true);
    const p = (await repos.portafolio.obtener(id))!;
    expect(p.antes).toHaveLength(1);
    expect(p.despues).toHaveLength(1);
    expect((await fotoDeProyecto(repos, p.antes[0]))?.tipo).toBe('image/jpeg');
    expect(Array.from((await fotoDeProyecto(repos, p.despues[0]))!.bytes)).toEqual(Array.from(PNG));

    expect(await anadirFoto(repos, id, 'antes', new TextEncoder().encode('<script>no soy una foto</script>'), yo)).toMatchObject({ ok: false, error: expect.stringContaining('no es una foto') });
    expect(await anadirFoto(repos, id, 'antes', new Uint8Array(0), yo)).toMatchObject({ ok: false });
    const grande = new Uint8Array(MAXIMO_FOTO + 1);
    grande.set(JPEG);
    expect(await anadirFoto(repos, id, 'antes', grande, yo)).toMatchObject({ ok: false, error: expect.stringContaining('demasiado grande') });
    expect(await anadirFoto(repos, 'no-existe', 'antes', JPEG, yo)).toMatchObject({ ok: false });

    for (let i = 1; i < MAXIMO_FOTOS_POR_LADO; i++) expect((await anadirFoto(repos, id, 'antes', JPEG, yo)).ok).toBe(true);
    expect(await anadirFoto(repos, id, 'antes', JPEG, yo)).toMatchObject({ ok: false, error: expect.stringContaining('Quita alguna') });

    expect(await repos.fotos.listar()).toEqual([]);

    const quitada = (await repos.portafolio.obtener(id))!.antes[0];
    expect(await quitarFoto(repos, id, quitada, yo)).toBe(true);
    expect((await repos.portafolio.obtener(id))!.antes).not.toContain(quitada);
    expect(await repos.adjuntos.obtener(quitada)).toBeNull();
    expect(await quitarFoto(repos, id, 'otra', yo)).toBe(false);
  });

  it('una foto de otro ámbito no se enseña como foto del portafolio', async () => {
    await repos.adjuntos.guardar({ id: 'ajeno', ambito: 'obras', ref: 'x', tipo: 'image/jpeg', bytes: JPEG }, yo);
    expect(await fotoDeProyecto(repos, 'ajeno')).toBeNull();
  });

  it('archivar los quita de la lista y las categorías salen sin repetir', async () => {
    const lista = await repos.portafolio.listar();
    expect(categorias(lista)).toEqual(['Armarios', 'Cocinas']);
    expect(await repos.portafolio.archivar(lista[0].id, true, yo)).toBe(true);
    expect((await repos.portafolio.listar()).map((p) => p.id)).not.toContain(lista[0].id);
    expect((await repos.portafolio.listar({ incluirArchivados: true })).find((p) => p.id === lista[0].id)?.archivado).toBe(true);
  });
});
