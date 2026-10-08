import type { Idioma } from '../../i18n/ui';
import type { UnidadPrecio } from './tipos';

const LOCALES: Record<Idioma, string> = { es: 'es-ES', en: 'en-GB' };

const UNIDADES: Record<UnidadPrecio, Record<Idioma, string>> = {
  unidad: { es: 'unidad', en: 'unit' },
};

/** "desde 12 € / unidad" o, si no hay precio, "precio bajo presupuesto". */
export function formatearPrecio(
  precioDesde: number | null | undefined,
  unidad: UnidadPrecio,
  idioma: Idioma,
): string {
  if (precioDesde == null) {
    return idioma === 'es' ? 'precio bajo presupuesto' : 'price on request';
  }
  const importe = new Intl.NumberFormat(LOCALES[idioma], {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: Number.isInteger(precioDesde) ? 0 : 2,
  }).format(precioDesde);
  const prefijo = idioma === 'es' ? 'desde' : 'from';
  const porUnidad = idioma === 'es' ? '/' : 'per';
  return `${prefijo} ${importe} ${porUnidad} ${UNIDADES[unidad][idioma]}`;
}

/** Importe suelto: "24 €" o "€24". */
export function formatearImporte(importe: number, idioma: Idioma): string {
  return new Intl.NumberFormat(LOCALES[idioma], {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: Number.isInteger(importe) ? 0 : 2,
  }).format(importe);
}

export function formatearRango(min: number, max: number, unidad: string, idioma: Idioma): string {
  const numero = new Intl.NumberFormat(LOCALES[idioma], { maximumFractionDigits: 2 });
  if (min === max) return `${numero.format(min)} ${unidad}`;
  return `${numero.format(min)}–${numero.format(max)} ${unidad}`;
}
