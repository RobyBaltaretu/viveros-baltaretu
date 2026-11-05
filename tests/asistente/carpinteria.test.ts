import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { conversar, responderPropuesta } from '../../src/server/asistente/agente.ts';
import { herramienta, herramientasDe, herramientasPara, type Cambio, type Consulta, type Contexto } from '../../src/server/asistente/herramientas.ts';
import { NOMBRES_CARPINTERIA } from '../../src/server/asistente/herramientas-carpinteria.ts';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { clienteVacio } from '../../src/server/facturas/facturas.ts';
import { cargarCliente } from '../../src/plataforma/cargar.ts';
import { d1DePrueba } from '../panel/d1.ts';
import { anotarLimitesGroq, quedanParaGubia } from '../../src/server/asistente/estado-ia.ts';

// Gubia (Turia) lleva el panel de la carpintería: presupuestos, catálogo, proveedores y pedidos.
let repos: Repositorios;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  const d = await d1DePrueba();
  cerrar = d.cerrar;
  await aplicarMigraciones(d.db);
  repos = crearRepositoriosD1(d.db);
});
afterAll(() => cerrar());
afterEach(() => vi.unstubAllEnvs());
const comoTuria = () => vi.stubEnv('CLIENTE_CONFIG', JSON.stringify(cargarCliente('turia')));
const ctx = (): Contexto => ({ repos, usuario: { email: 'ana@example.com', nombre: 'Ana', rol: 'propietario', activo: true }, hoy: '2026-11-01', env: {} as never });

/** Prepara y, si sale, aplica (lo que hace pulsar «Sí»). */
async function conSi(nombre: string, argumentos: unknown) {
  const h = herramienta(nombre) as unknown as Cambio<unknown>;
  const p = await h.preparar(ctx(), h.esquema.parse(argumentos));
  if (!p.ok) throw new Error(p.error);
  const usuario = ctx().usuario;
  const conversacion = await repos.conversaciones.actual(usuario.email);
  const id = crypto.randomUUID();
  await repos.conversaciones.guardarPropuesta({ id, email: usuario.email, conversacion, herramienta: nombre, argumentos: p.argumentos as Record<string, unknown>, resumen: p.resumen, estado: 'pendiente', resultado: '', creada: new Date().toISOString() });
  await repos.conversaciones.anadir({ conversacion, rol: 'asistente', texto: p.resumen, propuestas: [id] });
  if (nombre === 'crear_pedido') {
    await conversar(ctx(), 'perfecto', []);
    expect((await repos.conversaciones.propuesta(id))?.estado).toBe('pendiente');
  }
  return { resumen: p.resumen, ...(await responderPropuesta(ctx(), id, true)) };
}
const consultar = async (nombre: string, a: unknown) => {
  const h = herramienta(nombre) as unknown as Consulta<unknown>;
  return (await h.consultar(ctx(), h.esquema.parse(a))) as Record<string, unknown[]>;
};

describe('Gubia: herramientas de la carpintería', () => {
  it('en Baltaretu no existen; en Turia, sí (y no las de plantas)', () => {
    const vivero = herramientasDe('propietario').map((h) => h.nombre);
    for (const n of NOMBRES_CARPINTERIA) expect(vivero, n).not.toContain(n);
    comoTuria();
    const turia = herramientasDe('propietario').map((h) => h.nombre);
    for (const n of NOMBRES_CARPINTERIA) expect(turia, n).toContain(n);
    expect(turia).not.toContain('cambiar_plantas');
    expect(herramientasDe('editor').map((h) => h.nombre)).not.toContain('crear_pedido');
    expect(herramientasPara(herramientasDe('propietario'), 'hazme un pedido de tableros').map((h) => h.nombre)).toEqual(expect.arrayContaining(['crear_pedido', 'buscar_catalogo', 'ver_proveedores']));
  });

  it('del catálogo al presupuesto, sus cobros y su factura; y el pedido del material', async () => {
    comoTuria();
    await repos.clientes.guardar({ ...clienteVacio(), id: 'c1', nombre: 'Laura Gómez', nif: '12345678Z' }, 'ana@example.com');
    const art = await conSi('cambiar_articulos', { cambios: [{ nuevo: { categoria: 'tableros', nombre: 'Melamina blanca 19 mm', unidad: 'm²' }, coste: 12, margen: 50, proveedor: 'Tableros Levante' }] });
    expect(art).toMatchObject({ ok: true, texto: '1 artículo guardado.' });
    expect((await consultar('buscar_catalogo', { texto: 'melamina' })).articulos).toEqual([expect.objectContaining({ nombre: 'Melamina blanca 19 mm', precioVenta: 18 })]);
    await conSi('cambiar_articulos', { cambios: [{ articulo: 'melamina blanca', coste: 14 }] });
    expect((await consultar('buscar_catalogo', { texto: 'melamina' })).articulos).toEqual([expect.objectContaining({ coste: 14, precioVenta: 21 })]);

    const p = await conSi('crear_presupuesto_cliente', { cliente: 'laura', concepto: 'Armario del dormitorio', lineas: [{ concepto: 'Melamina', cantidad: 10, precio: 21 }, { concepto: 'Montaje', cantidad: 1, precio: 190 }], anticipoPct: 40 });
    expect(p.resumen).toContain('Laura Gómez');
    expect(p.texto).toMatch(/^Presupuesto P2026-0001 creado en borrador \(484,00 €/);
    await expect(conSi('gestionar_presupuesto_cliente', { presupuesto: 'P2026-0001', accion: 'aceptado' })).rejects.toThrow(/solo puede pasar a: enviado/);
    await conSi('gestionar_presupuesto_cliente', { presupuesto: 'P2026-0001', accion: 'enviado' });
    await conSi('gestionar_presupuesto_cliente', { presupuesto: 'P2026-0001', accion: 'aceptado' });
    expect((await conSi('gestionar_presupuesto_cliente', { presupuesto: 'P2026-0001', accion: 'facturar' })).ok).toBe(true);
    expect((await conSi('gestionar_presupuesto_cliente', { presupuesto: 'P2026-0001', accion: 'cobro_anticipo', fecha: '2026-11-01' })).ok).toBe(true);
    expect((await consultar('ver_presupuestos_cliente', { cliente: 'laura' })).presupuestos).toEqual([expect.objectContaining({ estado: 'aceptado', anticipoCobrado: '2026-11-01', porFacturar: 'final' })]);

    await conSi('guardar_proveedor', { nombre: 'Tableros Levante', telefono: '600000000', plazoDias: 3 });
    await expect(conSi('guardar_proveedor', { proveedor: 'levante', nif: 'X' })).rejects.toThrow(/NIF no es válido/);
    const pe = await conSi('crear_pedido', { proveedor: 'levante', presupuesto: 'P2026-0001', lineas: [{ concepto: 'Melamina blanca 19 mm', cantidad: 10, articulo: 'melamina' }] });
    expect(pe.resumen).toContain('coste 140,00 €');
    expect(pe.texto).toMatch(/^Pedido PE2026-0001 preparado/);
    await conSi('gestionar_pedido', { pedido: 'PE2026-0001', estado: 'enviado' });
    expect((await consultar('ver_pedidos', { estado: 'enviado' })).pedidos).toEqual([expect.objectContaining({ codigo: 'PE2026-0001', proveedor: 'Tableros Levante', coste: 140 })]);
  });

  it('estado_ia: el modelo que atiende ahora y el límite aproximado que queda', async () => {
    comoTuria();
    expect(herramientasPara(herramientasDe('propietario'), 'Dime modelo de IA interno que usas y el límite aproximado que queda').map((h) => h.nombre)).toContain('estado_ia');
    const dia = '2026-11-01';
    for (let i = 0; i < 3; i++) await repos.usoAsistente.reservarGroq(dia, 'asistente', 1000);
    anotarLimitesGroq('groq llama-4-scout-17b-16e-instruct', { 'x-ratelimit-remaining-requests': '987', 'x-ratelimit-limit-requests': '1000', 'x-ratelimit-remaining-tokens': '29000', 'x-ratelimit-limit-tokens': '30000' });
    const h = herramienta('estado_ia') as unknown as Consulta<unknown>;
    const r = (await h.consultar({ ...ctx(), modeloActual: 'groq llama-4-scout-17b-16e-instruct' }, {})) as { modeloActual: string; respaldo: string[]; panelHoy: unknown; segunGroq: unknown; aviso: string };
    expect(r.modeloActual).toBe('groq llama-4-scout-17b-16e-instruct');
    expect(r.respaldo).toEqual(['groq gpt-oss-120b', 'groq llama-3.3-70b-versatile']);
    expect(r.panelHoy).toMatchObject({ peticionesGroqUsadas: 3, quedanParaGubia: 997 });
    expect(r.segunGroq).toMatchObject({ peticionesRestantesHoy: 987, tokensRestantesEsteMinuto: 29000 });
    expect(r.aviso).toMatch(/aproximadas/);
    // Sin modelo en el contexto: el primero de la cadena.
    expect(((await h.consultar(ctx(), {})) as Record<string, unknown>).modeloActual).toBe('groq gpt-oss-120b');
    // Con el importador usado, Gubia solo tiene el 30 %.
    expect(quedanParaGubia({ importador: 10, asistente: 100 })).toBe(200);
    expect(quedanParaGubia({ importador: 700, asistente: 300 })).toBe(0);
  });
});
