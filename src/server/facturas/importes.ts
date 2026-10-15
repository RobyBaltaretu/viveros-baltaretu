import type { DesgloseIva, LineaFactura, TotalesFactura } from '../data/tipos.ts';

/**
 * Cálculo de importes de una factura, en céntimos para no arrastrar errores de
 * coma flotante. Cada línea se redondea a céntimos; la cuota de IVA se calcula
 * sobre la base de cada tipo (como piden las facturas en España).
 */
export const TIPOS_IVA = [21, 10, 4, 0] as const;
/** Planta viva ornamental: IVA reducido del 10 %. */
export const IVA_POR_DEFECTO = 10;
/** Recargo de equivalencia de cada tipo de IVA. */
export const RECARGO: Record<number, number> = { 21: 5.2, 10: 1.4, 4: 0.5, 0: 0 };

const cent = (euros: number) => Math.round(euros * 100);
const euros = (centimos: number) => Math.round(centimos) / 100;

export function importeLinea(l: LineaFactura): number {
  // toPrecision quita el ruido de coma flotante (1,005 € × 100 = 100,4999…) antes de redondear.
  return euros(Math.round(Number((l.cantidad * l.precio * 100 * (1 - l.descuento / 100)).toPrecision(12))));
}

export function calcularTotales(lineas: LineaFactura[], conRecargo = false): TotalesFactura {
  const porTipo = new Map<number, number>();
  for (const l of lineas) porTipo.set(l.iva, (porTipo.get(l.iva) ?? 0) + cent(importeLinea(l)));
  const desglose: DesgloseIva[] = [...porTipo.entries()]
    .sort(([a], [b]) => b - a)
    .map(([iva, base]) => {
      const recargo = conRecargo ? (RECARGO[iva] ?? 0) : 0;
      return { iva, base: euros(base), cuota: euros(Math.round((base * iva) / 100)), recargo, cuotaRecargo: euros(Math.round((base * recargo) / 100)) };
    });
  const suma = (f: (d: DesgloseIva) => number) => euros(desglose.reduce((t, d) => t + cent(f(d)), 0));
  const base = suma((d) => d.base);
  const cuotaIva = suma((d) => d.cuota);
  const cuotaRecargo = suma((d) => d.cuotaRecargo);
  return { base, cuotaIva, cuotaRecargo, total: euros(cent(base) + cent(cuotaIva) + cent(cuotaRecargo)), desglose };
}

const FORMATO = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
/** 1234,5 → «1.234,50 €» (con espacio normal, para que se lea igual en el PDF). */
export const dinero = (n: number) => FORMATO.format(n).replace(/\s/g, ' ');

/** Número escrito en español («18,50», «18.5», «1.234,5», «-2») → número; vacío → `null`; no válido → `NaN`. */
export function leerNumero(texto: string): number | null {
  const t = texto.replace(/\s|€|%/g, '');
  if (!t) return null;
  const signo = t.startsWith('-') ? -1 : 1;
  const sin = t.replace(/^[-+]/, '');
  let normal: string;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(sin)) normal = sin.replace(/\./g, '').replace(',', '.');
  else if (/^\d+(,\d+)?$/.test(sin)) normal = sin.replace(',', '.');
  else if (/^\d+(\.\d+)?$/.test(sin)) normal = sin;
  else return Number.NaN;
  return signo * Number(normal);
}
