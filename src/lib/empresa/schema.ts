import { z } from 'astro/zod';

/** Texto pendiente de confirmar por la empresa (regla de CLAUDE.md). */
export const esPlaceholder = (valor: string | undefined | null): boolean =>
  !valor || valor.trim() === '' || valor.trim().startsWith('[PLACEHOLDER');

/** Número de WhatsApp en formato internacional sin "+" ni espacios (ej. 34600000000), o vacío. */
export const WHATSAPP_REGEX = /^(\d{8,15})?$/;

export const esquemaEmpresa = z.object({
  nombre: z.string().trim().min(1),
  telefono: z.string().trim().default(''),
  whatsapp: z.string().trim().regex(WHATSAPP_REGEX, 'Solo dígitos con prefijo de país, sin "+" ni espacios').default(''),
  email: z.string().trim().default(''),
  direccion: z.string().trim().default(''),
});

export type Empresa = z.infer<typeof esquemaEmpresa>;
