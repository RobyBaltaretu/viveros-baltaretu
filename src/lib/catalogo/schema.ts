import { z } from 'astro/zod';

/**
 * Esquema de cada especie del catálogo (ver CLAUDE.md, "Esquema de cada especie").
 *
 * Se define como una función que recibe el validador de imágenes para poder
 * usarlo tanto en `src/content.config.ts` (con el helper `image()` de Astro)
 * como en los tests (con un validador de texto simple).
 */

export const FAMILIAS = ['palmeras', 'olivos', 'higueras', 'otras-ornamentales'] as const;
export const DISPONIBILIDADES = ['disponible', 'bajo-pedido', 'agotado'] as const;
export const FORMATOS = ['contenedor', 'cepellon', 'raiz-desnuda'] as const;
export const UNIDADES_PRECIO = ['unidad'] as const;
export const SILUETAS = ['palmera', 'olivo', 'higuera', 'cica'] as const;

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const textoBilingue = z.object({
  es: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

const seoIdioma = z.object({
  titulo: z.string().trim().min(1),
  descripcion: z.string().trim().min(1),
});

/** Perímetro del tronco en cm como `[mínimo, máximo]`. Vacío o ausente = sin dato. */
const perimetroTronco = z
  .array(z.number().int().positive())
  .optional()
  .transform((valor) => (valor && valor.length > 0 ? valor : undefined))
  .refine((valor) => valor === undefined || valor.length === 2, {
    message: 'perimetroTroncoCm debe tener dos valores: [mínimo, máximo]',
  })
  .refine((valor) => valor === undefined || valor[0] <= valor[1], {
    message: 'En perimetroTroncoCm el mínimo no puede ser mayor que el máximo',
  })
  .transform((valor) => valor as [number, number] | undefined);

export function crearEsquemaEspecie<TImagen extends z.ZodType>(imagen: TImagen) {
  return z
    .object({
      slug: z.string().regex(SLUG_REGEX, 'El slug solo admite minúsculas, números y guiones'),
      familia: z.enum(FAMILIAS),
      nombre: textoBilingue,
      nombreCientifico: z.string().trim().min(1),
      descripcion: textoBilingue,
      alturaMin: z.number().positive(),
      alturaMax: z.number().positive(),
      perimetroTroncoCm: perimetroTronco,
      formatos: z.array(z.enum(FORMATOS)).min(1),
      disponibilidad: z.enum(DISPONIBILIDADES),
      // Si falta, la web muestra "precio bajo presupuesto".
      precioDesde: z.number().positive().nullish(),
      unidadPrecio: z.enum(UNIDADES_PRECIO).default('unidad'),
      origen: z.string().trim().min(1),
      destacada: z.boolean().default(false),
      // La venta es al por mayor; algunas especies también se venden por unidad con envío al destino.
      ventaUnitaria: z.boolean().default(false),
      // Dibujo que representa la especie mientras no haya fotos. Si falta, se usa el de su familia.
      silueta: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.enum(SILUETAS).optional()),
      fotos: z
        .array(
          z.object({
            imagen,
            alt: textoBilingue,
          }),
        )
        .default([]),
      seo: z.object({ es: seoIdioma, en: seoIdioma }),
      datosDeEjemplo: z.boolean().default(false),
      revisado: z.boolean().default(false),
    })
    .refine((d) => d.alturaMin <= d.alturaMax, {
      message: 'alturaMin no puede ser mayor que alturaMax',
      path: ['alturaMin'],
    });
}
