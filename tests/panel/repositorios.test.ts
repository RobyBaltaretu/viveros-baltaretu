import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
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

const autor = { email: 'gerente@example.com' };
const especie = (precio: number) => ({ datos: { slug: 'olivo', precioDesde: precio }, cuerpo: '' });

describe('repositorio de contenido', () => {
  it('guarda borradores, publica y deshace', async () => {
    const c = repos.contenido;
    await c.guardarBorrador('catalogo', 'olivo', especie(10), autor);
    expect((await c.pendientes()).map((e) => e.id)).toEqual(['olivo']);
    expect(await c.publicarTodo()).toBe(1);
    expect(await c.pendientes()).toEqual([]);
    expect(await c.publicarTodo()).toBe(0);

    await c.guardarBorrador('catalogo', 'olivo', especie(12), autor);
    await c.guardarBorrador('catalogo', 'olivo', especie(12), autor); // sin cambios: no se apunta
    const [ultimo] = await c.historial({ coleccion: 'catalogo', id: 'olivo' });
    expect(ultimo.antes?.datos.precioDesde).toBe(10);
    expect(ultimo.despues?.datos.precioDesde).toBe(12);
    expect((await c.publicadas())[0].documento.datos.precioDesde).toBe(10);

    await c.deshacer(ultimo.id, autor);
    expect((await c.obtener('catalogo', 'olivo'))?.borrador.datos.precioDesde).toBe(10);
    expect(await c.pendientes()).toEqual([]);
    expect((await c.historial({ limite: 1 }))[0].origen).toBe('deshacer');
  });

  it('archiva y lo saca de la web al publicar', async () => {
    const c = repos.contenido;
    await c.archivar('catalogo', 'olivo', true, autor);
    expect(await c.listar('catalogo')).toEqual([]);
    expect(await c.listar('catalogo', { incluirArchivadas: true })).toHaveLength(1);
    expect(await c.publicarTodo()).toBe(1);
    expect(await c.publicadas()).toEqual([]);
    const [archivado] = await c.historial({ limite: 1 });
    await c.deshacer(archivado.id, autor);
    expect(await c.listar('catalogo')).toHaveLength(1);
  });

  it('importa con borrador y publicado iguales', async () => {
    expect(await repos.contenido.importar([{ coleccion: 'ajustes', id: 'empresa', documento: { datos: { nombre: 'X' }, cuerpo: '' } }], autor)).toBe(1);
    expect((await repos.contenido.publicadas()).some((p) => p.id === 'empresa')).toBe(true);
  });
});

describe('otros repositorios', () => {
  it('fotos: guarda y devuelve los mismos bytes', async () => {
    const bytes = new Uint8Array([255, 216, 255, 0, 1, 2]);
    await repos.fotos.guardar({ ruta: 'catalogo/olivo/a.jpg', tipo: 'image/jpeg', bytes }, autor.email);
    expect((await repos.fotos.obtener('catalogo/olivo/a.jpg'))?.bytes).toEqual(bytes);
    expect((await repos.fotos.listar())[0].tamano).toBe(6);
  });

  it('usuarios, presupuestos y uso del asistente', async () => {
    await repos.usuarios.guardar({ email: 'Jefe@Example.com', nombre: 'Jefe', rol: 'propietario', activo: true });
    expect((await repos.usuarios.obtener('jefe@example.com'))?.rol).toBe('propietario');

    await repos.presupuestos.guardar({
      id: 'p1', fecha: '2026-10-14T10:00:00Z', estado: 'nuevo', idioma: 'es', tipoPedido: 'mayor', nombre: 'Ana',
      email: 'ana@example.com', telefono: '', empresa: '', provincia: '', mensaje: 'Hola', lineas: [{ especie: 'olivo', nombre: 'Olivo', cantidad: 3 }],
    });
    expect(await repos.presupuestos.contar('nuevo')).toBe(1);
    expect(await repos.presupuestos.cambiarEstado('p1', 'respondido')).toBe(true);
    expect((await repos.presupuestos.listar({ estado: 'respondido' }))[0].lineas[0].cantidad).toBe(3);

    expect(await repos.usoAsistente.sumar('a@example.com', '2026-10-14')).toBe(1);
    expect(await repos.usoAsistente.sumar('a@example.com', '2026-10-14')).toBe(2);
    await repos.auditoria.registrar('a@example.com', 'entrar');
    expect((await repos.auditoria.listar())[0].accion).toBe('entrar');
  });
});
