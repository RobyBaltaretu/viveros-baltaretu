import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { leerContenido } from '../../scripts/contenido/archivos.mjs';
import { AVISO_CUPO, CLAVE_NEURONAS, conversar, LIMITE_NEURONAS_DIA, responderPropuesta, type ModeloAsistente } from '../../src/server/asistente/agente.ts';
import { textoSeguro } from '../../src/server/asistente/formato.ts';
import { herramientasDe, type Contexto } from '../../src/server/asistente/herramientas.ts';
import { importarContenido, type EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios, type Usuario } from '../../src/server/data/index.ts';
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

const usuario = (email: string, rol: Usuario['rol'] = 'gerente'): Usuario => ({ email, nombre: 'Ana', rol, activo: true });
const ctx = (u: Usuario): Contexto => ({ repos, usuario: u, hoy: '2026-10-15', env: {} });
const uso = { inputTokens: { total: 2000, noCache: 2000, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 100, text: 100, reasoning: 0 } };
const fin = (unified: 'stop' | 'tool-calls') => ({ unified, raw: unified });

/** Modelo simulado: primero llama a una herramienta y después contesta con texto. */
function modelo(llamada: { herramienta: string; argumentos: unknown } | null, texto: string, vistos: unknown[] = []): ModeloAsistente {
  let paso = 0;
  return {
    nombre: 'simulado',
    neuronas: { entrada: 5500, salida: 36400 },
    modelo: new MockLanguageModelV4({
      doGenerate: async (opciones) => {
        vistos.push(opciones.prompt);
        paso++;
        if (llamada && paso === 1)
          return { content: [{ type: 'tool-call', toolCallId: 'l1', toolName: llamada.herramienta, input: JSON.stringify(llamada.argumentos) }], finishReason: fin('tool-calls'), usage: uso, warnings: [] } as never;
        return { content: [{ type: 'text', text: texto }], finishReason: fin('stop'), usage: uso, warnings: [] } as never;
      },
    }),
  };
}

describe('asistente completo', () => {
  it('consulta con herramientas y contesta con los datos', async () => {
    const vistos: unknown[] = [];
    const r = await conversar(ctx(usuario('consulta@example.com')), '¿cuánto cuesta la yuca?', [modelo({ herramienta: 'buscar_plantas', argumentos: { texto: 'yuca' } }, 'La **Yuca** está desde 20 €.', vistos)]);
    expect(r).toMatchObject({ texto: 'La **Yuca** está desde 20 €.', propuestas: [], modelo: 'simulado' });
    // El resultado de la herramienta llegó al modelo como datos.
    expect(JSON.stringify(vistos.at(-1))).toContain('yucca-elephantipes');
    expect(await repos.usoAsistente.obtener(CLAVE_NEURONAS, '2026-10-15')).toBeGreaterThan(0);
  });

  it('un cambio solo se aplica al decir «Sí», y con la validación del panel', async () => {
    const u = usuario('cambio@example.com');
    const r = await conversar(ctx(u), 'sube el palmito a 15', [modelo({ herramienta: 'cambiar_planta', argumentos: { planta: 'palmito', cambios: { precioDesde: 15 } } }, 'Te lo dejo preparado: pulsa «Sí».')]);
    expect(r.propuestas).toHaveLength(1);
    expect(r.propuestas[0].resumen).toContain('Palmito');
    expect((await repos.contenido.obtener('catalogo', 'chamaerops-humilis'))?.borrador.datos.precioDesde).not.toBe(15);

    expect(await responderPropuesta(ctx(usuario('otra@example.com')), r.propuestas[0].id, true)).toMatchObject({ ok: false });
    expect(await responderPropuesta(ctx(u), r.propuestas[0].id, true)).toMatchObject({ ok: true });
    expect((await repos.contenido.obtener('catalogo', 'chamaerops-humilis'))?.borrador.datos.precioDesde).toBe(15);
    expect(await responderPropuesta(ctx(u), r.propuestas[0].id, true)).toMatchObject({ ok: false, texto: 'Esa propuesta ya estaba resuelta.' });

    // Un cambio que rompe las reglas (más de 4 m) ni siquiera llega a propuesta.
    const malo = await conversar(ctx(u), 'pon el palmito a 6 m', [modelo({ herramienta: 'cambiar_planta', argumentos: { planta: 'palmito', cambios: { alturaMax: 6 } } }, 'No puede pasar de 4 m.')]);
    expect(malo.propuestas).toEqual([]);
  });

  it('las herramientas dependen del rol', () => {
    const editor = herramientasDe('editor').map((h) => h.nombre);
    expect(editor).toContain('cambiar_planta');
    expect(editor).not.toContain('ver_facturas');
    expect(editor).not.toContain('publicar_cambios');
    expect(herramientasDe('gerente').map((h) => h.nombre)).toEqual(expect.arrayContaining(['crear_factura', 'gestionar_factura', 'registrar_gasto', 'informe']));
  });

  it('si un modelo falla prueba el siguiente; sin cupo, sigue con las reglas locales', async () => {
    const roto: ModeloAsistente = { nombre: 'roto', neuronas: { entrada: 0, salida: 0 }, modelo: new MockLanguageModelV4({ doGenerate: async () => Promise.reject(new Error('caído')) }) };
    const r = await conversar(ctx(usuario('fallo@example.com')), 'hola', [roto, modelo(null, 'Hola, ¿en qué te ayudo?')]);
    expect(r).toMatchObject({ modelo: 'simulado', texto: 'Hola, ¿en qué te ayudo?' });

    await repos.usoAsistente.sumar(CLAVE_NEURONAS, new Date().toISOString().slice(0, 10), LIMITE_NEURONAS_DIA);
    const local = await conversar(ctx(usuario('cupo@example.com')), 'la yuca esta agotada', [modelo(null, 'no debería usarse')]);
    expect(local.modelo).toBe('reglas locales');
    expect(local.texto).toContain(AVISO_CUPO);
    expect(local.propuestas[0].resumen).toContain('Yuca');
  });

  it('el texto del modelo se enseña sin HTML', () => {
    expect(textoSeguro('Hola <script>alert(1)</script>\n- **uno**\n- dos')).toBe('<p>Hola &lt;script&gt;alert(1)&lt;/script&gt;</p><ul><li><strong>uno</strong></li><li>dos</li></ul>');
  });
});
