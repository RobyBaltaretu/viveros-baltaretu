import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import baltaretu from '../../clientes/baltaretu/cliente.config.json';
import turia from '../../clientes/turia/cliente.config.json';
import { esLimite, modelosDe } from '../../src/server/asistente/agente.ts';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { esquemaCliente, IA_POR_DEFECTO, iaDe, MODELOS_POR_DEFECTO, SIMULACIONES_MES_POR_DEFECTO } from '../../src/plataforma/configuracion.ts';
import { d1DePrueba } from '../panel/d1.ts';

const ai = { run: async () => ({}) };

describe('IA por cliente: configuración', () => {
  it('Baltaretu sigue como siempre: Workers AI, Groq solo con clave, reglas locales y sin simulador', () => {
    const c = esquemaCliente.parse(baltaretu);
    expect(iaDe(c)).toEqual({ asistente: ['workers-ai', 'groq', 'local'], simulador: 'none', modelos: MODELOS_POR_DEFECTO, simulacionesMes: SIMULACIONES_MES_POR_DEFECTO });
    // Lo mismo que un cliente sin `ia`.
    const { ia: _ia, ...sinIa } = baltaretu;
    expect(iaDe(esquemaCliente.parse(sinIa))).toEqual(iaDe(c));
    expect(IA_POR_DEFECTO.asistente).toEqual(['workers-ai', 'groq', 'local']);
  });

  it('Turia: Groq primero, Gemini en el simulador y tope de 250 al mes', () => {
    const ia = iaDe(esquemaCliente.parse(turia));
    expect(ia.asistente).toEqual(['groq', 'workers-ai', 'local']);
    expect(ia.simulador).toBe('gemini');
    expect(ia.simulacionesMes).toBe(250);
  });

  it('rechaza listas repetidas, «local» en medio y proveedores desconocidos', () => {
    const con = (ia: unknown) => esquemaCliente.safeParse({ ...turia, ia }).success;
    expect(con({ asistente: ['groq', 'groq'], simulador: 'none' })).toBe(false);
    expect(con({ asistente: ['local', 'groq'], simulador: 'none' })).toBe(false);
    expect(con({ asistente: ['openai'], simulador: 'none' })).toBe(false);
    expect(con({ asistente: ['groq'], simulador: 'dalle' })).toBe(false);
    expect(con({ asistente: ['groq'], simulador: 'gemini', clave: 'x' })).toBe(false);
    expect(con({ asistente: ['groq'], simulador: 'gemini' })).toBe(true);
  });
});

describe('IA por cliente: modelos del asistente', () => {
  it('Baltaretu: el orden y los nombres de siempre', async () => {
    const ia = iaDe(esquemaCliente.parse(baltaretu));
    expect((await modelosDe({ AI: ai }, ia)).map((m) => m.nombre)).toEqual(['glm-4.7-flash', 'gemma-4-26b']);
    const con = await modelosDe({ AI: ai, GROQ_API_KEY: 'k' }, ia);
    expect(con.map((m) => m.nombre)).toEqual(['glm-4.7-flash', 'gemma-4-26b', 'groq gpt-oss-120b']);
    expect(con.some((m) => m.avisoLimite)).toBe(false);
    // Por defecto, el cliente del build (sin CLIENTE_CONFIG, Baltaretu).
    expect((await modelosDe({ AI: ai, GROQ_API_KEY: 'k' })).map((m) => m.nombre)).toEqual(con.map((m) => m.nombre));
  });

  it('Turia: Groq primero (con aviso de límite) y Workers AI de respaldo; sin clave, solo Workers AI', async () => {
    const ia = iaDe(esquemaCliente.parse(turia));
    const con = await modelosDe({ AI: ai, GROQ_API_KEY: 'k' }, ia);
    expect(con.map((m) => m.nombre)).toEqual(['groq gpt-oss-120b', 'glm-4.7-flash', 'gemma-4-26b']);
    expect(con[0]!.avisoLimite).toMatch(/demasiadas peticiones/);
    expect((await modelosDe({ AI: ai }, ia)).map((m) => m.nombre)).toEqual(['glm-4.7-flash', 'gemma-4-26b']);
    expect(await modelosDe({}, ia)).toEqual([]);
  });

  it('reconoce un 429, también dentro de los reintentos', () => {
    expect(esLimite({ statusCode: 429 })).toBe(true);
    expect(esLimite({ lastError: { statusCode: 429 } })).toBe(true);
    expect(esLimite({ errors: [{ statusCode: 500 }, { statusCode: 429 }] })).toBe(true);
    expect(esLimite({ statusCode: 500 })).toBe(false);
    expect(esLimite(new Error('x'))).toBe(false);
  });

  it('el lector de tickets usa solo Workers AI, sea cual sea el cliente', () => {
    for (const f of ['src/server/gastos/lector.ts', 'src/pages/panel/gastos/nuevo.astro', 'src/server/panel/gastos.ts']) {
      const codigo = readFileSync(f, 'utf8');
      expect(codigo, f).not.toMatch(/groq|gemini|GROQ_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|iaDe\(/i);
    }
    expect(readFileSync('src/pages/panel/gastos/nuevo.astro', 'utf8')).toContain('crearLectorWorkersAI');
  });
});

describe('IA por cliente: contador mensual del simulador', () => {
  let repos: Repositorios;
  let cerrar: () => Promise<void>;
  beforeAll(async () => {
    const d = await d1DePrueba();
    cerrar = d.cerrar;
    await aplicarMigraciones(d.db);
    repos = crearRepositoriosD1(d.db);
  });
  afterAll(() => cerrar());

  it('reserva hasta el tope y ni uno más, aunque lleguen a la vez', async () => {
    const r = await Promise.all(Array.from({ length: 8 }, () => repos.usoSimulador.reservar('turia', '2026-10', 5)));
    expect(r.filter(Boolean)).toHaveLength(5);
    expect(await repos.usoSimulador.usos('turia', '2026-10')).toBe(5);
    expect(await repos.usoSimulador.reservar('turia', '2026-10', 5)).toBe(false);
    // Cada mes y cada cliente, su cuenta.
    expect(await repos.usoSimulador.usos('turia', '2026-11')).toBe(0);
    expect(await repos.usoSimulador.reservar('otro', '2026-10', 5)).toBe(true);
  });

  it('devuelve la reservada si la IA falla, sin bajar de cero', async () => {
    expect(await repos.usoSimulador.reservar('dev', '2026-10', 1)).toBe(true);
    expect(await repos.usoSimulador.reservar('dev', '2026-10', 1)).toBe(false);
    await repos.usoSimulador.devolver('dev', '2026-10');
    expect(await repos.usoSimulador.usos('dev', '2026-10')).toBe(0);
    await repos.usoSimulador.devolver('dev', '2026-10');
    await repos.usoSimulador.devolver('nadie', '2026-10');
    expect(await repos.usoSimulador.usos('dev', '2026-10')).toBe(0);
    expect(await repos.usoSimulador.reservar('dev', '2026-10', 0)).toBe(false);
  });
});
