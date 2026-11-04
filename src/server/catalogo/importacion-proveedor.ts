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
  const lista = Array.isArray(datos) ? datos : [];
  const vistos = new Set<string>(), salida: CandidatoProveedor[] = [];
  for (const fila of lista.slice(0, MAX_CANDIDATOS_LOTE)) {
    const r = candidatoProveedor.safeParse(fila);
    if (!r.success || r.data.pagina < inicio || r.data.pagina > fin) continue;
    const k = clave(r.data, '');
    if (!vistos.has(k)) { vistos.add(k); salida.push(r.data); }
  }
  return salida;
}

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
  let creados = 0, actualizados = 0, duplicados = 0, rechazados = 0, validados = 0;
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
      'Precio pendiente de confirmar',
    ].join('; ').slice(0, 500);
    const validado = esquemaArticulo.safeParse({
      id, categoria: categoria.id, nombre: a.nombre, unidad: a.unidad,
      coste: 0, merma: categoria.merma, margen: MARGEN_PROPUESTO, precioFijo: null,
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
