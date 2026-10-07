import type { Familia, Formato } from './tipos';
import { FAMILIAS, FORMATOS } from './schema';

/**
 * Filtros del catálogo. Lógica pura (sin DOM) compartida por el script del
 * navegador y los tests. El estado vive en la URL para poder compartirlo:
 * ?altura=2-5&familia=olivos,palmeras&formato=cepellon&perimetro=30-80
 */

export const RANGOS_PERIMETRO = {
  'hasta-30': [0, 30],
  '30-80': [30, 80],
  'mas-80': [80, Number.POSITIVE_INFINITY],
} as const satisfies Record<string, readonly [number, number]>;
export type RangoPerimetro = keyof typeof RANGOS_PERIMETRO;

export interface EstadoFiltros {
  /** Rango de altura elegido en metros; null = sin filtrar. */
  altura: [number, number] | null;
  familias: Familia[];
  formatos: Formato[];
  perimetro: RangoPerimetro | null;
}

export interface DatosFiltrables {
  familia: Familia;
  alturaMin: number;
  alturaMax: number;
  formatos: readonly Formato[];
  perimetro?: readonly [number, number] | undefined;
}

export const SIN_FILTROS: EstadoFiltros = { altura: null, familias: [], formatos: [], perimetro: null };

const solapan = (a: readonly [number, number], b: readonly [number, number]) => a[0] <= b[1] && a[1] >= b[0];

/** Una especie cumple si su rango de alturas se solapa con el elegido y coincide con alguna opción de cada grupo marcado. */
export function cumpleFiltros(d: DatosFiltrables, e: EstadoFiltros): boolean {
  if (e.altura && !solapan([d.alturaMin, d.alturaMax], e.altura)) return false;
  if (e.familias.length && !e.familias.includes(d.familia)) return false;
  if (e.formatos.length && !d.formatos.some((f) => e.formatos.includes(f))) return false;
  if (e.perimetro) {
    if (!d.perimetro) return false;
    if (!solapan(d.perimetro, RANGOS_PERIMETRO[e.perimetro])) return false;
  }
  return true;
}

export const contarActivos = (e: EstadoFiltros) =>
  (e.altura ? 1 : 0) + e.familias.length + e.formatos.length + (e.perimetro ? 1 : 0);

const lista = <T extends string>(valor: string | null, validos: readonly T[]): T[] =>
  (valor ?? '')
    .split(',')
    .filter((v): v is T => (validos as readonly string[]).includes(v));

/** Lee el estado de la URL, ignorando valores no válidos. `alturaMaxima` es el tope de la regla. */
export function leerFiltros(params: URLSearchParams, alturaMaxima: number): EstadoFiltros {
  let altura: EstadoFiltros['altura'] = null;
  const coincidencia = params.get('altura')?.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (coincidencia) {
    const min = Math.max(0, Number(coincidencia[1]));
    const max = Math.min(alturaMaxima, Number(coincidencia[2]));
    if (min <= max && !(min === 0 && max === alturaMaxima)) altura = [min, max];
  }
  const perimetro = params.get('perimetro');
  return {
    altura,
    familias: lista(params.get('familia'), FAMILIAS),
    formatos: lista(params.get('formato'), FORMATOS),
    perimetro: perimetro && perimetro in RANGOS_PERIMETRO ? (perimetro as RangoPerimetro) : null,
  };
}

export function escribirFiltros(e: EstadoFiltros): URLSearchParams {
  const params = new URLSearchParams();
  if (e.altura) params.set('altura', `${e.altura[0]}-${e.altura[1]}`);
  if (e.familias.length) params.set('familia', e.familias.join(','));
  if (e.formatos.length) params.set('formato', e.formatos.join(','));
  if (e.perimetro) params.set('perimetro', e.perimetro);
  return params;
}
