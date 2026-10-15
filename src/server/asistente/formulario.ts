import type { Accion, TipoAccion } from './acciones.ts';
import { TIPOS_ACCION } from './acciones.ts';
import { numero } from '../panel/plantas.ts';

/** Botones del asistente guiado, en español llano. */
export const OPCIONES_GUIADO: { tipo: TipoAccion; texto: string }[] = [
  { tipo: 'cambiar_precio', texto: 'Cambiar un precio' },
  { tipo: 'cambiar_disponibilidad', texto: 'Cambiar si hay o no hay' },
  { tipo: 'cambiar_precio_unidad', texto: 'Cambiar el precio por unidad' },
  { tipo: 'quitar_planta', texto: 'Quitar una planta de la web' },
  { tipo: 'contar_presupuestos', texto: '¿Cuántos presupuestos nuevos hay?' },
];

/** Lee la acción del formulario del asistente. El valor se interpreta según el tipo. */
export function accionDesdeFormulario(form: FormData): Accion | null {
  const tipo = String(form.get('tipo') ?? '');
  if (!TIPOS_ACCION.includes(tipo as TipoAccion)) return null;
  const accion: Accion = { tipo: tipo as TipoAccion };
  const planta = String(form.get('planta') ?? '').trim();
  if (planta) accion.planta = planta.slice(0, 100);
  const valor = form.get('valor');
  if (form.get('sinPrecio') === '1') accion.valor = null;
  else if (typeof valor === 'string' && valor.trim()) {
    accion.valor = tipo === 'cambiar_disponibilidad' ? valor.trim() : (numero(valor) ?? undefined);
  }
  return accion;
}
