import { z } from 'astro/zod';
import { SLUG_REGEX } from '../catalogo/schema';

import { MAX_CANTIDAD, MAX_LINEAS } from './limites';
export { MAX_CANTIDAD, MAX_LINEAS };

/** Campo trampa: invisible para personas; si llega relleno, es un bot. */
export const CAMPO_TRAMPA = 'sitio_web';

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((valor) => (valor ? valor : undefined));

/** Venta al por mayor (profesionales) o por unidad con envío (particulares). */
export const TIPOS_PEDIDO = ['mayor', 'unidad'] as const;

export const esquemaPresupuesto = z.object({
  tipoPedido: z.enum(TIPOS_PEDIDO).default('mayor'),
  nombre: z.string().trim().min(2).max(100),
  empresa: textoOpcional(120),
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254)),
  telefono: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s().-]*$/)
    .optional()
    .transform((valor) => (valor ? valor : undefined)),
  provincia: textoOpcional(60),
  mensaje: textoOpcional(3000),
  lineas: z
    .array(
      z.object({
        slug: z.string().regex(SLUG_REGEX),
        cantidad: z.coerce.number().int().min(1).max(MAX_CANTIDAD),
      }),
    )
    .max(MAX_LINEAS)
    .default([]),
  idioma: z.enum(['es', 'en']).default('es'),
  // Consentimiento RGPD obligatorio. Llega como "on" desde un formulario HTML.
  consentimiento: z.union([z.literal(true), z.literal('on'), z.literal('true')]).transform(() => true as const),
  // Vacío si la web aún no tiene Turnstile configurado (entonces el servidor no lo exige).
  turnstile: z.string().max(4096).default(''),
  [CAMPO_TRAMPA]: z.string().max(0).optional(),
});

export type SolicitudPresupuesto = z.infer<typeof esquemaPresupuesto>;

/**
 * Normaliza el cuerpo de la petición (JSON o formulario HTML) a un objeto plano.
 * En formularios, `lineas` llega como JSON en un campo oculto y el token de
 * Turnstile en `cf-turnstile-response`.
 */
export function normalizarEntrada(cuerpo: Record<string, unknown>): Record<string, unknown> {
  const entrada: Record<string, unknown> = { ...cuerpo };
  if (typeof entrada.lineas === 'string') {
    try {
      entrada.lineas = entrada.lineas ? JSON.parse(entrada.lineas) : [];
    } catch {
      entrada.lineas = 'invalido';
    }
  }
  if (entrada.turnstile === undefined && typeof entrada['cf-turnstile-response'] === 'string') {
    entrada.turnstile = entrada['cf-turnstile-response'];
  }
  delete entrada['cf-turnstile-response'];
  return entrada;
}
