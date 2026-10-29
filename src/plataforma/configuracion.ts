import { z } from 'astro/zod';

/**
 * Configuración de cada cliente de la plataforma (`clientes/<id>/cliente.config.json`).
 * Se elige en el build con `CLIENTE_ID`; sin ella, el cliente es Viveros
 * Baltaretu y todo se comporta exactamente como antes de la plataforma.
 * Ver docs/plataforma/plan.md.
 */
export const CLIENTE_POR_DEFECTO = 'baltaretu';

/**
 * Módulos que se pueden activar por cliente. `catalogo` es el catálogo del
 * vivero o el portafolio de la carpintería (el nombre lo pone el sector).
 */
export const MODULOS = [
  'catalogo',
  'presupuestosWeb',
  'presupuestosCliente',
  'obras',
  'agenda',
  'proveedores',
  'materiales',
  'pedidosProveedor',
  'facturas',
  'gastos',
  'informes',
  'asistente',
  'simulador',
  'whatsapp',
] as const;
export type Modulo = (typeof MODULOS)[number];

export const SECTORES = ['vivero', 'carpinteria'] as const;
export const IDIOMAS_POSIBLES = ['es', 'en'] as const;
/** Tokens de color del tema (los de `@theme` en `src/styles/global.css`). */
export const TOKENS_COLOR = ['crema', 'papel', 'verdor', 'oliva', 'tinta', 'gris', 'terracota', 'linea'] as const;

const color = z.string().regex(/^#[0-9a-f]{6}$/i, 'Color en hexadecimal (#rrggbb)');
/** Nombres de recursos de Cloudflare: minúsculas, números y guiones. */
const recurso = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'Minúsculas, números y guiones');

export const esquemaCliente = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/),
    nombre: z.string().min(1),
    sector: z.enum(SECTORES),
    /** Marca del panel: nombre corto y monograma (en public/), o null para usar las iniciales. */
    marca: z.object({ nombreCorto: z.string().min(1), monograma: z.string().regex(/^\/[\w.-]+\.(png|svg|webp)$/).nullable() }).strict(),
    /** Plan de suscripción: se guarda, pero todavía no decide nada (preguntas P-10). */
    plan: z.string().min(1),
    /** Dominio público sin https://, o null mientras se use el de SITE_URL. */
    dominio: z.string().nullable(),
    /** false: sin páginas públicas, solo el panel (src/plataforma/sin-web.ts). */
    webPublica: z.boolean(),
    idiomas: z.array(z.enum(IDIOMAS_POSIBLES)).min(1),
    idiomaPorDefecto: z.enum(IDIOMAS_POSIBLES),
    /** Worker y D1 en Cloudflare; `wrangler`: su archivo de configuración si no es `wrangler.jsonc` (el de Baltaretu). */
    cloudflare: z.object({ worker: recurso, d1: recurso, wrangler: z.string().regex(/^wrangler\.[a-z0-9-]+\.jsonc$/).optional() }).strict(),
    /** Cada módulo, true o false (los tiene que decir todos). */
    modulos: z.record(z.enum(MODULOS), z.boolean()),
    iva: z
      .object({
        /** Tipo de IVA que se propone en cada línea nueva. */
        general: z.number().int().min(0).max(21),
        /** Si es true, la interfaz no deja elegir otro tipo. */
        fijo: z.boolean(),
      })
      .strict(),
    /** Colores del tema, todos. Si falta, se usan los del núcleo (los de Baltaretu). */
    tema: z.record(z.enum(TOKENS_COLOR), color).optional(),
  })
  .strict()
  .refine((c) => c.idiomas.includes(c.idiomaPorDefecto), { message: 'El idioma por defecto tiene que estar en «idiomas»', path: ['idiomaPorDefecto'] });

export type ConfiguracionCliente = z.infer<typeof esquemaCliente>;

/** Lee y valida una configuración ya cargada. Lanza un error legible si no vale. */
export function validarCliente(id: string, datos: unknown): ConfiguracionCliente {
  const r = esquemaCliente.safeParse(datos);
  if (!r.success) throw new Error(`clientes/${id}/cliente.config.json no es válido:\n${r.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n')}`);
  if (r.data.id !== id) throw new Error(`clientes/${id}/cliente.config.json: el id es «${r.data.id}» y tiene que ser «${id}»`);
  return r.data;
}

export const moduloActivo = (c: ConfiguracionCliente, m: Modulo) => c.modulos[m] === true;
