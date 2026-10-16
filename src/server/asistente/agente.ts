import { generateText, isStepCount, jsonSchema, tool, type LanguageModel, type ModelMessage, type ToolSet } from 'ai';
import { z } from 'astro/zod';
import type { MensajeAsistente, Propuesta } from '../data/tipos.ts';
import { puede } from '../panel/permisos.ts';
import { aplicarAccion, type Accion as AccionBasica } from './acciones.ts';
import { atenderMensaje } from './conversacion.ts';
import { aplicarFotos, descartarFotos, HERRAMIENTA_FOTOS, prepararFotos } from './fotos.ts';
import { herramienta, herramientasDe, herramientasPara, type Cambio, type Consulta, type Contexto } from './herramientas.ts';
import { instruccionesDe } from './instrucciones.ts';
import { argumentosValidos, llamadasEnTexto, sinLlamadas, tieneLlamadas } from './llamadas.ts';
import { MAXIMO_TEXTO, type BindingAI } from './interprete.ts';

/**
 * El asistente completo: un modelo de lenguaje con las herramientas de
 * `herramientas.ts`. Consulta lo que necesita y, para cambiar algo, deja una
 * propuesta que la persona confirma con «Sí». Si no hay modelo (cupo gratuito
 * agotado, servicio caído o sin configurar), sigue con las reglas locales de
 * siempre, que entienden lo más habitual.
 */
export interface ModeloAsistente {
  nombre: string;
  modelo: LanguageModel;
  /** Neuronas de Workers AI por millón de tokens (0 si no cuenta para el cupo). */
  neuronas: { entrada: number; salida: number };
}

/** Cupo diario compartido del asistente (de las 10.000 neuronas gratuitas; el resto, para leer tickets). */
export const LIMITE_NEURONAS_DIA = 7000;
/** Mensajes por persona y día. */
export const LIMITE_MENSAJES_PERSONA = 80;
/** Mensajes anteriores que ve el modelo. */
const MEMORIA = 12;
/** Pasos de herramientas por mensaje. */
const PASOS = 10;

export const CLAVE_NEURONAS = '__neuronas__';

export type Respuesta = { texto: string; propuestas: Propuesta[]; modelo: string };

const dia = (ahora = new Date()) => ahora.toISOString().slice(0, 10);

export interface UsoDeHoy {
  mensajes: number;
  limiteMensajes: number;
  neuronas: number;
  limiteNeuronas: number;
  /** Hora (de España) a la que se renueva el cupo: medianoche UTC. */
  renueva: string;
}

/** Lo gastado hoy: mensajes de la persona y cupo de IA del vivero (compartido). */
export async function usoDeHoy(repos: Contexto['repos'], email: string, ahora = new Date()): Promise<UsoDeHoy> {
  const [mensajes, neuronas] = await Promise.all([repos.usoAsistente.obtener(email, dia(ahora)), repos.usoAsistente.obtener(CLAVE_NEURONAS, dia(ahora))]);
  const manana = new Date(`${dia(ahora)}T00:00:00Z`);
  manana.setUTCDate(manana.getUTCDate() + 1);
  const renueva = manana.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  return { mensajes, limiteMensajes: LIMITE_MENSAJES_PERSONA, neuronas: Math.min(neuronas, LIMITE_NEURONAS_DIA), limiteNeuronas: LIMITE_NEURONAS_DIA, renueva };
}

/** Borra una conversación de la persona; las fotos que esperaban un «Sí» se borran también. */
export async function borrarConversacion(ctx: Contexto, id: string): Promise<boolean> {
  const { repos, usuario } = ctx;
  if (!(await repos.conversaciones.listar(usuario.email, 500)).some((c) => c.id === id)) return false;
  const ids = (await repos.conversaciones.mensajes(id, 1000)).flatMap((m) => m.propuestas);
  for (const p of await repos.conversaciones.propuestas([...new Set(ids)])) if (p.herramienta === HERRAMIENTA_FOTOS && p.estado === 'pendiente') await descartarFotos(repos, p);
  return repos.conversaciones.borrar(usuario.email, id);
}

/** Fotos enviadas en el chat: quedan como propuesta (no gastan IA). */
export async function enviarFotos(ctx: Contexto, archivos: { bytes: Uint8Array; planta: string }[]): Promise<{ ok: boolean; texto: string }> {
  const { repos, usuario } = ctx;
  const conversacion = await repos.conversaciones.actual(usuario.email);
  const r = await prepararFotos(repos, usuario, conversacion, archivos);
  await repos.conversaciones.anadir({ conversacion, rol: 'usuario', texto: `${archivos.length === 1 ? 'Te envío 1 foto' : `Te envío ${archivos.length} fotos`}.`, propuestas: r.ok ? [r.propuesta.id] : [] });
  const texto = r.ok ? 'Revisa que cada foto va con su planta y pulsa «Sí» para añadirlas.' : `No he podido guardar las fotos: ${r.error}`;
  await repos.conversaciones.anadir({ conversacion, rol: 'asistente', texto, propuestas: r.ok ? [r.propuesta.id] : [] });
  return { ok: r.ok, texto };
}

/** Historial como mensajes para el modelo: solo texto; las propuestas, con su estado. */
function historial(mensajes: MensajeAsistente[], propuestas: Map<string, Propuesta>): ModelMessage[] {
  return mensajes.map((m) => {
    const extra = m.propuestas
      .map((id) => propuestas.get(id))
      .filter((p): p is Propuesta => !!p)
      .map((p) => `\n[Propuesta «${p.resumen}»: ${p.estado === 'pendiente' ? 'esperando que diga Sí o No' : p.estado}${p.resultado ? ` — ${p.resultado}` : ''}]`)
      .join('');
    return { role: m.rol === 'usuario' ? 'user' : 'assistant', content: `${m.texto}${extra}` };
  });
}

/**
 * Esquemas JSON de las herramientas, calculados una vez por proceso: convertirlos
 * en cada mensaje costaba unos 10 ms de CPU, el límite por petición del plan gratuito.
 */
const ESQUEMAS = new Map<string, ReturnType<typeof jsonSchema>>();
const esquemaDe = (nombre: string, esquema: z.ZodType) => {
  let e = ESQUEMAS.get(nombre);
  if (!e) ESQUEMAS.set(nombre, (e = jsonSchema(z.toJSONSchema(esquema, { io: 'input', unrepresentable: 'any' }) as never)));
  return e;
};

/** Herramientas del rol para el modelo. Las de cambio solo dejan propuestas. */
function herramientasModelo(ctx: Contexto, conversacion: string, propuestas: Propuesta[], tema: string): ToolSet {
  const conjunto: ToolSet = {};
  for (const h of herramientasPara(herramientasDe(ctx.usuario.rol), tema)) {
    conjunto[h.nombre] = tool({
      description: h.descripcion,
      inputSchema: esquemaDe(h.nombre, h.esquema),
      async execute(entrada: unknown) {
        // La validación con zod (barata) se hace aquí: el esquema JSON solo informa al modelo.
        const leido = h.esquema.safeParse(entrada);
        if (!leido.success) return { error: `Datos no válidos: ${leido.error.issues.map((i) => `${i.path.join('.') || 'datos'}: ${i.message}`).join('; ').slice(0, 300)}` };
        const args: unknown = leido.data;
        try {
          if (h.tipo === 'consulta') return { datos: await (h as Consulta<unknown>).consultar(ctx, args) };
          const p = await (h as Cambio<unknown>).preparar(ctx, args);
          if (!p.ok) return { error: p.error };
          const propuesta: Propuesta = {
            id: crypto.randomUUID(),
            conversacion,
            email: ctx.usuario.email,
            herramienta: h.nombre,
            argumentos: p.argumentos as Record<string, unknown>,
            resumen: p.resumen,
            estado: 'pendiente',
            resultado: '',
            creada: new Date().toISOString(),
          };
          await ctx.repos.conversaciones.guardarPropuesta(propuesta);
          propuestas.push(propuesta);
          return { estado: 'Propuesta preparada. La persona verá un botón «Sí» para aplicarla: no está hecho todavía.', resumen: p.resumen };
        } catch (error) {
          return { error: `No se ha podido: ${String(error).slice(0, 200)}` };
        }
      },
    });
  }
  return conjunto;
}

/** Respaldo sin modelo: las reglas locales del asistente básico. */
async function respaldoLocal(ctx: Contexto, conversacion: string, texto: string, aviso: string): Promise<Respuesta> {
  const r = await atenderMensaje(ctx.repos, ctx.usuario, texto);
  const propuestas: Propuesta[] = [];
  let respuesta: string;
  if (r.paso.estado === 'lista') {
    const p: Propuesta = {
      id: crypto.randomUUID(),
      conversacion,
      email: ctx.usuario.email,
      herramienta: '__basica',
      argumentos: r.paso.accion as unknown as Record<string, unknown>,
      resumen: r.paso.resumen,
      estado: 'pendiente',
      resultado: '',
      creada: new Date().toISOString(),
    };
    await ctx.repos.conversaciones.guardarPropuesta(p);
    propuestas.push(p);
    respuesta = '¿Lo hago? Pulsa «Sí» para aplicarlo.';
  } else if (r.paso.estado === 'falta' || r.paso.estado === 'elegir-planta') {
    respuesta = `${r.paso.pregunta}${r.paso.estado === 'elegir-planta' ? ` ${r.paso.opciones.map((o) => o.nombre).join(', ')}.` : ''}`;
  } else respuesta = r.paso.texto;
  return { texto: aviso ? `${aviso}\n\n${respuesta}` : respuesta, propuestas, modelo: 'reglas locales' };
}

export const AVISO_SIN_MODELO = 'Ahora mismo trabajo en modo básico (sin inteligencia artificial): entiendo cambios de precio, disponibilidad, quitar plantas y contar presupuestos.';
export const AVISO_CUPO = 'Hoy se ha agotado el cupo gratuito de inteligencia artificial: hasta mañana trabajo en modo básico (precios, disponibilidad, quitar plantas y presupuestos).';

/** Atiende un mensaje: lo guarda, piensa con el modelo (o el respaldo) y guarda la respuesta. */
export async function conversar(ctx: Contexto, texto: string, modelos: ModeloAsistente[], ahora = new Date()): Promise<Respuesta> {
  const { repos, usuario } = ctx;
  const mensaje = texto.trim().slice(0, MAXIMO_TEXTO);
  const conversacion = await repos.conversaciones.actual(usuario.email);
  const previos = await repos.conversaciones.mensajes(conversacion, MEMORIA);
  await repos.conversaciones.anadir({ conversacion, rol: 'usuario', texto: mensaje, propuestas: [] });

  // «Sí» o «No» escritos con propuestas esperando: es lo mismo que pulsar el botón (sin gastar IA).
  const ids = previos.flatMap((m) => m.propuestas);
  const conocidas = new Map((await repos.conversaciones.propuestas(ids)).map((p) => [p.id, p]));
  const confirmacion = /^(s[ií]+|vale|ok|okay|de acuerdo|hazlo|adelante|confirmo|confirmado|aplica(lo)?|dale|perfecto)(?![a-zñáéíóú])[\s,.!¡]*(hazlo|por favor|adelante|aplicalo|aplícalo)?[\s.!]*$/i.test(mensaje)
    ? 'si'
    : /^(no|cancela(lo)?|d[eé]jalo|mejor no)(?![a-zñáéíóú])[\s,.!]*$/i.test(mensaje)
      ? 'no'
      : null;
  if (confirmacion) {
    const pendientes = [...conocidas.values()].filter((p) => p.estado === 'pendiente');
    if (pendientes.length) {
      const resultados = [];
      for (const p of pendientes) resultados.push(await responderPropuesta(ctx, p.id, confirmacion === 'si'));
      return { texto: resultados.map((r) => r.texto).join(' '), propuestas: [], modelo: 'confirmación' };
    }
    if (confirmacion === 'si') {
      const texto = 'No hay nada pendiente de confirmar: no he preparado ningún cambio. Dime qué quieres cambiar y te lo preparo con su botón «Sí».';
      await repos.conversaciones.anadir({ conversacion, rol: 'asistente', texto, propuestas: [] });
      return { texto, propuestas: [], modelo: 'confirmación' };
    }
  }

  let respuesta: Respuesta | null = null;
  const usadas = await repos.usoAsistente.obtener(CLAVE_NEURONAS, dia(ahora));
  const mios = await repos.usoAsistente.sumar(usuario.email, dia(ahora));
  const conCupo = usadas < LIMITE_NEURONAS_DIA && mios <= LIMITE_MENSAJES_PERSONA;

  if (modelos.length && conCupo) {
    for (const m of modelos) {
      const propuestas: Propuesta[] = [];
      try {
        const herramientas = herramientasModelo(ctx, conversacion, propuestas, [...previos.slice(-3).map((x) => x.texto), mensaje].join(' '));
        const mensajes: ModelMessage[] = [...historial(previos, conocidas), { role: 'user', content: mensaje }];
        const pedir = (lista: ModelMessage[]) =>
          generateText({ model: m.modelo, system: instruccionesDe(ctx), messages: lista, tools: herramientas, stopWhen: isStepCount(PASOS), temperature: 0.2, maxOutputTokens: 1600 });
        let r = await pedir(mensajes);
        let gastadas = r.totalUsage;
        let texto = r.text;
        // Llamadas escritas como texto: se ejecutan igual; si eran consultas, el modelo responde con sus datos.
        if (tieneLlamadas(texto)) {
          const llamadas = llamadasEnTexto(texto).filter((l) => herramientas[l.nombre]);
          const resultados: { llamada: (typeof llamadas)[number]; id: string; salida: unknown }[] = [];
          for (const [i, l] of llamadas.entries()) {
            const h = herramienta(l.nombre)!;
            const salida = await herramientas[l.nombre].execute!(argumentosValidos(h.esquema, l), { toolCallId: `texto-${i}`, messages: [] } as never);
            resultados.push({ llamada: l, id: `texto-${i}`, salida });
          }
          const consultas = resultados.filter((x) => herramienta(x.llamada.nombre)?.tipo === 'consulta');
          if (consultas.length) {
            r = await pedir([
              ...mensajes,
              { role: 'assistant', content: consultas.map((x) => ({ type: 'tool-call' as const, toolCallId: x.id, toolName: x.llamada.nombre, input: x.llamada.argumentos })) },
              { role: 'tool', content: consultas.map((x) => ({ type: 'tool-result' as const, toolCallId: x.id, toolName: x.llamada.nombre, output: { type: 'json' as const, value: x.salida as never } })) },
            ]);
            gastadas = { ...gastadas, inputTokens: (gastadas.inputTokens ?? 0) + (r.totalUsage.inputTokens ?? 0), outputTokens: (gastadas.outputTokens ?? 0) + (r.totalUsage.outputTokens ?? 0) };
            texto = r.text;
          } else {
            const errores = resultados.map((x) => (x.salida as { error?: string })?.error).filter(Boolean);
            texto = errores.length ? `No he podido prepararlo: ${errores.join(' ')}` : '';
          }
        }
        const neuronas = Math.ceil(((gastadas.inputTokens ?? 0) * m.neuronas.entrada + (gastadas.outputTokens ?? 0) * m.neuronas.salida) / 1_000_000);
        if (neuronas) await repos.usoAsistente.sumar(CLAVE_NEURONAS, dia(ahora), neuronas);
        let final = sinLlamadas(texto) || (propuestas.length ? '¿Lo hago? Pulsa «Sí» para aplicarlo.' : '');
        // Nunca se pide pulsar «Sí» si no hay nada que confirmar.
        if (!propuestas.length && /puls[ae][^.]{0,12}s[ií]|propuesta preparada|he preparado la propuesta|bot[oó]n «?s[ií]/i.test(final))
          final = 'No he llegado a preparar el cambio, así que no hay nada que confirmar. ¿Me lo dices de otra forma, con las plantas o los datos concretos?';
        if (!final) throw new Error('respuesta vacía');
        respuesta = { texto: final, propuestas, modelo: m.nombre };
        break;
      } catch {
        // Las propuestas de un intento fallido no se enseñan; se prueba el siguiente modelo.
        for (const p of propuestas) await repos.conversaciones.anotar(p.id, 'fallida', 'El asistente no terminó la respuesta.');
      }
    }
  }
  respuesta ??= await respaldoLocal(ctx, conversacion, mensaje, !modelos.length ? AVISO_SIN_MODELO : conCupo ? AVISO_SIN_MODELO : AVISO_CUPO);
  await repos.conversaciones.anadir({ conversacion, rol: 'asistente', texto: respuesta.texto, propuestas: respuesta.propuestas.map((p) => p.id) });
  return respuesta;
}

/**
 * «Sí» o «No» a una propuesta. Con «Sí» se vuelve a comprobar todo (permiso y
 * validación) con los datos de ese momento antes de aplicar; nunca dos veces.
 */
export async function responderPropuesta(ctx: Contexto, id: string, si: boolean): Promise<{ ok: boolean; texto: string }> {
  const { repos, usuario } = ctx;
  const p = await repos.conversaciones.propuesta(id);
  if (!p || p.email !== usuario.email) return { ok: false, texto: 'No encuentro esa propuesta.' };
  if (p.estado !== 'pendiente') return { ok: false, texto: 'Esa propuesta ya estaba resuelta.' };
  let resultado: { ok: boolean; texto: string };
  if (!si) {
    if (!(await repos.conversaciones.resolver(id, 'rechazada', 'Sin cambios.'))) return { ok: false, texto: 'Esa propuesta ya estaba resuelta.' };
    if (p.herramienta === HERRAMIENTA_FOTOS) await descartarFotos(repos, p);
    resultado = { ok: true, texto: p.herramienta === HERRAMIENTA_FOTOS ? 'Vale, no he añadido las fotos.' : 'Vale, no he cambiado nada.' };
  } else if (!(await repos.conversaciones.resolver(id, 'aplicada', 'Aplicando…'))) {
    return { ok: false, texto: 'Esa propuesta ya estaba resuelta.' };
  } else if (p.herramienta === HERRAMIENTA_FOTOS) {
    resultado = await aplicarFotos(repos, usuario, p);
  } else if (p.herramienta === '__basica') {
    resultado = await aplicarAccion(repos, usuario.rol, usuario.email, p.argumentos as unknown as AccionBasica);
  } else {
    const h = herramienta(p.herramienta);
    if (!h || h.tipo !== 'cambio') resultado = { ok: false, texto: 'Esa acción ya no existe.' };
    else {
      const cambio = h as Cambio<unknown>;
      if (!puede(usuario.rol, cambio.permiso)) resultado = { ok: false, texto: 'Tu usuario no puede hacer eso.' };
      else {
        const otraVez = await cambio.preparar(ctx, p.argumentos);
        resultado = otraVez.ok ? await cambio.aplicar(ctx, otraVez.argumentos) : { ok: false, texto: otraVez.error };
      }
    }
  }
  if (si) await repos.conversaciones.anotar(id, resultado.ok ? 'aplicada' : 'fallida', resultado.texto);
  if (si && resultado.ok) await repos.auditoria.registrar(usuario.email, 'asistente', `${p.herramienta}: ${p.resumen}`.slice(0, 300));
  await repos.conversaciones.anadir({ conversacion: p.conversacion, rol: 'asistente', texto: resultado.ok ? (si ? `Hecho. ${resultado.texto}` : resultado.texto) : `No se ha podido: ${resultado.texto}`, propuestas: [] });
  return resultado;
}

/** Modelos del entorno, en orden de preferencia (ver decisiones.md, punto 34). */
export async function modelosDe(env: { AI?: BindingAI; GROQ_API_KEY?: string }): Promise<ModeloAsistente[]> {
  const modelos: ModeloAsistente[] = [];
  if (env.AI) {
    const { createWorkersAI } = await import('workers-ai-provider');
    const workersai = createWorkersAI({ binding: env.AI as never });
    modelos.push(
      { nombre: 'glm-4.7-flash', modelo: workersai('@cf/zai-org/glm-4.7-flash', { reasoning_effort: null, chat_template_kwargs: { enable_thinking: false } } as never), neuronas: { entrada: 5500, salida: 36400 } },
      { nombre: 'gemma-4-26b', modelo: workersai('@cf/google/gemma-4-26b-a4b-it' as never), neuronas: { entrada: 9091, salida: 27273 } },
    );
  }
  if (env.GROQ_API_KEY) {
    const { createGroq } = await import('@ai-sdk/groq');
    modelos.push({ nombre: 'groq gpt-oss-120b', modelo: createGroq({ apiKey: env.GROQ_API_KEY })('openai/gpt-oss-120b'), neuronas: { entrada: 0, salida: 0 } });
  }
  return modelos;
}
