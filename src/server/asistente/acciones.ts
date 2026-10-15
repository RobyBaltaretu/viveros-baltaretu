import { disponibilidades } from '../../i18n/ui';
import { formatearImporte } from '../../lib/catalogo/formato';
import type { Repositorios, Rol } from '../data/tipos.ts';
import { puede } from '../panel/permisos.ts';
import { DISPONIBILIDADES, guardarPlanta, seoPorDefecto, type DatosPlanta } from '../panel/plantas.ts';
import { buscarPlanta, type Candidato } from './coincidencia.ts';

/**
 * Lista cerrada de acciones del asistente. Es lo único que puede hacer, tanto
 * en el modo guiado como con lenguaje natural, y siempre pasa por la misma
 * validación que el panel (guardarPlanta). Los cambios van a borrador.
 */
export const TIPOS_ACCION = ['cambiar_precio', 'cambiar_precio_unidad', 'cambiar_disponibilidad', 'quitar_planta', 'contar_presupuestos'] as const;
export type TipoAccion = (typeof TIPOS_ACCION)[number];

export interface Accion {
  tipo: TipoAccion;
  /** Nombre o identificador de la planta, tal como lo dijo la persona. */
  planta?: string;
  /** Precio en euros (null = "bajo presupuesto") o estado de disponibilidad. */
  valor?: number | string | null;
}

export type Preparada =
  | { estado: 'lista'; accion: Accion & { planta?: string }; resumen: string; plantaId?: string }
  | { estado: 'elegir-planta'; accion: Accion; opciones: { id: string; nombre: string }[]; pregunta: string }
  | { estado: 'falta'; accion: Accion; pregunta: string }
  | { estado: 'respuesta'; texto: string }
  | { estado: 'no-puedo'; texto: string };

export const PERMISO: Record<TipoAccion, 'editar' | 'presupuestos'> = {
  cambiar_precio: 'editar',
  cambiar_precio_unidad: 'editar',
  cambiar_disponibilidad: 'editar',
  quitar_planta: 'editar',
  contar_presupuestos: 'presupuestos',
};

const euros = (n: number | null | undefined) => (n == null ? 'precio bajo presupuesto' : formatearImporte(n, 'es'));

interface Planta extends Candidato {
  nombre: string;
  datos: DatosPlanta;
}

async function plantas(repos: Repositorios): Promise<Planta[]> {
  return (await repos.contenido.listar('catalogo')).map((e) => {
    const d = e.borrador.datos as DatosPlanta;
    return { id: e.id, nombre: String(d.nombre?.es ?? e.id), nombres: [d.nombre?.es, d.nombre?.en, d.nombreCientifico, e.id.replace(/-/g, ' ')].filter(Boolean) as string[], datos: d };
  });
}

/**
 * Comprueba la acción y prepara el resumen para la confirmación Sí/No, sin
 * cambiar nada. Si falta un dato o la planta es dudosa, devuelve la pregunta.
 */
export async function prepararAccion(repos: Repositorios, rol: Rol, accion: Accion): Promise<Preparada> {
  if (!TIPOS_ACCION.includes(accion.tipo)) return { estado: 'no-puedo', texto: 'Eso no lo sé hacer. Puedo cambiar precios, decir si hay o no hay una planta, quitarla de la web o contarte los presupuestos nuevos.' };
  if (!puede(rol, PERMISO[accion.tipo])) return { estado: 'no-puedo', texto: 'Tu usuario no puede hacer eso. Pídeselo al propietario.' };

  if (accion.tipo === 'contar_presupuestos') {
    const n = await repos.presupuestos.contar('nuevo');
    return { estado: 'respuesta', texto: n === 0 ? 'No hay presupuestos nuevos.' : `Hay ${n} ${n === 1 ? 'presupuesto nuevo' : 'presupuestos nuevos'}. Están en «Presupuestos recibidos».` };
  }

  if (!accion.planta) return { estado: 'falta', accion, pregunta: '¿De qué planta?' };
  const lista = await plantas(repos);
  const r = buscarPlanta(accion.planta, lista);
  if (r.tipo === 'ninguna') return { estado: 'falta', accion: { ...accion, planta: undefined }, pregunta: `No encuentro ninguna planta que se llame «${accion.planta}». ¿Cuál es?` };
  if (r.tipo === 'varias') return { estado: 'elegir-planta', accion, opciones: r.opciones.map((p) => ({ id: p.id, nombre: p.nombre })), pregunta: '¿Cuál de estas?' };
  const p = r.elegida;
  const d = p.datos;
  const base = { ...accion, planta: p.id };

  switch (accion.tipo) {
    case 'cambiar_precio':
    case 'cambiar_precio_unidad': {
      const unidad = accion.tipo === 'cambiar_precio_unidad';
      if (accion.valor === undefined) return { estado: 'falta', accion: base, pregunta: unidad ? '¿Cuánto cuesta una planta suelta, en euros?' : '¿Cuál es el precio nuevo, en euros?' };
      const valor = accion.valor === null ? null : Number(accion.valor);
      if (valor !== null && (!Number.isFinite(valor) || valor <= 0 || valor > 100_000)) return { estado: 'falta', accion: base, pregunta: 'No entiendo ese precio. Escríbelo en euros, por ejemplo 18 o 18,50.' };
      if (unidad && !d.ventaUnitaria) return { estado: 'no-puedo', texto: `${p.nombre} no se vende por unidad. Cámbialo antes en «Cambiar el precio» de la planta.` };
      const antes = unidad ? d.precioUnidad : d.precioDesde;
      return {
        estado: 'lista',
        accion: { ...base, valor },
        plantaId: p.id,
        resumen: `Voy a cambiar el precio ${unidad ? 'por unidad ' : ''}de ${p.nombre} de ${euros(antes)} a ${euros(valor)}.`,
      };
    }
    case 'cambiar_disponibilidad': {
      const valor = String(accion.valor ?? '');
      if (!DISPONIBILIDADES.includes(valor as never)) return { estado: 'falta', accion: base, pregunta: '¿Está disponible, bajo pedido o agotada?' };
      const nombreEstado = (v: string) => disponibilidades[v as keyof typeof disponibilidades]?.es.toLowerCase();
      return { estado: 'lista', accion: { ...base, valor }, plantaId: p.id, resumen: `Voy a marcar ${p.nombre} como «${nombreEstado(valor)}» (ahora está «${nombreEstado(String(d.disponibilidad))}»).` };
    }
    case 'quitar_planta':
      return { estado: 'lista', accion: base, plantaId: p.id, resumen: `Voy a quitar ${p.nombre} de la web. Se puede deshacer después.` };
  }
}

/** Aplica una acción confirmada. Se vuelve a preparar: nunca se confía en lo que llega del navegador. */
export async function aplicarAccion(repos: Repositorios, rol: Rol, email: string, accion: Accion): Promise<{ ok: boolean; texto: string }> {
  const p = await prepararAccion(repos, rol, accion);
  if (p.estado !== 'lista' || !p.plantaId) return { ok: false, texto: p.estado === 'no-puedo' || p.estado === 'respuesta' ? p.texto : 'Faltan datos para hacer el cambio.' };
  const autor = { email, origen: 'asistente' as const };
  const entrada = await repos.contenido.obtener('catalogo', p.plantaId);
  if (!entrada) return { ok: false, texto: 'Esa planta ya no está.' };
  const d = structuredClone(entrada.borrador.datos) as DatosPlanta;
  if (p.accion.tipo === 'quitar_planta') {
    await repos.contenido.archivar('catalogo', p.plantaId, true, autor);
  } else {
    if (p.accion.tipo === 'cambiar_precio') d.precioDesde = p.accion.valor as number | null;
    if (p.accion.tipo === 'cambiar_precio_unidad') d.precioUnidad = p.accion.valor as number | null;
    if (p.accion.tipo === 'cambiar_disponibilidad') d.disponibilidad = String(p.accion.valor);
    d.seo = seoPorDefecto(d);
    const r = await guardarPlanta(repos, p.plantaId, d, autor);
    if (!r.ok) return { ok: false, texto: r.errores.map((e) => e.mensaje).join(' ') };
  }
  await repos.auditoria.registrar(email, 'asistente', `${p.accion.tipo} ${p.plantaId}`);
  return { ok: true, texto: 'Hecho. Está guardado como borrador: saldrá en la web cuando publiques los cambios.' };
}
