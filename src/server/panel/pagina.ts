import type { SesionPanel } from './acceso.ts';
import { puede, type Accion } from './permisos.ts';

export type SesionOk = Extract<SesionPanel, { estado: 'ok' }>;

/** Sesión válida con permiso para `accion`, o `null` (la página muestra el aviso). */
export function sesionCon(locals: App.Locals, accion?: Accion): SesionOk | null {
  const s = locals.panel;
  if (!s || s.estado !== 'ok') return null;
  return !accion || puede(s.usuario.rol, accion) ? s : null;
}

/** Campo de texto de un formulario, recortado. */
export const campo = (form: FormData, nombre: string) => String(form.get(nombre) ?? '').trim();
