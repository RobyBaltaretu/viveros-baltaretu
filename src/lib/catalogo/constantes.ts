/** Constantes del catálogo sin zod: se pueden usar en el navegador sin cargar el validador (unos 85 KB). */
/** El vivero trabaja planta de hasta 4 m (dato confirmado por el propietario). */
export const ALTURA_MAXIMA = 4;

export const FAMILIAS = ['palmeras', 'olivos', 'higueras', 'otras-ornamentales'] as const;
export const DISPONIBILIDADES = ['disponible', 'bajo-pedido', 'agotado'] as const;
export const FORMATOS = ['contenedor', 'cepellon', 'raiz-desnuda'] as const;
export const UNIDADES_PRECIO = ['unidad'] as const;
export const SILUETAS = ['palmera', 'olivo', 'higuera', 'cica'] as const;

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
