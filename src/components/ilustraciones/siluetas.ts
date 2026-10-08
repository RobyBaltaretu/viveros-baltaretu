import type { Familia } from '../../lib/catalogo/tipos';

export type TipoSilueta = 'palmera' | 'olivo' | 'higuera' | 'cica' | 'persona';

/** Tamaño del viewBox de cada silueta. El dibujo ocupa toda la altura (base = suelo). */
export const PROPORCION: Record<TipoSilueta, { ancho: number; alto: number }> = {
  palmera: { ancho: 172, alto: 260 },
  olivo: { ancho: 176, alto: 220 },
  higuera: { ancho: 190, alto: 200 },
  cica: { ancho: 170, alto: 110 },
  persona: { ancho: 56, alto: 180 },
};

/** Ancho del dibujo por cada unidad de altura: sirve para elegir el más esbelto. */
export const esbeltez = (tipo: TipoSilueta) => PROPORCION[tipo].ancho / PROPORCION[tipo].alto;

/** Silueta por defecto de cada familia del catálogo. */
export const SILUETA_POR_FAMILIA: Record<Familia, Exclude<TipoSilueta, 'persona'>> = {
  palmeras: 'palmera',
  olivos: 'olivo',
  higueras: 'higuera',
  'otras-ornamentales': 'cica',
};

/** Silueta de una especie: la indicada en su ficha o, si no hay, la de su familia. */
export function siluetaDe(data: { familia: Familia; silueta?: Exclude<TipoSilueta, 'persona'> | undefined }) {
  return data.silueta ?? SILUETA_POR_FAMILIA[data.familia];
}

let siguienteId = 0;
/** Prefijo único para los `id` internos de cada dibujo (las frondas se reutilizan con <use>). */
export function nuevoIdSilueta(): string {
  siguienteId += 1;
  return `sil${siguienteId}`;
}
