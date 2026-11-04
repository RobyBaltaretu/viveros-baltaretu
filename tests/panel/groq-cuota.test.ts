import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { d1DePrueba } from './d1.ts';

let repos: Repositorios;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  const prueba = await d1DePrueba();
  cerrar = prueba.cerrar;
  await aplicarMigraciones(prueba.db);
  repos = crearRepositoriosD1(prueba.db);
}, 30_000);
afterAll(async () => { await cerrar?.(); });

describe('Turia · reserva atómica de Groq Free', () => {
  it('solo concede los usos disponibles con solicitudes simultáneas', async () => {
    const cuenta = 'turia-test:gubia-local-texto';
    const dia = '2026-11-04';
    const resultados = await Promise.all(
      Array.from({ length: 12 }, () => repos.usoAsistente.reservar(cuenta, dia, 3)),
    );
    expect(resultados.filter(Boolean)).toHaveLength(3);
    expect(await repos.usoAsistente.obtener(cuenta, dia)).toBe(3);
    expect(await repos.usoAsistente.reservar(cuenta, dia, 3)).toBe(false);
  });

  it('aisla contadores por usuario, tipo y dia', async () => {
    expect(await repos.usoAsistente.reservar('otro:gubia-local-texto', '2026-11-04', 1)).toBe(true);
    expect(await repos.usoAsistente.reservar('otro:gubia-local-vision', '2026-11-04', 1)).toBe(true);
    expect(await repos.usoAsistente.reservar('otro:gubia-local-texto', '2026-11-05', 1)).toBe(true);
    expect(await repos.usoAsistente.reservar('otro:gubia-local-texto', '2026-11-04', 1)).toBe(false);
  });

  it('no concede cuotas negativas ni cero', async () => {
    expect(await repos.usoAsistente.reservar('otra-cuenta', '2026-11-04', 0)).toBe(false);
    expect(await repos.usoAsistente.reservar('otra-cuenta', '2026-11-04', -1)).toBe(false);
  });
});
