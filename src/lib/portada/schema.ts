import { z } from 'astro/zod';

const bilingue = z.object({ es: z.string().trim().min(1), en: z.string().trim().min(1) });

export const ICONOS_CONFIANZA = ['origen', 'documentacion', 'reparto', 'calidad'] as const;

/** Textos de la portada, editables desde el panel (singleton "Portada"). */
export const esquemaPortada = z.object({
  titular: bilingue,
  /** Parte final del titular, resaltada en lima. */
  titularDestacado: bilingue,
  entradilla: bilingue,
  tituloFranja: bilingue,
  confianza: z
    .array(
      z.object({
        icono: z.enum(ICONOS_CONFIANZA),
        titulo: bilingue,
        texto: bilingue,
      }),
    )
    .max(6),
  mision: bilingue,
  vision: bilingue,
  llamadaTitulo: bilingue,
  llamadaTexto: bilingue,
});

export type Portada = z.infer<typeof esquemaPortada>;
