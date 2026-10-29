import type { EstadoPresupuestoCliente, PresupuestoCliente } from '../../server/data/tipos.ts';
import { dinero } from '../../server/facturas/importes.ts';
import { estadoEfectivo } from '../../server/presupuestos-cliente/presupuestos.ts';

/**
 * Lo siguiente que hay que hacer con un presupuesto, en una frase, y el color
 * de su estado. Lo usan la lista y la ficha del diseño nuevo.
 */
export type Tono = 'gris' | 'azul' | 'verde' | 'naranja' | 'rojo';

const DIA = 86_400_000;
const dias = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / DIA);

export const TONO_ESTADO: Record<EstadoPresupuestoCliente, Tono> = { borrador: 'gris', enviado: 'azul', aceptado: 'verde', rechazado: 'rojo', caducado: 'naranja' };

export interface Paso {
  texto: string;
  /** Hay algo que hacer ya (se destaca). */
  urgente: boolean;
}

export function siguientePaso(p: PresupuestoCliente, hoy: string): Paso {
  const e = estadoEfectivo(p, hoy);
  if (e === 'borrador') return { texto: 'Terminar y enviar', urgente: false };
  if (e === 'enviado') {
    const quedan = p.validez ? dias(hoy, p.validez) : null;
    if (quedan !== null && quedan <= 5) return { texto: quedan <= 0 ? 'Caduca hoy: llamar al cliente' : `Caduca en ${quedan === 1 ? '1 día' : `${quedan} días`}: llamar al cliente`, urgente: true };
    const hace = dias(p.fecha, hoy);
    return { texto: `Esperando respuesta${hace > 0 ? ` · hecho hace ${hace === 1 ? '1 día' : `${hace} días`}` : ''}`, urgente: false };
  }
  if (e === 'caducado') return { texto: 'Caducado: llamar o rehacerlo', urgente: false };
  if (e === 'rechazado') return { texto: '—', urgente: false };
  if (p.totales.anticipo > 0 && !p.facturaAnticipoId) return { texto: `Facturar el anticipo (${dinero(p.totales.anticipo)})`, urgente: true };
  if (p.facturaAnticipoId && !p.cobroAnticipo) return { texto: `Cobrar el anticipo (${dinero(p.totales.anticipo)})`, urgente: true };
  if (!p.facturaId) return { texto: p.facturaAnticipoId ? `Al terminar, factura final (${dinero(p.totales.restante)})` : 'Al terminar, hacer la factura', urgente: false };
  if (!p.cobroResto) return { texto: `Cobrar el resto (${dinero(p.totales.restante)})`, urgente: true };
  return { texto: 'Terminado y cobrado', urgente: false };
}

/** Pasos del recorrido de un presupuesto, para la línea de la ficha. */
export function recorrido(p: PresupuestoCliente, hoy: string): { texto: string; hecho: boolean; actual: boolean }[] {
  const e = estadoEfectivo(p, hoy);
  const aceptado = e === 'aceptado';
  const hitos = [
    { texto: 'Hecho', hecho: true },
    { texto: 'Enviado', hecho: e !== 'borrador' },
    { texto: 'Aceptado', hecho: aceptado },
    ...(p.totales.anticipo > 0 ? [{ texto: 'Anticipo cobrado', hecho: !!p.cobroAnticipo }] : []),
    { texto: 'Factura final', hecho: !!p.facturaId },
    { texto: 'Cobrado', hecho: !!p.cobroResto },
  ];
  const actual = hitos.findIndex((h) => !h.hecho);
  return hitos.map((h, i) => ({ ...h, actual: i === actual }));
}
