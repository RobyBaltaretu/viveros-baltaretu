import { z } from 'astro/zod';
import { SLUG_REGEX } from '../catalogo/schema';

const bilingue = z.object({ es: z.string().trim().min(1), en: z.string().trim().min(1) });

/** Bloque de texto con título opcional. Los párrafos se separan con una línea en blanco. */
const seccion = z.object({
  titulo: z.object({ es: z.string().trim(), en: z.string().trim() }).optional(),
  texto: bilingue,
});

/** Páginas fijas (nosotros, reparto y legales), cada una un singleton del panel. */
export const esquemaPagina = z.object({
  titulo: bilingue,
  entradilla: bilingue,
  secciones: z.array(seccion).default([]),
  seoDescripcion: bilingue,
  /** Muestra el aviso "pendiente de revisión por un asesor" (textos legales). */
  pendienteRevision: z.boolean().default(false),
});

const comunEntrada = {
  slug: z.string().regex(SLUG_REGEX),
  titulo: bilingue,
  resumen: bilingue,
  secciones: z.array(seccion).default([]),
  seoDescripcion: bilingue,
  datosDeEjemplo: z.boolean().default(false),
  revisado: z.boolean().default(false),
};

export function crearEsquemaProyecto<TImagen extends z.ZodType>(imagen: TImagen) {
  return z.object({
    ...comunEntrada,
    ubicacion: z.string().trim().min(1),
    /** Slugs de especies del catálogo usadas en el proyecto. */
    especies: z.array(z.string().regex(SLUG_REGEX)).default([]),
    fotos: z.array(z.object({ imagen, alt: bilingue })).default([]),
  });
}

export const esquemaGuia = z.object(comunEntrada);

export type Seccion = z.infer<typeof seccion>;
export type Pagina = z.infer<typeof esquemaPagina>;
export const PAGINAS = ['nosotros', 'reparto', 'aviso-legal', 'privacidad', 'cookies'] as const;
export type ClavePagina = (typeof PAGINAS)[number];
