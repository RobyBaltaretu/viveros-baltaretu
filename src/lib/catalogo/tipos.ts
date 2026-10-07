import type { DISPONIBILIDADES, FAMILIAS, FORMATOS, UNIDADES_PRECIO } from './schema';

export type Familia = (typeof FAMILIAS)[number];
export type Disponibilidad = (typeof DISPONIBILIDADES)[number];
export type Formato = (typeof FORMATOS)[number];
export type UnidadPrecio = (typeof UNIDADES_PRECIO)[number];
