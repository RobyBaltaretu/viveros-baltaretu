import { z } from 'astro/zod';

const bilingue = z.object({ es: z.string().trim().min(1), en: z.string().trim().min(1) });

export const ICONOS_CONFIANZA = ['origen', 'documentacion', 'reparto', 'calidad'] as const;

/** Textos de la portada, editables desde el panel (singleton "Portada"). */
export const esquemaPortada = z.object({
  titular: bilingue,
  /** Parte final del titular, resaltada en lima. */
  titularDestacado: bilingue,
  entradilla: bilingue,
  /** Las familias del catálogo. */
  familiasTitulo: bilingue,
  familiasTexto: bilingue,
  /** Cómo comprar: al por mayor (profesionales) o por unidad (particulares). */
  comprarTitulo: bilingue,
  mayorTitulo: bilingue,
  mayorTexto: bilingue,
  unidadTitulo: bilingue,
  unidadTexto: bilingue,
  /** Cómo se pide, paso a paso. */
  pasosTitulo: bilingue,
  pasos: z.array(z.object({ titulo: bilingue, texto: bilingue })).max(4),
  confianzaTitulo: bilingue,
  confianza: z
    .array(
      z.object({
        icono: z.enum(ICONOS_CONFIANZA),
        titulo: bilingue,
        texto: bilingue,
      }),
    )
    .max(6),
  /** Se muestran en la página "Nosotros". */
  mision: bilingue,
  vision: bilingue,
  llamadaTitulo: bilingue,
  llamadaTexto: bilingue,
});

export type Portada = z.infer<typeof esquemaPortada>;
