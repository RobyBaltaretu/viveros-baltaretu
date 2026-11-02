import type { Factura, PresupuestoCliente } from '../data/tipos.ts';

export type EstadoTramo = 'sin-factura' | 'borrador' | 'pendiente' | 'cobrado';

/** Estado comercial y documental por tramo. Evita confundir dinero recibido con factura emitida. */
export function estadoTramo(factura: Factura | null, fechaCobro: string | null): EstadoTramo {
  if (!factura) return 'sin-factura';
  if (factura.estado === 'borrador') return 'borrador';
  return factura.estado === 'cobrada' || fechaCobro ? 'cobrado' : 'pendiente';
}

export function resumenCobros(p: PresupuestoCliente, anticipo: Factura | null, final: Factura | null) {
  return {
    anticipo: { importe: p.totales.anticipo, estado: estadoTramo(anticipo, p.cobroAnticipo), factura: anticipo },
    resto: { importe: p.totales.restante, estado: estadoTramo(final, p.cobroResto), factura: final },
  };
}

export const nombreEstadoTramo: Record<EstadoTramo, string> = {
  'sin-factura': 'Sin factura',
  borrador: 'Factura en borrador',
  pendiente: 'Factura emitida · pendiente de cobro',
  cobrado: 'Cobrado',
};
