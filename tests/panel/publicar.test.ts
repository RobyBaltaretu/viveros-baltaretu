import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { describirCambio, esDeployHook, publicarCambios } from '../../src/server/panel/publicar.ts';
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

const HOOK = 'https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/abc-123';

describe('publicar cambios', () => {
  it('solo acepta direcciones de Deploy Hook de Cloudflare', () => {
    expect(esDeployHook(HOOK)).toBe(true);
    expect(esDeployHook('https://malo.example.com/hook')).toBe(false);
    expect(esDeployHook(undefined)).toBe(false);
  });

  it('sin cambios no lanza nada; con cambios publica y llama al hook una vez', async () => {
    const llamadas: string[] = [];
    const llamar = (async (url: string) => {
      llamadas.push(url);
      return new Response('{}');
    }) as typeof fetch;
    expect((await publicarCambios(repos, 'a@example.com', { DEPLOY_HOOK_URL: HOOK }, llamar)).estado).toBe('sin-cambios');
    await repos.contenido.guardarBorrador('catalogo', 'olivo', { datos: { nombre: { es: 'Olivo' } }, cuerpo: '' }, { email: 'a@example.com' });
    expect(await publicarCambios(repos, 'a@example.com', { DEPLOY_HOOK_URL: HOOK }, llamar)).toEqual({ estado: 'lanzada', cambios: 1 });
    expect(llamadas).toEqual([HOOK]);
    expect(await repos.contenido.pendientes()).toEqual([]);
  });

  it('sin Deploy Hook deja los cambios listos y lo dice', async () => {
    await repos.contenido.guardarBorrador('catalogo', 'olivo', { datos: { nombre: { es: 'Olivo 2' } }, cuerpo: '' }, { email: 'a@example.com' });
    expect((await publicarCambios(repos, 'a@example.com', {})).estado).toBe('sin-configurar');
    const [ultimo] = await repos.contenido.historial({ limite: 1 });
    expect(describirCambio(ultimo)).toBe('Planta: Olivo 2: cambiada');
  });
});
