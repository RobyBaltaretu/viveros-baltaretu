import { z } from 'astro/zod';
import { CATEGORIAS, MARGEN_PROPUESTO, esquemaArticulo } from './catalogo.ts';
import type { Repositorios } from '../data/tipos.ts';
import { tipoDeImagen } from '../panel/fotos.ts';

/** El PDF es entrada no fiable: Gubia solo propone, un humano aprueba. */
export const MAX_PAGINAS_PDF = 160;
export const PAGINAS_POR_LOTE = 6;
export const MAX_CANDIDATOS_LOTE = 100;
export const MAX_CANDIDATOS_IMPORTACION = 400;
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
}).strict();
export type CandidatoProveedor = z.infer<typeof candidatoProveedor>;

export class ErrorImportacion extends Error {
  constructor(mensaje: string, public readonly estado = 400) { super(mensaje); }
}

const nombreSeguro = (s: string) => s.trim().replace(/[^\p{L}\p{N}._\- ]/gu, '').slice(0, 90);
const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
const clave = (c: Pick<CandidatoProveedor, 'categoria' | 'nombre' | 'referencia' | 'espesorMm' | 'formato' | 'acabado' | 'codigoDecor'>, proveedor: string) =>
  [normal(proveedor), c.categoria, normal(c.referencia || c.codigoDecor || c.nombre), String(c.espesorMm ?? ''), normal(c.formato), normal(c.acabado)].join('|');
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

export async function importarCandidatos(repos: Repositorios, proveedor: string, filename: string, candidatos: unknown, email: string, muestras: unknown = []) {
  const nombreProveedor = nombreSeguro(proveedor);
  if (nombreProveedor.length < 2 || nombreProveedor.length > 80) throw new ErrorImportacion('Indica un proveedor válido.');
  if (!Array.isArray(candidatos) || candidatos.length > MAX_CANDIDATOS_IMPORTACION)
    throw new ErrorImportacion('El lote no puede superar 400 materiales.');
  if (!Array.isArray(muestras) || muestras.length > candidatos.length) throw new ErrorImportacion('Las muestras no coinciden con la selección.');
  const actuales = await repos.catalogo.articulos({ incluirArchivados: true });
  const conocidos = new Set(actuales.map(a => clave({
    categoria: a.categoria, nombre: a.nombre, referencia: a.referencia,
    codigoDecor: a.visual?.codigoDecor || '', espesorMm: a.espesor,
    formato: a.notas.match(/Formato: ([^;]+)/)?.[1] || '', acabado: a.acabado,
  }, a.proveedor)));
  const ids = new Set(actuales.map(a => a.id));
  let creados = 0, duplicados = 0, rechazados = 0;
  for (const [indice, dato] of candidatos.entries()) {
    const r = candidatoProveedor.safeParse(dato);
    if (!r.success) { rechazados++; continue; }
    const a = r.data;
    const categoria = CATEGORIAS.find(c => c.id === a.categoria && !['mano-obra','servicios'].includes(c.id));
    if (!categoria) { rechazados++; continue; }
    const k = clave(a, nombreProveedor), id = idEstable(k);
    if (conocidos.has(k) || ids.has(id)) { duplicados++; continue; }
    let bytes: Uint8Array | null;
    try { bytes = muestraWebp(muestras[indice]); }
    catch { rechazados++; continue; }
    const rutaMuestra = bytes ? 'catalogo-materiales/' + id + '/muestra.webp' : '';
    const visual = {
      fabricante: nombreProveedor,
      ...(rutaMuestra ? { textura: '/api/panel/foto?ruta=' + encodeURIComponent(rutaMuestra) } : {}),
      ...(a.codigoDecor ? { codigoDecor: a.codigoDecor } : {}),
      ...(a.soporte ? { soporte: a.soporte } : {}),
      ...(a.colorHex ? { colorHex: a.colorHex } : {}),
      ...(a.veta ? { veta: a.veta } : {}),
      ...(a.brillo ? { brillo: a.brillo } : {}),
    };
    const notas = [
      'Importado desde PDF', 'Documento: ' + nombreSeguro(filename), 'Página: ' + a.pagina,
      ...(a.formato ? ['Formato: ' + a.formato] : []),
      ...(a.colorHex ? ['Color digital aproximado; comprobar muestra física'] : []),
      'Precio pendiente de confirmar',
    ].join('; ').slice(0, 500);
    const validado = esquemaArticulo.safeParse({
      id, categoria: categoria.id, nombre: a.nombre, unidad: a.unidad,
      coste: 0, merma: categoria.merma, margen: MARGEN_PROPUESTO, precioFijo: null,
      referencia: a.referencia, proveedor: nombreProveedor, espesor: a.espesorMm,
      acabado: a.acabado, notas, visual,
    });
    if (!validado.success) { rechazados++; continue; }
    // Crear primero el artículo de forma idempotente: no guardar imágenes
    // de IDs ya existentes, ni sobrescribir las muestras editadas manualmente.
    const insertado = repos.catalogo.insertarArticuloSiNuevo
      ? await repos.catalogo.insertarArticuloSiNuevo({ ...validado.data, id }, email)
      : !(await repos.catalogo.articulo(id)) && (await repos.catalogo.guardarArticulo({ ...validado.data, id }, email), true);
    ids.add(id); conocidos.add(k);
    if (!insertado) { duplicados++; continue; }
    creados++;
    // La ficha ya está creada, la muestra privada es un recurso complementario.
    // Un fallo aquí debe informarse, no reintentar la creación como un duplicado.
    if (bytes && rutaMuestra)
      await repos.fotos.guardar({ruta:rutaMuestra,tipo:'image/webp',bytes},email);
  }
  if (creados) await repos.auditoria.registrar(email, 'importación catálogo PDF', nombreProveedor + ': ' + creados + ' nuevos, ' + duplicados + ' duplicados, ' + rechazados + ' rechazados');
  return {creados, duplicados, rechazados};
}
