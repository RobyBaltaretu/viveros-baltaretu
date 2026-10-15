import { ALTURA_MAXIMA, DISPONIBILIDADES, FAMILIAS, FORMATOS, SILUETAS } from '../../lib/catalogo/schema';
import type { Autor, Documento, Repositorios } from '../data/tipos.ts';
import { validarEntrada, type ErrorCampo } from '../contenido/validacion.ts';

/**
 * Reglas del panel para las plantas: formularios en español llano que se
 * convierten en los mismos datos de las fichas y se validan con el esquema del
 * catálogo antes de guardar como borrador.
 */
export type DatosPlanta = Record<string, unknown> & {
  slug?: string;
  nombre?: { es?: string; en?: string };
  nombreCientifico?: string;
  precioDesde?: number | null;
  precioUnidad?: number | null;
  ventaUnitaria?: boolean;
  disponibilidad?: string;
  revisado?: boolean;
  datosDeEjemplo?: boolean;
};

/** "18,50 €" → 18.5. Vacío → null. Texto no numérico → NaN. */
export function numero(texto: string): number | null {
  const limpio = texto.replace(/€|m\b|cm\b/gi, '').replace(/\s/g, '').replace(',', '.');
  if (!limpio) return null;
  return /^\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : Number.NaN;
}

/** Identificador de la ficha a partir del nombre: "Olivo de copa" → "olivo-de-copa". */
export function slugDesde(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Textos para buscadores generados como en las fichas actuales. */
export function seoPorDefecto(d: DatosPlanta, empresa = 'Viveros Baltaretu') {
  const es = d.nombre?.es ?? '';
  const en = d.nombre?.en ?? es;
  const cientifico = d.nombreCientifico ?? '';
  const precio = d.precioDesde ? `, desde ${d.precioDesde} €` : '';
  const price = d.precioDesde ? ` from €${d.precioDesde}` : '';
  return {
    es: {
      titulo: `${es} al por mayor | ${empresa}`,
      descripcion: `${es} (${cientifico}) al por mayor${precio}. Reparto a toda España. Pide tu presupuesto.`,
    },
    en: {
      titulo: `${en} wholesale | ${empresa}`,
      descripcion: `${en} (${cientifico}) wholesale${price}. Delivery across Spain. Request a quote.`,
    },
  };
}

/** Mensajes en español llano para cada dato. */
export const NOMBRES_CAMPO: Record<string, string> = {
  'nombre.es': 'Nombre en español',
  'nombre.en': 'Nombre en inglés',
  nombreCientifico: 'Nombre científico',
  familia: 'Familia',
  'descripcion.es': 'Descripción en español',
  'descripcion.en': 'Descripción en inglés',
  alturaMin: 'Altura más baja',
  alturaMax: 'Altura más alta',
  perimetroTroncoCm: 'Grosor del tronco',
  formatos: 'Cómo se entrega',
  disponibilidad: 'Disponibilidad',
  precioDesde: 'Precio desde',
  precioUnidad: 'Precio por unidad',
  origen: 'Origen',
  slug: 'Nombre de la ficha',
};

/** Comprobaciones previas con mensajes claros; el esquema del catálogo es la última palabra. */
export function revisarPlanta(d: DatosPlanta): ErrorCampo[] {
  const errores: ErrorCampo[] = [];
  const falta = (campo: string) => errores.push({ campo, mensaje: `Falta: ${NOMBRES_CAMPO[campo]}.` });
  const n = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (!d.nombre?.es) falta('nombre.es');
  if (!d.nombre?.en) falta('nombre.en');
  if (!d.nombreCientifico) falta('nombreCientifico');
  if (!FAMILIAS.includes(d.familia as never)) falta('familia');
  const desc = d.descripcion as { es?: string; en?: string } | undefined;
  if (!desc?.es) falta('descripcion.es');
  if (!desc?.en) falta('descripcion.en');
  if (!n(d.alturaMin) || (d.alturaMin as number) <= 0) errores.push({ campo: 'alturaMin', mensaje: 'Escribe la altura más baja en metros, por ejemplo 1,5.' });
  if (!n(d.alturaMax) || (d.alturaMax as number) <= 0) errores.push({ campo: 'alturaMax', mensaje: 'Escribe la altura más alta en metros, por ejemplo 3.' });
  else if ((d.alturaMax as number) > ALTURA_MAXIMA) errores.push({ campo: 'alturaMax', mensaje: `El vivero trabaja plantas de hasta ${ALTURA_MAXIMA} m.` });
  if (n(d.alturaMin) && n(d.alturaMax) && (d.alturaMin as number) > (d.alturaMax as number))
    errores.push({ campo: 'alturaMin', mensaje: 'La altura más baja no puede ser mayor que la más alta.' });
  if (!Array.isArray(d.formatos) || d.formatos.length === 0) errores.push({ campo: 'formatos', mensaje: 'Marca al menos una forma de entrega.' });
  if (!DISPONIBILIDADES.includes(d.disponibilidad as never)) falta('disponibilidad');
  for (const campo of ['precioDesde', 'precioUnidad'] as const) {
    const v = d[campo];
    if (v != null && (!n(v) || (v as number) <= 0)) errores.push({ campo, mensaje: 'Escribe el precio en euros, por ejemplo 18 o 18,50. Déjalo vacío si es bajo presupuesto.' });
  }
  if (d.precioUnidad != null && !d.ventaUnitaria) errores.push({ campo: 'precioUnidad', mensaje: 'El precio por unidad solo se usa si la planta también se vende por unidad.' });
  const p = d.perimetroTroncoCm;
  if (Array.isArray(p) && p.length && (p.length !== 2 || !p.every((x) => Number.isInteger(x) && x > 0) || p[0] > p[1]))
    errores.push({ campo: 'perimetroTroncoCm', mensaje: 'Escribe el grosor mínimo y máximo en centímetros, sin decimales.' });
  if (!d.origen) falta('origen');
  return errores;
}

export type ResultadoGuardar = { ok: true } | { ok: false; errores: ErrorCampo[] };

/** Valida y guarda como borrador. Nunca deja una ficha que rompa el build. */
export async function guardarPlanta(repos: Repositorios, id: string, datos: DatosPlanta, autor: Autor): Promise<ResultadoGuardar> {
  const previos = revisarPlanta(datos);
  if (previos.length) return { ok: false, errores: previos };
  const documento: Documento = { datos, cuerpo: '' };
  const r = validarEntrada('catalogo', id, documento);
  if (!r.ok) return { ok: false, errores: r.errores.map((e) => ({ campo: e.campo, mensaje: `${NOMBRES_CAMPO[e.campo] ?? 'Un dato'}: revisa el valor.` })) };
  await repos.contenido.guardarBorrador('catalogo', id, documento, autor);
  return { ok: true };
}

/** Avisos de por qué una planta no saldrá en la web. */
export function avisosPublicacion(d: DatosPlanta): string[] {
  const avisos: string[] = [];
  if (d.datosDeEjemplo) avisos.push('Es una ficha de ejemplo: no se publica.');
  if (!d.revisado) avisos.push('Falta marcarla como revisada: no se publica hasta entonces.');
  return avisos;
}

export { ALTURA_MAXIMA, DISPONIBILIDADES, FAMILIAS, FORMATOS, SILUETAS };

/**
 * Pasa los campos de un formulario a los datos de la ficha. Solo cambia los
 * campos que la pantalla declara en `presentes` (así cada pantalla toca lo suyo).
 */
export function leerFormularioPlanta(form: FormData, base: DatosPlanta): DatosPlanta {
  const presentes = new Set(String(form.get('presentes') ?? '').split(',').filter(Boolean));
  const d: DatosPlanta = structuredClone(base);
  const texto = (n: string) => String(form.get(n) ?? '').trim();
  const bilingue = (clave: 'nombre' | 'descripcion', idioma: 'es' | 'en') => {
    if (!presentes.has(`${clave}.${idioma}`)) return;
    d[clave] = { ...((d[clave] as object) ?? {}), [idioma]: texto(`${clave}.${idioma}`) };
  };
  bilingue('nombre', 'es');
  bilingue('nombre', 'en');
  bilingue('descripcion', 'es');
  bilingue('descripcion', 'en');
  for (const n of ['nombreCientifico', 'familia', 'disponibilidad', 'origen']) if (presentes.has(n)) d[n] = texto(n);
  for (const n of ['alturaMin', 'alturaMax', 'precioDesde', 'precioUnidad']) if (presentes.has(n)) d[n] = numero(texto(n));
  for (const n of ['ventaUnitaria', 'destacada', 'revisado', 'datosDeEjemplo']) if (presentes.has(n)) d[n] = form.get(n) === '1';
  if (presentes.has('silueta')) {
    const silueta = texto('silueta');
    if (SILUETAS.includes(silueta as never)) d.silueta = silueta;
    else delete d.silueta;
  }
  if (presentes.has('formatos')) d.formatos = form.getAll('formatos').map(String).filter((f) => FORMATOS.includes(f as never));
  if (presentes.has('perimetro')) {
    const min = numero(texto('perimetroMin'));
    const max = numero(texto('perimetroMax'));
    d.perimetroTroncoCm = min == null && max == null ? [] : [min ?? Number.NaN, max ?? Number.NaN];
  }
  // Si la pantalla no muestra el precio por unidad y ya no se vende por unidad, se quita.
  if (!d.ventaUnitaria && !presentes.has('precioUnidad')) d.precioUnidad = null;
  for (const n of ['alturaMin', 'alturaMax'] as const) if (d[n] === null) delete d[n];
  d.seo = seoPorDefecto(d);
  return d;
}

/** Campos que se editan en cada pantalla de una planta (ver tests/panel/cobertura.test.ts). */
export const PANTALLAS_PLANTA = {
  datos: 'nombre.es,nombre.en,nombreCientifico,familia,descripcion.es,descripcion.en,alturaMin,alturaMax,perimetro,formatos,origen,destacada,revisado,silueta,datosDeEjemplo',
  precio: 'precioDesde,ventaUnitaria,precioUnidad',
  disponibilidad: 'disponibilidad',
} as const;

/** Acciones de un toque sobre una o varias plantas (desde la lista o la ficha). */
export const ACCIONES_RAPIDAS = {
  revisar: 'Marcar como revisada',
  'no-revisar': 'Quitar «revisada»',
  disponible: 'Disponible',
  'bajo-pedido': 'Bajo pedido',
  agotado: 'Agotado',
  destacar: 'Destacar en la portada',
  'no-destacar': 'Dejar de destacar',
  quitar: 'Quitar de la web',
  recuperar: 'Volver a poner en la web',
} as const;
export type AccionRapida = keyof typeof ACCIONES_RAPIDAS;
export const esAccionRapida = (a: string): a is AccionRapida => a in ACCIONES_RAPIDAS;

/** Aplica una acción rápida a cada planta, con la misma validación del panel. Devuelve cuántas y los errores. */
export async function accionRapida(repos: Repositorios, ids: string[], accion: AccionRapida, autor: Autor): Promise<{ hechas: number; errores: string[] }> {
  let hechas = 0;
  const errores: string[] = [];
  for (const id of [...new Set(ids)].slice(0, 300)) {
    const e = await repos.contenido.obtener('catalogo', id);
    if (!e) continue;
    if (accion === 'quitar' || accion === 'recuperar') {
      await repos.contenido.archivar('catalogo', id, accion === 'quitar', autor);
      hechas++;
      continue;
    }
    const d = { ...(e.borrador.datos as DatosPlanta) };
    if (accion === 'revisar' || accion === 'no-revisar') d.revisado = accion === 'revisar';
    else if (accion === 'destacar' || accion === 'no-destacar') d.destacada = accion === 'destacar';
    else d.disponibilidad = accion;
    const r = await guardarPlanta(repos, id, d, autor);
    if (r.ok) hechas++;
    else errores.push(`${String(d.nombre?.es ?? id)}: ${r.errores[0]?.mensaje ?? 'no se ha podido'}`);
  }
  return { hechas, errores };
}
