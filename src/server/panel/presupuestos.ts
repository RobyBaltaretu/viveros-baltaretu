import type { SolicitudPresupuesto } from '../../lib/presupuesto/esquema';
import type { Presupuesto } from '../data/tipos.ts';

/** Petición de la web → presupuesto guardado para la bandeja del panel. */
export function presupuestoDesde(
  s: SolicitudPresupuesto,
  especies: ReadonlyMap<string, { nombre: string }>,
  ahora = new Date(),
  id: string = crypto.randomUUID(),
): Presupuesto {
  return {
    id,
    fecha: ahora.toISOString(),
    estado: 'nuevo',
    idioma: s.idioma,
    tipoPedido: s.tipoPedido,
    nombre: s.nombre,
    email: s.email,
    telefono: s.telefono ?? '',
    empresa: s.empresa ?? '',
    provincia: s.provincia ?? '',
    mensaje: s.mensaje ?? '',
    lineas: s.lineas.map((l) => ({ especie: l.slug, nombre: especies.get(l.slug)?.nombre ?? l.slug, cantidad: l.cantidad })),
  };
}
