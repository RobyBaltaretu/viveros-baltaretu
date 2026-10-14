import type { Rol } from '../data/tipos.ts';

/**
 * Qué puede hacer cada persona en el panel. El propietario, todo; el gerente,
 * todo salvo gestionar personas; el editor solo prepara cambios (no publica ni
 * ve presupuestos). Como máximo hay un editor.
 */
export const ACCIONES = ['editar', 'publicar', 'presupuestos', 'personas', 'asistente'] as const;
export type Accion = (typeof ACCIONES)[number];

const PERMISOS: Record<Rol, readonly Accion[]> = {
  propietario: ACCIONES,
  gerente: ['editar', 'publicar', 'presupuestos', 'asistente'],
  editor: ['editar', 'asistente'],
};

export const puede = (rol: Rol, accion: Accion) => PERMISOS[rol].includes(accion);

export const MAXIMO_EDITORES = 1;
