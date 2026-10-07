import type { Familia } from '../../lib/catalogo/tipos';

export type TipoSilueta = 'palmera' | 'olivo' | 'higuera' | 'cica' | 'persona';

/** Tamaño del viewBox de cada silueta. El dibujo ocupa toda la altura (base = suelo). */
export const PROPORCION: Record<TipoSilueta, { ancho: number; alto: number }> = {
  palmera: { ancho: 160, alto: 260 },
  olivo: { ancho: 170, alto: 220 },
  higuera: { ancho: 190, alto: 200 },
  cica: { ancho: 170, alto: 110 },
  persona: { ancho: 56, alto: 180 },
};

/** Silueta por defecto de cada familia del catálogo. */
export const SILUETA_POR_FAMILIA: Record<Familia, Exclude<TipoSilueta, 'persona'>> = {
  palmeras: 'palmera',
  olivos: 'olivo',
  higueras: 'higuera',
  'otras-ornamentales': 'cica',
};
