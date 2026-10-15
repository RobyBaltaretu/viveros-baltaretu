import type { Repositorios, Usuario } from '../data/tipos.ts';
import type { DatosPlanta } from '../panel/plantas.ts';
import { prepararAccion, type Preparada } from './acciones.ts';
import { crearInterpreteWorkersAI, interpretarConRespaldo, interpreteLocal, MAXIMO_TEXTO, type BindingAI, type Interprete } from './interprete.ts';

/**
 * Un mensaje escrito al asistente: límite diario del modelo, interpretación con
 * respaldo, y preparación de la acción (que luego se confirma con Sí/No).
 */
// ~37 neuronas por mensaje: 60 al día por persona y 3 personas quedan por debajo de las 10.000 gratuitas.
export const LIMITE_DIARIO_MODELO = 60;

export const MENSAJE_FUERA_DE_TEMA = 'Solo puedo ayudarte con el panel y el vivero: precios, si hay o no hay plantas, quitarlas de la web y los presupuestos.';
export const MENSAJE_NO_ENTIENDO = 'No lo he entendido. Prueba a decirlo de otra forma, por ejemplo «sube la yuca a 12», o usa los botones de abajo.';
export const AVISO_LIMITE = 'Hoy ya has usado mucho el asistente: sigo con lo básico hasta mañana. Los botones funcionan igual.';

export const diaDe = (fecha = new Date()) => fecha.toISOString().slice(0, 10);

export async function atenderMensaje(
  repos: Repositorios,
  usuario: Usuario,
  texto: string,
  opciones: { ai?: BindingAI; ahora?: Date; crearModelo?: (ai: BindingAI) => Interprete } = {},
): Promise<{ paso: Preparada; aviso?: string; interprete: string }> {
  const mensaje = texto.trim().slice(0, MAXIMO_TEXTO);
  if (!mensaje) return { paso: { estado: 'no-puedo', texto: MENSAJE_NO_ENTIENDO }, interprete: 'ninguno' };

  const interpretes: Interprete[] = [];
  let aviso: string | undefined;
  if (opciones.ai) {
    const usos = await repos.usoAsistente.sumar(usuario.email, diaDe(opciones.ahora));
    if (usos <= LIMITE_DIARIO_MODELO) interpretes.push((opciones.crearModelo ?? crearInterpreteWorkersAI)(opciones.ai));
    else aviso = AVISO_LIMITE;
  }
  interpretes.push(interpreteLocal);

  const plantas = (await repos.contenido.listar('catalogo')).map((e) => String((e.borrador.datos as DatosPlanta).nombre?.es ?? e.id));
  const i = await interpretarConRespaldo(interpretes, mensaje, { plantas });
  const paso: Preparada =
    i.tipo === 'accion'
      ? await prepararAccion(repos, usuario.rol, i.accion)
      : { estado: 'no-puedo', texto: i.tipo === 'fuera-de-tema' ? MENSAJE_FUERA_DE_TEMA : MENSAJE_NO_ENTIENDO };
  return { paso, aviso, interprete: i.interprete };
}
