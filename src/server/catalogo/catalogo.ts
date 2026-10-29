import { z } from 'astro/zod';
import type { ArticuloCatalogo, PlantillaCatalogo, Repositorios } from '../data/tipos.ts';
import { comprobarFormula } from './formulas.ts';

/**
 * Catálogo de la carpintería: lo que se compra, se fabrica y se cobra, con su
 * coste y su margen, y las plantillas de cada trabajo con su escandallo (de las
 * medidas a las piezas, cantos, herrajes, horas y precio). Es privado: los
 * costes y márgenes nunca salen en un presupuesto ni en un pedido.
 */

export interface Categoria {
  id: string;
  nombre: string;
  /** Unidad, merma y margen que se proponen al crear un artículo de esta categoría. */
  unidad: string;
  merma: number;
  grupo: 'Materiales' | 'Herrajes y accesorios' | 'Acabados' | 'Mano de obra' | 'Servicios';
}

/** Merma y margen que se proponen; cada negocio los cambia en cada artículo (T-21). */
export const MARGEN_PROPUESTO = 30;

export const CATEGORIAS: Categoria[] = [
  { id: 'tableros', nombre: 'Tableros', unidad: 'm²', merma: 15, grupo: 'Materiales' },
  { id: 'macizos', nombre: 'Madera maciza', unidad: 'm²', merma: 20, grupo: 'Materiales' },
  { id: 'chapas', nombre: 'Chapas y laminados', unidad: 'm²', merma: 15, grupo: 'Materiales' },
  { id: 'cantos', nombre: 'Cantos', unidad: 'ml', merma: 10, grupo: 'Materiales' },
  { id: 'encimeras', nombre: 'Encimeras', unidad: 'ml', merma: 5, grupo: 'Materiales' },
  { id: 'cristal', nombre: 'Cristal y espejo', unidad: 'm²', merma: 0, grupo: 'Materiales' },
  { id: 'herrajes', nombre: 'Herrajes', unidad: 'ud', merma: 0, grupo: 'Herrajes y accesorios' },
  { id: 'tiradores', nombre: 'Tiradores y perfiles', unidad: 'ud', merma: 0, grupo: 'Herrajes y accesorios' },
  { id: 'accesorios', nombre: 'Accesorios interiores', unidad: 'ud', merma: 0, grupo: 'Herrajes y accesorios' },
  { id: 'iluminacion', nombre: 'Iluminación', unidad: 'ml', merma: 5, grupo: 'Herrajes y accesorios' },
  { id: 'consumibles', nombre: 'Consumibles', unidad: 'ud', merma: 0, grupo: 'Herrajes y accesorios' },
  { id: 'acabados', nombre: 'Acabados (lacado, barniz, aceite)', unidad: 'm²', merma: 0, grupo: 'Acabados' },
  { id: 'mano-obra', nombre: 'Mano de obra', unidad: 'h', merma: 0, grupo: 'Mano de obra' },
  { id: 'servicios', nombre: 'Servicios (transporte, retirada…)', unidad: 'ud', merma: 0, grupo: 'Servicios' },
];
export const categoria = (id: string) => CATEGORIAS.find((c) => c.id === id);

export const UNIDADES = ['ud', 'm²', 'ml', 'm³', 'h', 'kg', 'l'] as const;
export const NOMBRE_UNIDAD: Record<(typeof UNIDADES)[number], string> = { ud: 'unidad', 'm²': 'metro cuadrado', ml: 'metro lineal', 'm³': 'metro cúbico', h: 'hora', kg: 'kilo', l: 'litro' };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Precio de venta sin IVA por unidad: el fijado a mano o el coste más el margen. */
export const precioVenta = (a: Pick<ArticuloCatalogo, 'coste' | 'margen' | 'precioFijo'>) => (a.precioFijo !== null ? a.precioFijo : r2(a.coste * (1 + a.margen / 100)));

/** Le falta el precio (artículo del catálogo de partida aún sin rellenar). */
export const sinPrecio = (a: Pick<ArticuloCatalogo, 'coste' | 'precioFijo'>) => a.coste <= 0 && (a.precioFijo === null || a.precioFijo <= 0);

const texto = (max: number) => z.string().trim().max(max, `Como mucho ${max} letras.`);
const numero = (nombre: string, max: number) => z.coerce.number({ message: `Escribe ${nombre} con números.` }).min(0, `${nombre[0]!.toUpperCase()}${nombre.slice(1)} no puede ser negativo.`).max(max, `${nombre[0]!.toUpperCase()}${nombre.slice(1)}: como mucho ${max}.`);

export const esquemaArticulo = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,80}$/).optional(),
  categoria: z.string().refine((c) => !!categoria(c), 'Elige una categoría.'),
  nombre: texto(120).min(1, 'Escribe el nombre (por ejemplo, «Melamina blanca 19 mm»).'),
  unidad: z.enum(UNIDADES, { message: 'Elige la unidad.' }),
  coste: numero('el coste', 1_000_000),
  merma: numero('la merma', 200),
  margen: numero('el margen', 1000),
  precioFijo: numero('el precio', 1_000_000).nullable().default(null),
  referencia: texto(60).default(''),
  proveedor: texto(80).default(''),
  espesor: numero('el espesor', 1000).nullable().default(null),
  acabado: texto(80).default(''),
  notas: texto(500).default(''),
});
export type EntradaArticulo = z.input<typeof esquemaArticulo>;

const idDe = (nombre: string) =>
  `${nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'articulo'}-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;

type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

/** Alta o cambio de un artículo, validado. */
export async function guardarArticulo(repos: Repositorios, entrada: EntradaArticulo, email: string): Promise<Resultado<ArticuloCatalogo>> {
  const r = esquemaArticulo.safeParse(entrada);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? 'Revisa los datos.' };
  const d = r.data;
  if (d.id && !(await repos.catalogo.articulo(d.id))) return { ok: false, error: 'Ese artículo no existe.' };
  const id = d.id ?? idDe(d.nombre);
  const articulo = { ...d, id, coste: r2(d.coste), precioFijo: d.precioFijo === null ? null : r2(d.precioFijo) };
  await repos.catalogo.guardarArticulo(articulo, email);
  return { ok: true, valor: (await repos.catalogo.articulo(id))! };
}

const nombreMedida = z.string().regex(/^[a-z][a-z0-9_]{0,24}$/, 'El nombre de cada medida va en minúsculas y sin espacios (por ejemplo, «ancho» o «puertas»).');
export const esquemaPlantilla = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,80}$/).optional(),
    nombre: texto(120).min(1, 'Escribe el nombre de la plantilla.'),
    tipoTrabajo: texto(60).default(''),
    descripcion: texto(500).default(''),
    parametros: z
      .array(
        z.object({
          id: nombreMedida,
          nombre: texto(60).min(1, 'Cada medida necesita un nombre.'),
          tipo: z.enum(['medida', 'numero']),
          defecto: z.coerce.number(),
          min: z.coerce.number(),
          max: z.coerce.number(),
        }),
      )
      .max(15, 'Como mucho 15 medidas.'),
    opciones: z
      .array(z.object({ id: nombreMedida, nombre: texto(60).min(1, 'Cada material a elegir necesita un nombre.'), categorias: z.array(z.string()).min(1), defecto: z.string().nullable() }))
      .max(10, 'Como mucho 10 materiales a elegir.'),
    componentes: z
      .array(z.object({ concepto: texto(120).min(1, 'Cada parte necesita un concepto.'), articulo: z.union([z.object({ id: z.string().min(1) }), z.object({ opcion: z.string().min(1) })]), cantidad: texto(300) }))
      .min(1, 'Añade al menos una parte (material, herraje u hora de trabajo).')
      .max(80, 'Como mucho 80 partes.'),
    orden: z.coerce.number().int().default(0),
  })
  .superRefine((p, ctx) => {
    const ids = p.parametros.map((x) => x.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Hay dos medidas con el mismo nombre.', path: ['parametros'] });
    for (const x of p.parametros) {
      if (x.min > x.max) ctx.addIssue({ code: 'custom', message: `«${x.nombre}»: el mínimo es mayor que el máximo.`, path: ['parametros'] });
      else if (x.defecto < x.min || x.defecto > x.max) ctx.addIssue({ code: 'custom', message: `«${x.nombre}»: el valor propuesto tiene que estar entre ${x.min} y ${x.max}.`, path: ['parametros'] });
    }
    for (const c of p.componentes) {
      if ('opcion' in c.articulo && !p.opciones.some((o) => o.id === (c.articulo as { opcion: string }).opcion)) ctx.addIssue({ code: 'custom', message: `«${c.concepto}» usa un material a elegir que no existe.`, path: ['componentes'] });
      const error = comprobarFormula(c.cantidad, ids);
      if (error) ctx.addIssue({ code: 'custom', message: `«${c.concepto}»: ${error}`, path: ['componentes'] });
    }
  });
export type EntradaPlantilla = z.input<typeof esquemaPlantilla>;

/** Alta o cambio de una plantilla: comprueba las fórmulas y que los artículos existen. */
export async function guardarPlantilla(repos: Repositorios, entrada: EntradaPlantilla, email: string): Promise<Resultado<PlantillaCatalogo>> {
  const r = esquemaPlantilla.safeParse(entrada);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? 'Revisa los datos.' };
  const d = r.data;
  if (d.id && !(await repos.catalogo.plantilla(d.id))) return { ok: false, error: 'Esa plantilla no existe.' };
  const articulos = new Set((await repos.catalogo.articulos({ incluirArchivados: true })).map((a) => a.id));
  const falta = d.componentes.find((c) => 'id' in c.articulo && !articulos.has(c.articulo.id));
  if (falta) return { ok: false, error: `«${falta.concepto}» usa un artículo que no está en el catálogo.` };
  const id = d.id ?? idDe(d.nombre);
  await repos.catalogo.guardarPlantilla({ ...d, id }, email);
  return { ok: true, valor: (await repos.catalogo.plantilla(id))! };
}
