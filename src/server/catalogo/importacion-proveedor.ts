import {identidadProveedor as clave} from './identidad-proveedor';
import { z } from 'astro/zod';
import { CATEGORIAS, MARGEN_PROPUESTO, esquemaArticulo } from './catalogo.ts';
import type { Repositorios } from '../data/tipos.ts';
import { tipoDeImagen } from '../panel/fotos.ts';
import { claveNormalizada, normalizarDimensiones } from './modelo.ts';
import type { DecorativoCatalogo, FamiliaCatalogo, OrigenCatalogo, VarianteCatalogo } from '../data/tipos.ts';

/** El PDF es entrada no fiable: Gubia solo propone, un humano aprueba. */
export const MAX_PAGINAS_PDF = 160;
export const PAGINAS_POR_LOTE = 6;
export const MAX_CANDIDATOS_LOTE = 100;
/** Límite por petición; una importación extensa se confirma en tantos lotes como necesite. */
export const MAX_CANDIDATOS_IMPORTACION = 100;
const categoriaId = z.enum(CATEGORIAS.map(c => c.id) as [string, ...string[]]);
export const candidatoProveedor = z.object({
  categoria: categoriaId,
  nombre: z.string().trim().min(3).max(120),
  referencia: z.string().trim().max(60).default(''),
  codigoDecor: z.string().trim().max(80).default(''),
  acabado: z.string().trim().max(80).default(''),
  soporte: z.string().trim().max(100).default(''),
  espesorMm: z.number().positive().max(1000).nullable().default(null),
  formato: z.string().trim().max(100).default(''),
  unidad: z.enum(['ud', 'm²', 'ml', 'm³', 'h', 'kg', 'l']).default('m²'),
  colorHex: z.string().regex(/^#[a-fA-F0-9]{6}$/).nullable().default(null),
  veta: z.enum(['sin-veta', 'vertical', 'horizontal', 'direccional']).nullable().default(null),
  brillo: z.enum(['mate', 'satinado', 'brillante']).nullable().default(null),
  pagina: z.number().int().min(1).max(MAX_PAGINAS_PDF),
  unidadesPaquete: z.number().int().positive().max(10000).nullable().default(null),
  familia: z.string().trim().max(120).default(''),
  codigoFamilia: z.string().trim().max(80).default(''),
  subcategoria: z.string().trim().max(80).default(''),
  tipoProducto: z.enum(['material', 'producto-variantes', 'configurable', 'a-medida', 'servicio']).default('material'),
  coleccion: z.string().trim().max(100).default(''),
  codigoVariante: z.string().trim().max(80).default(''),
  tratamiento: z.string().trim().max(80).default(''),
  calidad: z.string().trim().max(80).default(''),
  formatoUnidad: z.enum(['mm', 'cm', 'm', '']).default(''),
  unidadCompra: z.string().trim().max(30).default(''),
  unidadConsumo: z.string().trim().max(30).default(''),
  unidadPresupuesto: z.string().trim().max(30).default(''),
  factorConversion: z.number().positive().max(1_000_000).default(1),
  disponibilidad: z.enum(['disponible', 'bajo-pedido', 'sin-stock', 'desconocida']).default('desconocida'),
  propiedades: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  aplicaciones: z.array(z.string().trim().max(100)).max(30).default([]),
  confianza: z.number().min(0).max(1).nullable().default(null),
  revision: z.enum(['pendiente', 'verificado', 'ambiguo', 'rechazado']).default('pendiente'),
  evidencia: z.string().trim().max(1000).default(''),
  metodo: z.enum(['manual', 'pdfjs', 'groq-texto', 'groq-vision']).default('pdfjs'),
  configuracion: z.object({
    parametros: z.array(z.object({
      id: z.string().regex(/^[a-z][a-z0-9_]{0,30}$/), nombre: z.string().trim().min(1).max(80),
      tipo: z.enum(['medida', 'numero', 'opcion', 'texto', 'archivo']), unidad: z.string().max(20).optional(),
      min: z.number().optional(), max: z.number().optional(), paso: z.number().positive().optional(),
      opciones: z.array(z.string().max(80)).max(50).optional(), requerido: z.boolean().optional(),
    })).max(30),
    reglas: z.array(z.object({
      parametro: z.string().max(30), operador: z.enum(['eq', 'neq', 'min', 'max', 'in']),
      valor: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]), mensaje: z.string().max(200),
    })).max(100).default([]),
    bajoProyecto: z.boolean().default(false),
  }).nullable().default(null),
}).strict();
export type CandidatoProveedor = z.infer<typeof candidatoProveedor>;

export class ErrorImportacion extends Error {
  constructor(
    mensaje: string,
    public readonly estado = 400,
    /** Espera indicada por el proveedor externo antes de repetir la operación. */
    public readonly reintentarEnMs = 0,
  ) { super(mensaje); }
}

const nombreSeguro = (s: string) => s.trim().replace(/[^\p{L}\p{N}._\- ]/gu, '').slice(0, 90);
function idEstable(texto: string): string {
  let h = 2166136261;
  for (const char of texto) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  return 'prov-' + (h >>> 0).toString(36);
}
export function depurarCandidatos(datos: unknown, inicio: number, fin: number): CandidatoProveedor[] {
  return depurarConCuenta(datos, inicio, fin).lista;
}

/** Igual que depurarCandidatos, contando las fichas que no se han podido aprovechar. */
export function depurarConCuenta(datos: unknown, inicio: number, fin: number): { lista: CandidatoProveedor[]; descartadas: number } {
  const lista = Array.isArray(datos) ? datos : [];
  const vistos = new Set<string>(), salida: CandidatoProveedor[] = [];
  let descartadas = 0;
  for (const fila of lista.slice(0, MAX_CANDIDATOS_LOTE)) {
    const r = candidatoProveedor.safeParse(coaccionarCandidato(fila, inicio === fin ? inicio : null));
    if (!r.success || r.data.pagina < inicio || r.data.pagina > fin) { descartadas++; continue; }
    const k = clave(r.data, '');
    if (!vistos.has(k)) { vistos.add(k); salida.push(r.data); }
  }
  return { lista: salida, descartadas };
}

// ---------- Fichas tolerantes ----------
// Cada proveedor maqueta su catálogo a su manera y la IA devuelve lo que lee:
// «Tableros», «m2», «19 mm», un campo «precio»… Antes, cualquier detalle así
// tiraba la ficha entera sin avisar. Aquí se lleva cada valor a la forma que
// espera el esquema (y lo que sobra va a «propiedades»); solo se descarta lo
// que no tiene nombre o categoría reconocible.
const sinAcentos = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const SINONIMOS_CATEGORIA: [string, RegExp][] = [
  ['cantos', /\bcanto/],
  ['encimeras', /encimera|compacto de cocina/],
  ['chapas', /\bchapa|laminad|\bhpl\b|formica|\bcpl\b/],
  ['macizos', /maciz|liston|tablon|madera solida/],
  ['tableros', /tabler|aglomerad|\bmdf\b|melamin|contrachap|\bosb\b|dm\b|panel|fibras/],
  ['cristal', /cristal|vidrio|espejo/],
  ['tiradores', /tirador|pomo|\bgola\b|uñero|unero/],
  ['herrajes', /herraj|bisagra|corredera|\bguia|cerradura|amortigu|piston|pata|soporte de balda|cazoleta/],
  ['iluminacion', /ilumin|\bled\b|\bluz|\bfoco|tira led/],
  ['accesorios', /accesori|organizador|cubo|colgador|barra de colgar|zapatero|cesta|bandeja/],
  ['consumibles', /consumibl|\bcola\b|adhesiv|tornill|silicon|lija|clavo|espiga/],
  ['acabados', /barniz|\blaca|aceite|tinte|pintura|acabado/],
];
export function categoriaDe(valor: unknown, nombre = ''): string | null {
  const ids = CATEGORIAS.map((c) => c.id);
  const t = typeof valor === 'string' ? sinAcentos(valor) : '';
  if (ids.includes(t)) return t;
  for (const texto of [t, sinAcentos(nombre)]) for (const [id, re] of SINONIMOS_CATEGORIA) if (texto && re.test(texto)) return id;
  return null;
}
export function unidadDe(valor: unknown): CandidatoProveedor['unidad'] | undefined {
  const t = typeof valor === 'string' ? sinAcentos(valor).replace(/[.\s]/g, '') : '';
  if (!t) return undefined;
  if (/^(m2|m²|mc|metroscuadrados?|m\^2)$/.test(t)) return 'm²';
  if (/^(ml|metroslineales?|metrolineal|mlineal|m)$/.test(t)) return 'ml';
  if (/^(m3|m³|metroscubicos?)$/.test(t)) return 'm³';
  if (/^(ud|uds|u|unidad(es)?|pieza|pza|pz|unid|und|pack|paquete|caja|juego)$/.test(t)) return 'ud';
  if (/^(kg|kilo|kilos)$/.test(t)) return 'kg';
  if (/^(l|lt|litros?)$/.test(t)) return 'l';
  if (/^(h|hora|horas)$/.test(t)) return 'h';
  return undefined;
}
export function numeroDe(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== 'string') return null;
  const m = valor.replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)*(?:[.,]\d+)?/);
  if (!m) return null;
  let n = m[0];
  // «1.234,56» (español) o «1,234.56»: el último separador es el decimal.
  const ultimo = Math.max(n.lastIndexOf(','), n.lastIndexOf('.'));
  if (ultimo >= 0 && n.length - ultimo - 1 !== 3) n = n.slice(0, ultimo).replace(/[.,]/g, '') + '.' + n.slice(ultimo + 1);
  else n = n.replace(/[.,]/g, '');
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}
const LARGOS: Record<string, number> = { nombre: 120, referencia: 60, codigoDecor: 80, acabado: 80, soporte: 100, formato: 100, familia: 120,
  codigoFamilia: 80, subcategoria: 80, coleccion: 100, codigoVariante: 80, tratamiento: 80, calidad: 80, unidadCompra: 30,
  unidadConsumo: 30, unidadPresupuesto: 30, evidencia: 1000 };
const ENUMS: Record<string, readonly string[]> = {
  veta: ['sin-veta', 'vertical', 'horizontal', 'direccional'], brillo: ['mate', 'satinado', 'brillante'],
  tipoProducto: ['material', 'producto-variantes', 'configurable', 'a-medida', 'servicio'],
  formatoUnidad: ['mm', 'cm', 'm', ''], disponibilidad: ['disponible', 'bajo-pedido', 'sin-stock', 'desconocida'],
  revision: ['pendiente', 'verificado', 'ambiguo', 'rechazado'], metodo: ['manual', 'pdfjs', 'groq-texto', 'groq-vision'],
};
const CONOCIDOS = new Set(Object.keys(candidatoProveedor.shape));
const escalar = (v: unknown): string | number | boolean | null =>
  v === null || ['string', 'number', 'boolean'].includes(typeof v) ? (typeof v === 'string' ? v.slice(0, 300) : (v as number | boolean | null)) : Array.isArray(v) ? v.map(String).join(', ').slice(0, 300) : JSON.stringify(v).slice(0, 300);

export function coaccionarCandidato(fila: unknown, paginaPorDefecto: number | null): unknown {
  if (!fila || typeof fila !== 'object' || Array.isArray(fila)) return fila;
  const x: Record<string, unknown> = { ...(fila as Record<string, unknown>) };
  const nombre = typeof x.nombre === 'string' ? x.nombre : typeof x.descripcion === 'string' ? x.descripcion : '';
  if (!x.nombre && nombre) x.nombre = nombre;
  const categoria = categoriaDe(x.categoria, nombre);
  if (categoria) x.categoria = categoria;
  const propiedades: Record<string, string | number | boolean | null> = {};
  if (x.propiedades && typeof x.propiedades === 'object' && !Array.isArray(x.propiedades))
    for (const [k, v] of Object.entries(x.propiedades as Record<string, unknown>)) propiedades[k.slice(0, 40)] = escalar(v);
  // Lo que el esquema no conoce (precio, descripción, medidas…) no tira la ficha: va a propiedades.
  for (const k of Object.keys(x)) {
    if (CONOCIDOS.has(k)) continue;
    const v = x[k];
    delete x[k];
    if (v === null || v === undefined || v === '') continue;
    if (/precio|pvp|tarifa|importe|coste/i.test(k)) { const n = numeroDe(v); if (n !== null && n > 0) propiedades.precioTarifa = n; else propiedades[k.slice(0, 40)] = escalar(v); }
    else propiedades[k.slice(0, 40)] = escalar(v);
  }
  if (typeof propiedades.precioTarifa === 'string') { const n = numeroDe(propiedades.precioTarifa); propiedades.precioTarifa = n !== null && n > 0 ? n : null; }
  x.propiedades = propiedades;
  for (const [k, max] of Object.entries(LARGOS)) {
    if (x[k] === null || x[k] === undefined) { delete x[k]; continue; }
    if (typeof x[k] === 'number') x[k] = String(x[k]);
    if (typeof x[k] === 'string') x[k] = (x[k] as string).trim().slice(0, max);
    else delete x[k];
  }
  for (const [k, valores] of Object.entries(ENUMS)) {
    if (x[k] === undefined) continue;
    const t = typeof x[k] === 'string' ? sinAcentos(x[k] as string).replace(/\s+/g, '-') : '';
    if (valores.includes(t)) x[k] = t;
    else if (k === 'veta' || k === 'brillo') x[k] = null;
    else delete x[k];
  }
  const u = unidadDe(x.unidad);
  if (u) x.unidad = u; else delete x.unidad;
  const espesor = x.espesorMm === null ? null : numeroDe(x.espesorMm);
  x.espesorMm = espesor !== null && espesor > 0 && espesor <= 1000 ? espesor : null;
  const paq = numeroDe(x.unidadesPaquete);
  x.unidadesPaquete = paq !== null && paq >= 1 && paq <= 10000 ? Math.round(paq) : null;
  const factor = numeroDe(x.factorConversion);
  if (factor !== null && factor > 0 && factor <= 1_000_000) x.factorConversion = factor; else delete x.factorConversion;
  const confianza = numeroDe(x.confianza);
  x.confianza = confianza !== null ? Math.min(1, Math.max(0, confianza > 1 ? confianza / 100 : confianza)) : null;
  if (typeof x.colorHex === 'string') {
    const c = x.colorHex.trim();
    x.colorHex = /^#[a-f0-9]{6}$/i.test(c) ? c : /^#[a-f0-9]{3}$/i.test(c) ? '#' + [...c.slice(1)].map((d) => d + d).join('') : null;
  } else x.colorHex = null;
  const pagina = numeroDe(x.pagina);
  x.pagina = pagina !== null && Number.isInteger(pagina) && pagina >= 1 ? pagina : paginaPorDefecto ?? x.pagina;
  if (typeof x.aplicaciones === 'string') x.aplicaciones = [x.aplicaciones];
  if (Array.isArray(x.aplicaciones)) x.aplicaciones = x.aplicaciones.map((a) => String(a).slice(0, 100)).slice(0, 30);
  else delete x.aplicaciones;
  if (x.configuracion !== undefined && x.configuracion !== null && (typeof x.configuracion !== 'object' || Array.isArray(x.configuracion))) x.configuracion = null;
  return x;
}

/** Precio de tarifa declarado por el proveedor (si lo hay): es el coste del carpintero. */
export const precioTarifa = (a: CandidatoProveedor): number => {
  const p = a.propiedades.precioTarifa;
  return typeof p === 'number' && p > 0 && p < 1_000_000 ? Math.round(p * 100) / 100 : 0;
};

/** Muestra real recortada en el navegador, máximo 24 KB WebP por material. */
export function muestraWebp(valor: unknown): Uint8Array | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor !== 'string' || valor.length > 35000 ||
    !/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(valor))
    throw new ErrorImportacion('La muestra visual debe ser WebP y ocupar menos de 24 KB.');
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(valor.split(',')[1] ?? ''),c=>c.charCodeAt(0)); }
  catch { throw new ErrorImportacion('La imagen recortada no es válida.'); }
  if (!bytes.length || bytes.length > 24000 || tipoDeImagen(bytes)?.tipo !== 'image/webp')
    throw new ErrorImportacion('La muestra visual no es una imagen WebP válida.');
  return bytes;
}

/** Las fichas llegan del texto o imagen local interpretados por Groq, no del PDF original. */

export async function importarCandidatos(
  repos: Repositorios, proveedor: string, filename: string, candidatos: unknown, email: string, muestras: unknown = [],
  lote?: { importacionId: string; loteId: string; totalSeleccionados?: number },
) {
  const nombreProveedor = nombreSeguro(proveedor);
  if (nombreProveedor.length < 2 || nombreProveedor.length > 80) throw new ErrorImportacion('Indica un proveedor válido.');
  if (!Array.isArray(candidatos) || candidatos.length > MAX_CANDIDATOS_IMPORTACION)
    throw new ErrorImportacion(`Cada lote puede contener como máximo ${MAX_CANDIDATOS_IMPORTACION} materiales.`);
  if (!Array.isArray(muestras) || muestras.length > candidatos.length) throw new ErrorImportacion('Las muestras no coinciden con la selección.');
  const actuales = await repos.catalogo.articulos({ incluirArchivados: true });
  const conocidos = new Set(actuales.map(a => clave({
    categoria: a.categoria, nombre: a.nombre, referencia: a.referencia,
    soporte: a.visual?.soporte, codigoDecor: a.visual?.codigoDecor || '', espesorMm: a.espesor,
    formato: a.notas.match(/Formato: ([^;]+)/)?.[1] || '', acabado: a.acabado,
  }, a.proveedor)));
  const ids = new Set(actuales.map(a => a.id));
  const importacionId = lote?.importacionId && /^[a-zA-Z0-9_-]{8,100}$/.test(lote.importacionId) ? lote.importacionId : '';
  const loteId = lote?.loteId && /^[a-zA-Z0-9_-]{1,100}$/.test(lote.loteId) ? lote.loteId : '';
  if ((lote?.importacionId || lote?.loteId) && (!importacionId || !loteId)) throw new ErrorImportacion('Identificador de lote no válido.');
  if (importacionId && repos.catalogo.guardarImportacion) {
    const anterior = await repos.catalogo.importacion?.(importacionId);
    if(!anterior) await repos.catalogo.guardarImportacion({
      id: importacionId, proveedor: nombreProveedor, documento: nombreSeguro(filename), estado: 'confirmando',
      detectados: lote?.totalSeleccionados ?? candidatos.length, seleccionados: lote?.totalSeleccionados ?? candidatos.length,
      validados: 0, creados: 0, actualizados: 0, duplicados: 0, rechazados: 0,
      pendientes: lote?.totalSeleccionados ?? candidatos.length, errores: [],
    }, email);
    if (repos.catalogo.reservarLoteImportacion && !(await repos.catalogo.reservarLoteImportacion(importacionId, loteId, email)))
      return { creados: 0, actualizados: 0, duplicados: 0, rechazados: 0, validados: 0, pendientes: 0, loteDuplicado: true };
    if(anterior)await repos.catalogo.guardarImportacion({ ...anterior, estado: 'confirmando' },email);
  }
  let creados = 0, duplicados = 0, rechazados = 0, validados = 0;
  const actualizados = 0;
  const errores: Array<{ referencia: string; mensaje: string; pagina: number | null }> = [];

  const guardarEstructura = async (a: CandidatoProveedor, articuloId: string) => {
    if (!repos.catalogo.guardarFamilia || !repos.catalogo.guardarVariante) return;
    const familiaNombre = (a.familia || a.soporte || a.nombre.replace(/\s+\d{3,4}\s*[x×]\s*\d{3,4}.*$/i, '').replace(/\s+\d+(?:[,.]\d+)?\s*mm.*$/i, '')).trim().slice(0, 120);
    const familiaId = idEstable(claveNormalizada('familia', nombreProveedor, a.codigoFamilia || familiaNombre, a.categoria));
    const origen: OrigenCatalogo = { proveedor: nombreProveedor, documento: nombreSeguro(filename), pagina: a.pagina,
      metodo: a.metodo, confianza: a.confianza, revision: a.revision, ...(a.evidencia ? { textoOriginal: a.evidencia } : {}) };
    const familia: Omit<FamiliaCatalogo, 'actualizado'> = {
      id: familiaId, codigo: a.codigoFamilia, nombre: familiaNombre, descripcion: '', categoria: a.categoria,
      subcategoria: a.subcategoria, tipo: a.tipoProducto, proveedor: nombreProveedor, fabricante: nombreProveedor,
      coleccion: a.coleccion, aplicaciones: a.aplicaciones, estado: a.revision === 'verificado' ? 'activo' : 'pendiente', origen,
    };
    await repos.catalogo.guardarFamilia(familia, email);
    const decorativoIds: string[] = [];
    if ((a.codigoDecor || a.acabado) && repos.catalogo.guardarDecorativo) {
      const decorativoId = idEstable(claveNormalizada('decorativo', nombreProveedor, a.coleccion, a.codigoDecor || a.acabado));
      const decorativo: Omit<DecorativoCatalogo, 'actualizado'> = {
        id: decorativoId, fabricante: nombreProveedor, coleccion: a.coleccion, codigo: a.codigoDecor,
        nombre: a.acabado || a.nombre, familiaCromatica: '', colorDigital: a.colorHex, muestra: '', textura: '',
        veta: a.veta, brillo: a.brillo, acabadoSuperficial: a.acabado, especie: '', fuente: '', licencia: '',
        verificadoEl: a.revision === 'verificado' ? new Date().toISOString().slice(0, 10) : null, origen,
      };
      await repos.catalogo.guardarDecorativo(decorativo, email);
      decorativoIds.push(decorativoId);
    }
    const dimensiones = normalizarDimensiones(a.formato, a.espesorMm, a.formatoUnidad);
    const variante: Omit<VarianteCatalogo, 'actualizado'> = {
      id: idEstable(claveNormalizada('variante', nombreProveedor, a.referencia, a.codigoVariante, familiaId, a.soporte,
        dimensiones.largoMm, dimensiones.anchoMm, dimensiones.espesorMm, a.acabado, a.tratamiento, a.calidad)),
      familiaId, articuloId, referencia: a.referencia, codigo: a.codigoVariante, codigoDecorativo: a.codigoDecor,
      soporte: a.soporte, dimensiones, acabado: a.acabado, tratamiento: a.tratamiento, calidad: a.calidad,
      propiedades: a.propiedades, unidadCompra: a.unidadCompra || a.unidad, unidadConsumo: a.unidadConsumo || a.unidad,
      unidadPresupuesto: a.unidadPresupuesto || a.unidad, unidadesPaquete: a.unidadesPaquete,
      factorConversion: a.factorConversion, disponibilidad: a.disponibilidad,
      estado: a.revision === 'verificado' ? 'activo' : 'pendiente', decorativoIds, origen,
    };
    await repos.catalogo.guardarVariante(variante, email);
    if (a.configuracion && repos.catalogo.guardarConfigurable) await repos.catalogo.guardarConfigurable({
      id: idEstable(claveNormalizada('configurable', familiaId, a.codigoVariante || a.nombre)), familiaId,
      nombre: a.nombre, parametros: a.configuracion.parametros, reglas: a.configuracion.reglas,
      plantillaId: null, bajoProyecto: a.configuracion.bajoProyecto, origen,
    }, email);
  };
  for (const [indice, dato] of candidatos.entries()) {
    const r = candidatoProveedor.safeParse(dato);
    if (!r.success) { rechazados++; errores.push({referencia:'',mensaje:r.error.issues[0]?.message ?? 'Ficha no válida',pagina:null}); continue; }
    const a = r.data;
    const categoria = CATEGORIAS.find(c => c.id === a.categoria && !['mano-obra','servicios'].includes(c.id));
    if (!categoria) { rechazados++; errores.push({referencia:a.referencia,mensaje:'Categoría no importable',pagina:a.pagina}); continue; }
    const k = clave(a, nombreProveedor), id = idEstable(k);
    if (conocidos.has(k) || ids.has(id)) { await guardarEstructura(a, id); duplicados++; validados++; continue; }
    let bytes: Uint8Array | null;
    try { bytes = muestraWebp(muestras[indice]); }
    catch { rechazados++; errores.push({referencia:a.referencia,mensaje:'Muestra visual no válida',pagina:a.pagina}); continue; }
    const rutaMuestra = bytes ? 'catalogo-materiales/' + id + '/muestra.webp' : '';
    const visual = {
      fabricante: nombreProveedor,
      ...(a.soporte ? {soporte:a.soporte} : {}),
      ...(rutaMuestra ? { textura: '/api/panel/catalogo-muestra?ruta=' + encodeURIComponent(rutaMuestra) } : {}),
      ...(a.codigoDecor ? { codigoDecor: a.codigoDecor } : {}),
      ...(a.soporte ? { soporte: a.soporte } : {}),
      ...(a.colorHex ? { colorHex: a.colorHex } : {}),
      ...(a.veta ? { veta: a.veta } : {}),
      ...(a.brillo ? { brillo: a.brillo } : {}),
    };
    const notas = [
      'Importado desde PDF', 'Documento: ' + nombreSeguro(filename), 'Página: ' + a.pagina,
      ...(a.formato ? ['Formato: ' + a.formato] : []),
      ...(a.unidadesPaquete ? ['Unidades por paquete: ' + a.unidadesPaquete] : []),
      ...(a.colorHex ? ['Color digital aproximado; comprobar muestra física'] : []),
      precioTarifa(a) ? 'Coste tomado de la tarifa del PDF; compruébalo' : 'Precio pendiente de confirmar',
    ].join('; ').slice(0, 500);
    const validado = esquemaArticulo.safeParse({
      id, categoria: categoria.id, nombre: a.nombre, unidad: a.unidad,
      coste: precioTarifa(a), merma: categoria.merma, margen: MARGEN_PROPUESTO, precioFijo: null,
      referencia: a.referencia, proveedor: nombreProveedor, espesor: a.espesorMm,
      acabado: a.acabado, notas, visual,
    });
    if (!validado.success) { rechazados++; errores.push({referencia:a.referencia,mensaje:validado.error.issues[0]?.message ?? 'Artículo no válido',pagina:a.pagina}); continue; }
    // Crear primero el artículo de forma idempotente: no guardar imágenes
    // de IDs ya existentes, ni sobrescribir las muestras editadas manualmente.
    const insertado = repos.catalogo.insertarArticuloSiNuevo
      ? await repos.catalogo.insertarArticuloSiNuevo({ ...validado.data, id }, email, bytes ? {ruta:rutaMuestra,bytes} : undefined)
      : !(await repos.catalogo.articulo(id)) && (await repos.catalogo.guardarArticulo({ ...validado.data, id }, email), true);
    ids.add(id); conocidos.add(k);
    if (!insertado) { duplicados++; continue; }
    creados++;
    validados++;
    await guardarEstructura(a, id);
    // La ficha ya está creada, la muestra privada es un recurso complementario.
    // Un fallo aquí debe informarse, no reintentar la creación como un duplicado.
    if (bytes && rutaMuestra && !repos.catalogo.insertarArticuloSiNuevo)
      await repos.fotos.guardar({ruta:rutaMuestra,tipo:'image/webp',bytes},email);
  }
  const resumen = {creados, actualizados, duplicados, rechazados, validados};
  if (importacionId && repos.catalogo.completarLoteImportacion) await repos.catalogo.completarLoteImportacion(importacionId, loteId, resumen, email);
  if (importacionId && repos.catalogo.guardarImportacion) {
    const anterior = await repos.catalogo.importacion?.(importacionId);
    if (anterior) {
      const procesados = anterior.creados + anterior.actualizados + anterior.duplicados + anterior.rechazados + creados + actualizados + duplicados + rechazados;
      const pendientes = Math.max(0, anterior.seleccionados - procesados);
      await repos.catalogo.guardarImportacion({ ...anterior, estado: pendientes ? 'parcial' : 'completada',
        validados: anterior.validados + validados, creados: anterior.creados + creados, actualizados: anterior.actualizados + actualizados,
        duplicados: anterior.duplicados + duplicados, rechazados: anterior.rechazados + rechazados, pendientes,
        errores: [...anterior.errores, ...errores].slice(-500) }, email);
    }
  }
  if (creados) await repos.auditoria.registrar(email, 'importación catálogo PDF', nombreProveedor + ': ' + creados + ' nuevos, ' + duplicados + ' duplicados, ' + rechazados + ' rechazados');
  return {...resumen, pendientes: Math.max(0, candidatos.length - validados - rechazados), errores};
}
