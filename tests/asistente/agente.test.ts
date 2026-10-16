import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { leerContenido } from '../../scripts/contenido/archivos.mjs';
import { AVISO_CUPO, borrarConversacion, CLAVE_NEURONAS, conversar, enviarFotos, LIMITE_NEURONAS_DIA, LIMITE_MENSAJES_PERSONA, responderPropuesta, usoDeHoy, type ModeloAsistente } from '../../src/server/asistente/agente.ts';
import { textoSeguro } from '../../src/server/asistente/formato.ts';
import { herramientasDe, herramientasPara, type Contexto } from '../../src/server/asistente/herramientas.ts';
import { accionRapida } from '../../src/server/panel/plantas.ts';
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
    expect(await repos.usoAsistente.obtener(CLAVE_NEURONAS, new Date().toISOString().slice(0, 10))).toBeGreaterThan(0);
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

  it('cambia muchas plantas con un solo «Sí» y se puede deshacer en bloque', async () => {
    const u = usuario('bloque@example.com');
    const c = ctx(u);
    const palmeras = (await repos.contenido.listar('catalogo')).filter((e) => e.borrador.datos.familia === 'palmeras');
    const conPrecio = palmeras.filter((e) => typeof e.borrador.datos.precioDesde === 'number');
    expect(conPrecio.length).toBeGreaterThan(1);
    const antes = new Map(conPrecio.map((e) => [e.id, e.borrador.datos.precioDesde as number]));

    const r = await conversar(c, 'sube un 10 % las palmeras', [modelo({ herramienta: 'cambiar_plantas', argumentos: { seleccion: { familia: 'palmeras' }, ajustePrecio: { porcentaje: 10, redondeo: 'euro' } } }, 'Pulsa «Sí».')]);
    expect(r.propuestas).toHaveLength(1);
    expect(r.propuestas[0].resumen).toMatch(/plantas .*\+10 %, redondeado al euro/);
    expect(await responderPropuesta(c, r.propuestas[0].id, true)).toMatchObject({ ok: true });
    for (const [id, precio] of antes) expect((await repos.contenido.obtener('catalogo', id))?.borrador.datos.precioDesde).toBe(Math.round(precio * 1.1));

    // Se deshace todo de una vez y cada ficha vuelve a su precio.
    const ids = (await repos.contenido.historial({ limite: 50 })).filter((x) => x.email === u.email).map((x) => x.id);
    const d = await conversar(c, 'deshaz eso', [modelo({ herramienta: 'deshacer_cambio', argumentos: { cambioIds: ids } }, 'Pulsa «Sí».')]);
    expect(await responderPropuesta(c, d.propuestas[0].id, true)).toMatchObject({ ok: true });
    for (const [id, precio] of antes) expect((await repos.contenido.obtener('catalogo', id))?.borrador.datos.precioDesde).toBe(precio);

    // Sin decir qué plantas no hay propuesta; lo que rompe las reglas tampoco.
    const sinSeleccion = await conversar(c, 'agótalo todo', [modelo({ herramienta: 'cambiar_plantas', argumentos: { seleccion: {}, cambios: { disponibilidad: 'agotado' } } }, '¿Qué plantas?')]);
    expect(sinSeleccion.propuestas).toEqual([]);
    const precioUnidad = await conversar(c, 'precio por unidad 5 a todas', [modelo({ herramienta: 'cambiar_plantas', argumentos: { seleccion: { todas: true, ventaUnitaria: false }, cambios: { precioUnidad: 5 } } }, 'No se puede.')]);
    expect(precioUnidad.propuestas).toEqual([]);
  });

  it('presupuestos, textos y clientes también van en bloque', async () => {
    const c = ctx(usuario('bloque2@example.com'));
    for (const id of ['p1', 'p2']) {
      await repos.presupuestos.guardar({ id, fecha: '2026-01-10T10:00:00Z', estado: 'nuevo', nombre: `Cliente ${id}`, empresa: '', email: `${id}@example.com`, telefono: '', provincia: 'Valencia', tipoPedido: 'mayor', mensaje: '', lineas: [], idioma: 'es' });
    }
    const p = await conversar(c, 'archiva los presupuestos viejos', [modelo({ herramienta: 'cambiar_presupuestos', argumentos: { estadoActual: 'nuevo', antesDe: '2026-02-01', estado: 'archivado' } }, 'Pulsa «Sí».')]);
    expect(p.propuestas[0].resumen).toContain('2 presupuestos');
    expect(await responderPropuesta(c, p.propuestas[0].id, true)).toMatchObject({ ok: true });
    expect((await repos.presupuestos.obtener('p1'))?.estado).toBe('archivado');

    const t = await conversar(c, 'cambia el pedido mínimo y el teléfono', [
      modelo({ herramienta: 'cambiar_textos_web', argumentos: { textos: [{ seccion: 'ajustes/empresa', campo: 'telefono', valor: '+34 600 000 001' }, { seccion: 'ajustes/empresa', campo: 'nombre', valor: 'Viveros Baltaretu' }] } }, 'Pulsa «Sí».'),
    ]);
    expect(t.propuestas[0].resumen).toContain('2 textos');
    expect(await responderPropuesta(c, t.propuestas[0].id, true)).toMatchObject({ ok: true });
    expect((await repos.contenido.obtener('ajustes', 'empresa'))?.borrador.datos.telefono).toBe('+34 600 000 001');
  });

  it('las fotos del chat van cada una a su planta solo con «Sí»; con «No» se borran', async () => {
    const u = usuario('fotos@example.com');
    const c = ctx(u);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1]);
    const antes = (id: string) => repos.contenido.obtener('catalogo', id).then((e) => ((e?.borrador.datos.fotos as unknown[]) ?? []).length);
    const [palmito, yuca] = [await antes('chamaerops-humilis'), await antes('yucca-elephantipes')];

    expect(await enviarFotos(c, [{ bytes: jpg, planta: 'chamaerops-humilis' }, { bytes: jpg, planta: 'yucca-elephantipes' }])).toMatchObject({ ok: true });
    const conversacion = await repos.conversaciones.actual(u.email);
    const [, respuesta] = (await repos.conversaciones.mensajes(conversacion, 10)).slice(-2);
    const [p] = await repos.conversaciones.propuestas(respuesta.propuestas);
    expect(p.resumen).toBe('Añadir 2 fotos: 1 a Palmito, 1 a Yuca. Saldrán en la web al publicar.');
    expect(await antes('chamaerops-humilis')).toBe(palmito);
    expect(await responderPropuesta(c, p.id, true)).toMatchObject({ ok: true });
    expect(await antes('chamaerops-humilis')).toBe(palmito + 1);
    expect(await antes('yucca-elephantipes')).toBe(yuca + 1);

    await enviarFotos(c, [{ bytes: jpg, planta: 'chamaerops-humilis' }]);
    const [, otra] = (await repos.conversaciones.mensajes(conversacion, 10)).slice(-2);
    const [q] = await repos.conversaciones.propuestas(otra.propuestas);
    expect(await responderPropuesta(c, q.id, false)).toMatchObject({ ok: true });
    expect(await repos.fotos.obtener((q.argumentos.fotos as { ruta: string }[])[0].ruta)).toBeNull();
    expect(await antes('chamaerops-humilis')).toBe(palmito + 1);

    // Ni archivos que no son fotos ni fotos sin planta; el editor no puede si no tiene permiso.
    expect(await enviarFotos(c, [{ bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]), planta: 'chamaerops-humilis' }])).toMatchObject({ ok: false });
    expect(await enviarFotos(c, [{ bytes: jpg, planta: '' }])).toMatchObject({ ok: false });
  });

  it('el uso de hoy cuenta los mensajes de la persona y el cupo de IA', async () => {
    const ahora = new Date(`${new Date().toISOString().slice(0, 10)}T10:00:00Z`);
    await repos.usoAsistente.sumar('uso@example.com', ahora.toISOString().slice(0, 10), 3);
    const u = await usoDeHoy(repos, 'uso@example.com', ahora);
    expect(u).toMatchObject({ mensajes: 3, limiteMensajes: LIMITE_MENSAJES_PERSONA, limiteNeuronas: LIMITE_NEURONAS_DIA });
    expect(u.renueva).toMatch(/^0[12]:00$/);
    expect(u.neuronas).toBeGreaterThan(0);
  });

  it('las conversaciones anteriores se pueden volver a abrir y borrar', async () => {
    const u = usuario('historial@example.com');
    const c = ctx(u);
    const r = repos.conversaciones;
    await conversar(c, 'hola', [modelo(null, 'Hola.')]);
    const primera = await r.actual(u.email);
    const segunda = await r.nueva(u.email);
    expect(segunda).not.toBe(primera);
    expect(await r.actual(u.email)).toBe(segunda);
    // Una conversación vacía no se duplica ni sale en la lista.
    expect(await r.nueva(u.email)).toBe(segunda);
    expect((await r.listar(u.email)).map((x) => x.id)).toEqual([primera]);
    expect((await r.listar(u.email))[0]).toMatchObject({ titulo: 'hola', mensajes: 2 });

    expect(await r.abrir(u.email, primera)).toBe(true);
    expect(await r.actual(u.email)).toBe(primera);
    expect(await r.abrir('otra@example.com', primera)).toBe(false);

    expect(await borrarConversacion(ctx(usuario('otra@example.com')), primera)).toBe(false);
    expect(await borrarConversacion(c, primera)).toBe(true);
    expect(await r.listar(u.email)).toEqual([]);
    expect(await r.mensajes(primera)).toEqual([]);
  });

  it('solo se mandan al modelo las herramientas del tema (menos cupo de IA)', () => {
    const todas = herramientasDe('propietario');
    const nombres = (t: string) => herramientasPara(todas, t).map((h) => h.nombre);
    expect(nombres('sube un 5 % las palmeras')).toEqual(expect.arrayContaining(['resumen_vivero', 'cambiar_plantas']));
    expect(nombres('sube un 5 % las palmeras')).not.toContain('ver_facturas');
    expect(nombres('marca como cobradas las facturas vencidas')).toContain('gestionar_facturas');
    expect(nombres('hola')).toHaveLength(todas.length);
  });

  it('acciones rápidas de plantas: revisada, disponibilidad y quitar, con la validación del panel', async () => {
    const autor = { email: 'rapida@example.com' };
    expect(await accionRapida(repos, ['chamaerops-humilis', 'yucca-elephantipes'], 'agotado', autor)).toEqual({ hechas: 2, errores: [] });
    expect((await repos.contenido.obtener('catalogo', 'yucca-elephantipes'))?.borrador.datos.disponibilidad).toBe('agotado');
    await accionRapida(repos, ['chamaerops-humilis'], 'revisar', autor);
    expect((await repos.contenido.obtener('catalogo', 'chamaerops-humilis'))?.borrador.datos.revisado).toBe(true);
    await accionRapida(repos, ['chamaerops-humilis'], 'quitar', autor);
    expect((await repos.contenido.obtener('catalogo', 'chamaerops-humilis'))?.archivada).toBe(true);
    await accionRapida(repos, ['chamaerops-humilis'], 'recuperar', autor);
  });

  it('una llamada escrita como texto se ejecuta igual y nunca se enseña', async () => {
    const u = usuario('texto@example.com');
    const markup = '<tool_call>guardar_cliente<arg_key>nombre</arg_key><arg_value>Cliente Texto</arg_value><arg_key>codigoPostal</arg_key><arg_value>46000</arg_value><arg_key>poblacion</arg_key><arg_value>Valencia</arg_value></tool_call>';
    const r = await conversar(ctx(u), 'crea el cliente', [modelo(null, markup)]);
    expect(r.propuestas).toHaveLength(1);
    expect(r.propuestas[0].resumen).toContain('Cliente Texto');
    expect(r.texto).not.toContain('<');
  });

  it('«sí» escrito aplica lo pendiente; sin propuesta nunca se pide pulsar «Sí»', async () => {
    const u = usuario('escrito@example.com');
    const c = ctx(u);
    const r = await conversar(c, 'pon la yuca a 23', [modelo({ herramienta: 'cambiar_planta', argumentos: { planta: 'yuca', cambios: { precioDesde: 23 } } }, 'Pulsa «Sí».')]);
    expect(r.propuestas).toHaveLength(1);
    const si = await conversar(c, 'Si', [modelo(null, 'no debería usarse')]);
    expect(si.modelo).toBe('confirmación');
    expect((await repos.contenido.obtener('catalogo', 'yucca-elephantipes'))?.borrador.datos.precioDesde).toBe(23);
    expect((await conversar(c, 'sí', [modelo(null, 'no debería usarse')])).texto).toContain('No hay nada pendiente');

    const mentira = await conversar(c, 'márcalas todas', [modelo(null, 'He preparado la propuesta. Pulsa **Sí** para aplicar.')]);
    expect(mentira.texto).toContain('No he llegado a preparar el cambio');
  });

  it('se pueden elegir las plantas sin fotos', async () => {
    const r = await conversar(ctx(usuario('sinfotos@example.com')), 'revisa las que no tienen foto', [
      modelo({ herramienta: 'cambiar_plantas', argumentos: { seleccion: { sinFotos: true }, cambios: { revisado: true } } }, 'Pulsa «Sí».'),
    ]);
    expect(r.propuestas).toHaveLength(1);
    expect(r.propuestas[0].resumen).not.toContain('Palmera canaria');
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
