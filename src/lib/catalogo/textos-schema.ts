import { z } from 'astro/zod';
import { FAMILIAS } from './schema';

const bilingue = z.object({ es: z.string().trim().min(1), en: z.string().trim().min(1) });
const textosPagina = z.object({ entradilla: bilingue, seoDescripcion: bilingue });

/** Textos del catálogo y de cada familia (singleton "Textos del catálogo" en el panel). */
export const esquemaTextosCatalogo = z.object({
  catalogo: textosPagina,
  ...Object.fromEntries(FAMILIAS.map((f) => [f, textosPagina])),
} as Record<'catalogo' | (typeof FAMILIAS)[number], typeof textosPagina>);

export type TextosCatalogo = z.infer<typeof esquemaTextosCatalogo>;
