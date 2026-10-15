import { z } from 'astro/zod';
import { FAMILIAS, FORMATOS, DISPONIBILIDADES } from '../../lib/catalogo/schema';
import type { Coleccion, EstadoPresupuesto, Factura, Repositorios, Usuario } from '../data/tipos.ts';
import { clienteVacio, faltaCliente, leerCliente, lineaVacia, nuevaFactura, rectificativaDe, NOMBRE_ESTADO, vencida } from '../facturas/facturas.ts';
import { calcularTotales, dinero, IVA_POR_DEFECTO, TIPOS_IVA } from '../facturas/importes.ts';
import { nifValido } from '../facturas/nif.ts';
import { avisosDe, CATEGORIAS, gastoVacio, nombreCategoria } from '../gastos/gastos.ts';
import { cifras, cobros, conclusiones, conversion, evolucionMensual, gastosPorCategoria, masVendido, mejoresClientes, periodoAnterior, periodoDe } from '../informes/informes.ts';
import { ajustesFacturacion, emitirFactura } from '../panel/facturacion.ts';
import { puede, type Accion } from '../panel/permisos.ts';
import { guardarPlanta, revisarPlanta, seoPorDefecto, slugDesde, type DatosPlanta } from '../panel/plantas.ts';
import { describirCambio, describirPendiente, publicarCambios, type EntornoPublicar } from '../panel/publicar.ts';
import { guardarTextos, SECCIONES } from '../panel/textos.ts';
import { buscarPlanta, normalizar } from './coincidencia.ts';

/**
 * Herramientas del asistente: lo único que puede hacer el modelo.
 *
 * - Las de **consulta** leen datos (filtrados por los permisos de la persona) y
 *   devuelven solo lo necesario.
 * - Las de **cambio** nunca cambian nada al llamarlas: validan y preparan una
 *   propuesta con un resumen; se aplica solo si la persona pulsa «Sí», y al
 *   aplicarla se vuelve a validar con las mismas reglas del panel.
 *
 * Los textos que vienen de la base (nombres, mensajes de clientes, tickets) son
 * datos: nunca instrucciones para el asistente.
 */
export interface Contexto {
  repos: Repositorios;
  usuario: Usuario;
  hoy: string;
  env: EntornoPublicar;
}

type Preparado<A> = { ok: true; resumen: string; argumentos: A } | { ok: false; error: string };
type Aplicado = { ok: boolean; texto: string };

interface Base<A> {
  nombre: string;
  descripcion: string;
  permiso: Accion;
  esquema: z.ZodType<A>;
}
export interface Consulta<A = unknown> extends Base<A> {
  tipo: 'consulta';
  consultar(ctx: Contexto, a: A): Promise<unknown>;
}
export interface Cambio<A = unknown> extends Base<A> {
  tipo: 'cambio';
  preparar(ctx: Contexto, a: A): Promise<Preparado<A>>;
  aplicar(ctx: Contexto, a: A): Promise<Aplicado>;
}
export type Herramienta = Consulta<never> | Cambio<never>;

const consulta = <A>(h: Omit<Consulta<A>, 'tipo'>) => ({ ...h, tipo: 'consulta' as const }) as unknown as Herramienta;
const cambio = <A>(h: Omit<Cambio<A>, 'tipo'>) => ({ ...h, tipo: 'cambio' as const }) as unknown as Herramienta;

const autor = (ctx: Contexto) => ({ email: ctx.usuario.email, origen: 'asistente' as const });
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('AAAA-MM-DD');
const opcional = <T extends z.ZodType>(t: T) => t.optional().nullable();
const recortar = (t: unknown, n = 160) => (typeof t === 'string' && t.length > n ? `${t.slice(0, n)}…` : t);

/* ---------------- Plantas ---------------- */

interface PlantaCandidata {
  id: string;
  nombres: string[];
  nombre: string;
  nombreCientifico?: string;
  datos: DatosPlanta;
  archivada: boolean;
}
async function plantas(repos: Repositorios, incluirQuitadas = false): Promise<PlantaCandidata[]> {
  const entradas = await repos.contenido.listar('catalogo', { incluirArchivadas: incluirQuitadas });
  return entradas.map((e) => {
    const d = e.borrador.datos as DatosPlanta;
    const nombre = String(d.nombre?.es ?? e.id);
    return { id: e.id, nombres: [nombre, String(d.nombre?.en ?? ''), String(d.nombreCientifico ?? ''), e.id.replace(/-/g, ' ')].filter(Boolean), nombre, nombreCientifico: String(d.nombreCientifico ?? ''), datos: d, archivada: e.archivada };
  });
}
const fichaCorta = (p: PlantaCandidata) => ({
  id: p.id,
  nombre: p.nombre,
  cientifico: p.datos.nombreCientifico,
  familia: p.datos.familia,
  disponibilidad: p.datos.disponibilidad,
  precioDesde: p.datos.precioDesde ?? null,
  ventaUnitaria: Boolean(p.datos.ventaUnitaria),
  precioUnidad: p.datos.precioUnidad ?? null,
  alturas: `${p.datos.alturaMin}–${p.datos.alturaMax} m`,
  enLaWeb: Boolean(p.datos.revisado) && !p.datos.datosDeEjemplo && !p.archivada,
  quitada: p.archivada,
});
async function unaPlanta(repos: Repositorios, texto: string, incluirQuitadas = false): Promise<{ ok: true; planta: PlantaCandidata } | { ok: false; error: string }> {
  const lista = await plantas(repos, incluirQuitadas);
  const exacta = lista.find((p) => p.id === texto);
  if (exacta) return { ok: true, planta: exacta };
  const r = buscarPlanta(texto, lista);
  if (r.tipo === 'una') return { ok: true, planta: r.elegida };
  if (r.tipo === 'varias') return { ok: false, error: `Hay varias plantas que encajan: ${r.opciones.map((o) => `${o.nombre} (id ${o.id})`).join(', ')}. Pregunta cuál.` };
  return { ok: false, error: `No hay ninguna planta que se llame «${texto}».` };
}

const CAMBIOS_PLANTA = z.object({
  precioDesde: opcional(z.number().positive().max(100000)).describe('Precio al por mayor «desde», en euros; null = «precio bajo presupuesto»'),
  ventaUnitaria: opcional(z.boolean()),
  precioUnidad: opcional(z.number().positive().max(100000)).describe('Precio de una planta suelta (solo si ventaUnitaria)'),
  disponibilidad: opcional(z.enum(DISPONIBILIDADES)),
  destacada: opcional(z.boolean()),
  revisado: opcional(z.boolean()).describe('true = lista para salir en la web'),
  alturaMin: opcional(z.number().positive()),
  alturaMax: opcional(z.number().positive().max(4)),
  perimetroTroncoCm: opcional(z.number().positive()),
  formatos: opcional(z.array(z.enum(FORMATOS))),
  familia: opcional(z.enum(FAMILIAS)),
  origen: opcional(z.string().max(120)),
  nombreCientifico: opcional(z.string().max(120)),
  nombre_es: opcional(z.string().min(2).max(80)),
  nombre_en: opcional(z.string().min(2).max(80)),
  descripcion_es: opcional(z.string().min(10).max(1200)),
  descripcion_en: opcional(z.string().min(10).max(1200)),
});
type CambiosPlanta = z.infer<typeof CAMBIOS_PLANTA>;

function aplicarCambiosPlanta(d: DatosPlanta, c: CambiosPlanta): DatosPlanta {
  const n = structuredClone(d) as DatosPlanta & Record<string, unknown>;
  for (const [k, v] of Object.entries(c)) {
    if (v === undefined) continue;
    if (k === 'nombre_es' || k === 'nombre_en') n.nombre = { ...(n.nombre as object), [k.slice(-2)]: v };
    else if (k === 'descripcion_es' || k === 'descripcion_en') n.descripcion = { ...(n.descripcion as object), [k.slice(-2)]: v };
    else n[k] = v;
  }
  if (n.ventaUnitaria === false) n.precioUnidad = null;
  n.seo = seoPorDefecto(n);
  return n;
}
const describirCambiosPlanta = (c: CambiosPlanta) =>
  Object.entries(c)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k.replace('_es', ' (español)').replace('_en', ' (inglés)')}: ${typeof v === 'number' && /precio/i.test(k) ? dinero(v) : v === null ? 'sin valor' : Array.isArray(v) ? v.join(', ') : String(recortar(v, 60))}`)
    .join('; ');

type NuevaPlanta = Record<string, unknown> & {
  nombre_es: string;
  nombre_en?: string | null;
  descripcion_es: string;
  descripcion_en?: string | null;
  alturaMin: number;
  alturaMax: number;
  precioDesde?: number | null;
  origen?: string | null;
  ventaUnitaria?: boolean | null;
};

/* ---------------- Plantas en bloque ---------------- */

/** Qué plantas: una lista concreta, un filtro o todas. Los filtros se suman (todas las condiciones). */
const SELECCION_PLANTAS = z.object({
  todas: opcional(z.boolean()).describe('true = todo el catálogo (con los demás filtros, si los hay)'),
  plantas: opcional(z.array(z.string()).max(300)).describe('Nombres o ids concretos'),
  familia: opcional(z.enum(FAMILIAS)),
  disponibilidad: opcional(z.enum(DISPONIBILIDADES)),
  texto: opcional(z.string().max(80)).describe('Parte del nombre, p. ej. «palmera» u «olivo»'),
  ventaUnitaria: opcional(z.boolean()).describe('true = solo las que también se venden por unidad'),
  enLaWeb: opcional(z.boolean()).describe('true = solo las que salen en la web; false = las que no'),
  sinPrecio: opcional(z.boolean()).describe('true = solo las de «precio bajo presupuesto»'),
  precioMinimo: opcional(z.number().min(0)).describe('Precio «desde» igual o mayor que este'),
  precioMaximo: opcional(z.number().min(0)).describe('Precio «desde» igual o menor que este'),
  quitadas: opcional(z.boolean()).describe('true = solo las quitadas de la web'),
});
type SeleccionPlantas = z.infer<typeof SELECCION_PLANTAS>;

const AJUSTE_PRECIO = z.object({
  precio: opcional(z.enum(['precioDesde', 'precioUnidad', 'ambos'])).describe('Qué precio se ajusta; por defecto, precioDesde'),
  porcentaje: opcional(z.number().min(-90).max(500)).describe('Subir (10) o bajar (-10) un tanto por ciento'),
  euros: opcional(z.number().min(-10000).max(10000)).describe('Sumar (2) o restar (-2) euros'),
  redondeo: opcional(z.enum(['centimos', 'medio-euro', 'euro'])).describe('Cómo redondear el resultado; por defecto, a céntimos'),
});
type AjustePrecio = z.infer<typeof AJUSTE_PRECIO>;

const CAMBIOS_EN_BLOQUE = CAMBIOS_PLANTA.omit({ nombre_es: true, nombre_en: true, descripcion_es: true, descripcion_en: true, nombreCientifico: true });
interface CambioPlantas {
  seleccion: SeleccionPlantas;
  cambios?: z.infer<typeof CAMBIOS_EN_BLOQUE> | null;
  ajustePrecio?: AjustePrecio | null;
  formatosAnadir?: string[] | null;
  formatosQuitar?: string[] | null;
  web?: 'quitar' | 'recuperar' | null;
}

const MAXIMO_BLOQUE = 300;
const enumerar = (nombres: string[], n = 8) => `${nombres.slice(0, n).join(', ')}${nombres.length > n ? ` y ${nombres.length - n} más` : ''}`;
/** Dos fichas iguales (un dato vacío cuenta igual sea null o no esté). */
const mismaFicha = (a: unknown, b: unknown) => JSON.stringify(a, (_, v) => (v === null ? undefined : v)) === JSON.stringify(b, (_, v) => (v === null ? undefined : v));
const conValor = (o: object | null | undefined) => !!o && Object.values(o).some((v) => v !== undefined && v !== null);

async function elegirPlantas(repos: Repositorios, s: SeleccionPlantas, incluirQuitadas: boolean): Promise<{ ok: true; plantas: PlantaCandidata[] } | { ok: false; error: string }> {
  const { todas, plantas: nombres, ...filtros } = s;
  if (!todas && !nombres?.length && !conValor(filtros)) return { ok: false, error: 'Di qué plantas: una lista, un filtro (familia, disponibilidad, texto…) o todas.' };
  const todasLasFichas = await plantas(repos, true);
  let elegidas = todasLasFichas.filter((p) => (s.quitadas ? p.archivada : incluirQuitadas || nombres?.length || !p.archivada));
  if (nombres?.length) {
    const ids = new Set<string>();
    for (const n of nombres) {
      const exacta = todasLasFichas.find((p) => p.id === n);
      const r = exacta ? ({ tipo: 'una', elegida: exacta } as const) : buscarPlanta(n, todasLasFichas);
      if (r.tipo === 'varias') return { ok: false, error: `«${n}» puede ser: ${r.opciones.map((o) => `${o.nombre} (id ${o.id})`).join(', ')}. Pregunta cuál.` };
      if (r.tipo !== 'una') return { ok: false, error: `No hay ninguna planta que se llame «${n}».` };
      ids.add(r.elegida.id);
    }
    elegidas = elegidas.filter((p) => ids.has(p.id));
  }
  if (s.familia) elegidas = elegidas.filter((p) => p.datos.familia === s.familia);
  if (s.disponibilidad) elegidas = elegidas.filter((p) => p.datos.disponibilidad === s.disponibilidad);
  if (s.ventaUnitaria != null) elegidas = elegidas.filter((p) => Boolean(p.datos.ventaUnitaria) === s.ventaUnitaria);
  if (s.enLaWeb != null) elegidas = elegidas.filter((p) => fichaCorta(p).enLaWeb === s.enLaWeb);
  if (s.sinPrecio) elegidas = elegidas.filter((p) => p.datos.precioDesde == null);
  if (s.precioMinimo != null) elegidas = elegidas.filter((p) => p.datos.precioDesde != null && Number(p.datos.precioDesde) >= s.precioMinimo!);
  if (s.precioMaximo != null) elegidas = elegidas.filter((p) => p.datos.precioDesde != null && Number(p.datos.precioDesde) <= s.precioMaximo!);
  if (s.texto) {
    const t = normalizar(s.texto);
    const contiene = elegidas.filter((p) => p.nombres.some((n) => normalizar(n).includes(t)));
    if (contiene.length) elegidas = contiene;
    else {
      const r = buscarPlanta(s.texto, elegidas);
      elegidas = r.tipo === 'una' ? [r.elegida] : r.tipo === 'varias' ? r.opciones : [];
    }
  }
  if (!elegidas.length) return { ok: false, error: 'Ninguna planta cumple eso.' };
  if (elegidas.length > MAXIMO_BLOQUE) return { ok: false, error: `Son ${elegidas.length} plantas: como mucho ${MAXIMO_BLOQUE} de una vez.` };
  return { ok: true, plantas: elegidas };
}

function ajustar(precio: number, a: AjustePrecio): number {
  let p = precio * (1 + (a.porcentaje ?? 0) / 100) + (a.euros ?? 0);
  if (a.redondeo === 'euro') p = Math.round(p);
  else if (a.redondeo === 'medio-euro') p = Math.round(p * 2) / 2;
  else p = Math.round(p * 100) / 100;
  return p;
}

/** La ficha nueva de una planta con los cambios en bloque (sin tocar la base). */
function plantaEnBloque(d: DatosPlanta, a: CambioPlantas): DatosPlanta {
  let n = a.cambios && conValor(a.cambios) ? aplicarCambiosPlanta(d, a.cambios) : (structuredClone(d) as DatosPlanta);
  if (a.ajustePrecio && (a.ajustePrecio.porcentaje || a.ajustePrecio.euros)) {
    const campos = a.ajustePrecio.precio === 'ambos' ? (['precioDesde', 'precioUnidad'] as const) : ([a.ajustePrecio.precio ?? 'precioDesde'] as const);
    for (const c of campos) if (typeof n[c] === 'number') n = { ...n, [c]: ajustar(n[c] as number, a.ajustePrecio) };
  }
  if (a.formatosAnadir?.length || a.formatosQuitar?.length) {
    const actuales = new Set(Array.isArray(n.formatos) ? (n.formatos as string[]) : []);
    for (const f of a.formatosAnadir ?? []) actuales.add(f);
    for (const f of a.formatosQuitar ?? []) actuales.delete(f);
    n = { ...n, formatos: FORMATOS.filter((f) => actuales.has(f)) };
  }
  return n;
}

function describirBloque(a: CambioPlantas): string {
  const partes: string[] = [];
  if (a.cambios && conValor(a.cambios)) partes.push(describirCambiosPlanta(a.cambios));
  const aj = a.ajustePrecio;
  if (aj && (aj.porcentaje || aj.euros)) {
    const cuanto = [aj.porcentaje ? `${aj.porcentaje > 0 ? '+' : ''}${String(aj.porcentaje).replace('.', ',')} %` : '', aj.euros ? `${aj.euros > 0 ? '+' : '−'}${dinero(Math.abs(aj.euros))}` : ''].filter(Boolean).join(' y ');
    const cual = { precioDesde: 'precio al por mayor', precioUnidad: 'precio por unidad', ambos: 'los dos precios' }[aj.precio ?? 'precioDesde'];
    partes.push(`${cual} ${cuanto}${aj.redondeo === 'euro' ? ', redondeado al euro' : aj.redondeo === 'medio-euro' ? ', redondeado al medio euro' : ''}`);
  }
  if (a.formatosAnadir?.length) partes.push(`añadir formato ${a.formatosAnadir.join(', ')}`);
  if (a.formatosQuitar?.length) partes.push(`quitar formato ${a.formatosQuitar.join(', ')}`);
  if (a.web) partes.push(a.web === 'quitar' ? 'quitar de la web' : 'volver a poner en el catálogo');
  return partes.join('; ');
}

/* ---------------- Facturas y clientes ---------------- */

async function unCliente(repos: Repositorios, texto: string) {
  const lista = await repos.clientes.listar({ incluirArchivados: true });
  const exacto = lista.find((c) => c.id === texto || normalizar(c.nombre) === normalizar(texto) || (c.nif && c.nif === texto.toUpperCase()));
  if (exacto) return { ok: true as const, cliente: exacto };
  const parecidos = lista.filter((c) => normalizar(c.nombre).includes(normalizar(texto)));
  if (parecidos.length === 1) return { ok: true as const, cliente: parecidos[0] };
  if (parecidos.length > 1) return { ok: false as const, error: `Hay varios clientes: ${parecidos.map((c) => `${c.nombre} (id ${c.id})`).join(', ')}. Pregunta cuál.` };
  return { ok: false as const, error: `No hay ningún cliente «${texto}». Puedes proponer crearlo con guardar_cliente.` };
}
async function unaFactura(repos: Repositorios, texto: string) {
  const f = (await repos.facturas.obtener(texto)) ?? (await repos.facturas.listar({ limite: 5000 })).find((x) => x.codigo?.toLowerCase() === texto.toLowerCase());
  return f ? { ok: true as const, factura: f } : { ok: false as const, error: `No encuentro la factura «${texto}».` };
}
const facturaCorta = (f: Factura) => ({
  id: f.id,
  codigo: f.codigo ?? 'borrador',
  tipo: f.tipo,
  estado: vencida(f) ? 'vencida' : NOMBRE_ESTADO[f.estado].toLowerCase(),
  fecha: f.fecha,
  vencimiento: f.vencimiento,
  cliente: f.cliente.nombre,
  base: f.totales.base,
  total: f.totales.total,
});

const LINEA = z.object({
  concepto: z.string().min(1).max(300),
  cantidad: z.number().refine((n) => n !== 0, 'distinto de 0'),
  precio: z.number().min(0).describe('Precio por unidad SIN IVA, en euros'),
  iva: opcional(z.union(TIPOS_IVA.map((t) => z.literal(t)) as unknown as [z.ZodLiteral<21>, z.ZodLiteral<10>, z.ZodLiteral<4>, z.ZodLiteral<0>])).describe('21, 10, 4 o 0; plantas: 10'),
  descuento: opcional(z.number().min(0).max(100)),
});

/* ---------------- Textos de la web ---------------- */

function leerRuta(obj: unknown, ruta: string): unknown {
  return ruta.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}
function ponerRuta(obj: Record<string, unknown>, ruta: string, valor: unknown) {
  const partes = ruta.split('.');
  let o: Record<string, unknown> = obj;
  for (const k of partes.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[partes.at(-1)!] = valor;
}

interface TextoWeb {
  seccion: string;
  campo: string;
  es?: string | null;
  en?: string | null;
  valor?: string | number | boolean | null;
}
const esBilingue = (actual: unknown) => !!actual && typeof actual === 'object' && 'es' in (actual as object);
/** El valor nuevo de un campo: en los bilingües solo cambia el idioma que venga. */
const valorTexto = (actual: unknown, t: TextoWeb) => (esBilingue(actual) ? { ...(actual as object), ...(t.es ? { es: t.es } : {}), ...(t.en ? { en: t.en } : {}) } : t.valor);

async function prepararTexto(repos: Repositorios, t: TextoWeb): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  const [coleccion, id] = t.seccion.split('/');
  if (!SECCIONES.some((s) => s.coleccion === coleccion && s.id === id)) return { ok: false, error: 'Esa sección no existe. Usa ver_textos_web.' };
  const e = await repos.contenido.obtener(coleccion as Coleccion, id);
  if (!e) return { ok: false, error: 'Esa sección no existe.' };
  const actual = leerRuta(e.borrador.datos, t.campo);
  if (actual === undefined) return { ok: false, error: `No existe el campo «${t.campo}» en ${t.seccion}.` };
  const bilingue = esBilingue(actual);
  if (bilingue ? !t.es && !t.en : t.valor === undefined || t.valor === null) return { ok: false, error: bilingue ? 'Falta el texto en español o en inglés.' : 'Falta el valor nuevo.' };
  const nuevo = valorTexto(actual, t);
  return { ok: true, resumen: `${t.seccion} → ${t.campo}: «${recortar(bilingue ? (nuevo as { es: string }).es : nuevo, 120)}».` };
}

/* ---------------- La lista ---------------- */

export const HERRAMIENTAS: Herramienta[] = [
  consulta({
    nombre: 'resumen_vivero',
    descripcion: 'Visión general de hoy: plantas, presupuestos nuevos, facturas por cobrar y vencidas, tickets por revisar, cambios sin publicar y condiciones de venta.',
    permiso: 'asistente',
    esquema: z.object({}),
    async consultar(ctx) {
      const { repos, usuario } = ctx;
      const lista = await plantas(repos);
      const condiciones = (await repos.contenido.obtener('ajustes', 'condiciones'))?.borrador.datos;
      const empresa = (await repos.contenido.obtener('ajustes', 'empresa'))?.borrador.datos as Record<string, unknown> | undefined;
      return {
        empresa: { nombre: empresa?.nombre, telefono: empresa?.telefono, email: empresa?.email, direccion: empresa?.direccion },
        plantas: { total: lista.length, enLaWeb: lista.filter((p) => fichaCorta(p).enLaWeb).length, agotadas: lista.filter((p) => p.datos.disponibilidad === 'agotado').map((p) => p.nombre) },
        cambiosSinPublicar: (await repos.contenido.pendientes()).length,
        presupuestosNuevos: puede(usuario.rol, 'presupuestos') ? await repos.presupuestos.contar('nuevo') : 'sin permiso',
        cobros: puede(usuario.rol, 'facturas') ? cobros(await repos.facturas.listar({ estado: 'emitida' }), ctx.hoy) : 'sin permiso',
        ticketsPorRevisar: puede(usuario.rol, 'gastos') ? (await repos.gastos.listar({ estado: 'revisar' })).length : 'sin permiso',
        condicionesDeVenta: condiciones,
      };
    },
  }),
  consulta({
    nombre: 'buscar_plantas',
    descripcion: 'Busca plantas del catálogo por nombre (con faltas vale), familia o disponibilidad; sin filtros, lista todo el catálogo. Con «planta» devuelve la ficha completa de una.',
    permiso: 'asistente',
    esquema: z.object({ texto: opcional(z.string()), familia: opcional(z.enum(FAMILIAS)), disponibilidad: opcional(z.enum(DISPONIBILIDADES)), planta: opcional(z.string()).describe('Nombre o id para ver la ficha completa') }),
    async consultar({ repos }, a: { texto?: string | null; familia?: string | null; disponibilidad?: string | null; planta?: string | null }) {
      if (a.planta) {
        const r = await unaPlanta(repos, a.planta, true);
        if (!r.ok) return r;
        const { fotos, seo, ...resto } = r.planta.datos as Record<string, unknown>;
        return { ...fichaCorta(r.planta), ficha: { ...resto, fotos: Array.isArray(fotos) ? fotos.length : 0, seo: seo ? 'sí' : 'no' } };
      }
      let lista = await plantas(repos);
      if (a.familia) lista = lista.filter((p) => p.datos.familia === a.familia);
      if (a.disponibilidad) lista = lista.filter((p) => p.datos.disponibilidad === a.disponibilidad);
      if (a.texto) {
        const r = buscarPlanta(a.texto, lista);
        lista = r.tipo === 'una' ? [r.elegida] : r.tipo === 'varias' ? r.opciones : [];
      }
      return { total: lista.length, plantas: lista.slice(0, 120).map(fichaCorta) };
    },
  }),
  consulta({
    nombre: 'ver_presupuestos',
    descripcion: 'Presupuestos pedidos desde la web: lista por estado (nuevo, respondido, archivado) o búsqueda, o uno con «id».',
    permiso: 'presupuestos',
    esquema: z.object({ estado: opcional(z.enum(['nuevo', 'respondido', 'archivado'])), texto: opcional(z.string()), id: opcional(z.string()) }),
    async consultar({ repos }, a: { estado?: EstadoPresupuesto | null; texto?: string | null; id?: string | null }) {
      if (a.id) return (await repos.presupuestos.obtener(a.id)) ?? { error: 'No existe ese presupuesto.' };
      let lista = await repos.presupuestos.listar({ estado: a.estado ?? undefined, limite: 200 });
      if (a.texto) lista = lista.filter((p) => normalizar(`${p.nombre} ${p.empresa} ${p.email}`).includes(normalizar(a.texto!)));
      return {
        total: lista.length,
        presupuestos: lista.slice(0, 20).map((p) => ({ id: p.id, fecha: p.fecha.slice(0, 10), estado: p.estado, nombre: p.nombre, empresa: p.empresa, provincia: p.provincia, pedido: p.tipoPedido, plantas: p.lineas.map((l) => `${l.cantidad} × ${l.nombre}`).join(', '), mensaje: recortar(p.mensaje) })),
      };
    },
  }),
  consulta({
    nombre: 'ver_clientes',
    descripcion: 'Clientes para facturar: búsqueda por nombre o NIF, o uno con «id» (con lo que le falta para poder facturarle).',
    permiso: 'facturas',
    esquema: z.object({ texto: opcional(z.string()), id: opcional(z.string()) }),
    async consultar({ repos }, a: { texto?: string | null; id?: string | null }) {
      if (a.id) {
        const c = await repos.clientes.obtener(a.id);
        return c ? { ...c, falta: faltaCliente(c).map((e) => e.mensaje) } : { error: 'No existe ese cliente.' };
      }
      let lista = await repos.clientes.listar();
      if (a.texto) lista = lista.filter((c) => normalizar(`${c.nombre} ${c.nif} ${c.poblacion}`).includes(normalizar(a.texto!)));
      return { total: lista.length, clientes: lista.slice(0, 30).map((c) => ({ id: c.id, nombre: c.nombre, nif: c.nif, poblacion: c.poblacion, recargo: c.recargo })) };
    },
  }),
  consulta({
    nombre: 'ver_facturas',
    descripcion: 'Facturas: lista filtrada (estado borrador/emitida/cobrada, texto de cliente o número, fechas) o una con «factura» (id o número) con sus líneas.',
    permiso: 'facturas',
    esquema: z.object({ estado: opcional(z.enum(['borrador', 'emitida', 'cobrada'])), texto: opcional(z.string()), desde: opcional(fecha), hasta: opcional(fecha), factura: opcional(z.string()) }),
    async consultar({ repos }, a: { estado?: Factura['estado'] | null; texto?: string | null; desde?: string | null; hasta?: string | null; factura?: string | null }) {
      if (a.factura) {
        const r = await unaFactura(repos, a.factura);
        if (!r.ok) return r;
        const f = r.factura;
        return { ...facturaCorta(f), lineas: f.lineas.filter((l) => l.concepto), desglose: f.totales.desglose, formaPago: f.formaPago, notas: f.notas, cobradaEl: f.cobradaEl, rectifica: f.rectificaCodigo };
      }
      let lista = await repos.facturas.listar({ estado: a.estado ?? undefined, desde: a.desde ?? undefined, hasta: a.hasta ?? undefined, limite: 2000 });
      if (a.texto) lista = lista.filter((f) => normalizar(`${f.cliente.nombre} ${f.codigo ?? ''}`).includes(normalizar(a.texto!)));
      return { total: lista.length, sumaTotal: Math.round(lista.reduce((t, f) => t + f.totales.total, 0) * 100) / 100, facturas: lista.slice(0, 25).map(facturaCorta) };
    },
  }),
  consulta({
    nombre: 'ver_gastos',
    descripcion: 'Gastos (tickets): filtrar por fechas, tipo, tienda o estado («revisar» = leídos sin confirmar; «confirmado» = cuentan).',
    permiso: 'gastos',
    esquema: z.object({ desde: opcional(fecha), hasta: opcional(fecha), categoria: opcional(z.enum(CATEGORIAS.map((c) => c.id) as [string, ...string[]])), texto: opcional(z.string()), estado: opcional(z.enum(['revisar', 'confirmado'])) }),
    async consultar({ repos }, a: { desde?: string | null; hasta?: string | null; categoria?: string | null; texto?: string | null; estado?: 'revisar' | 'confirmado' | null }) {
      let lista = await repos.gastos.listar({ estado: a.estado ?? undefined, desde: a.desde ?? undefined, hasta: a.hasta ?? undefined, limite: 3000 });
      if (a.categoria) lista = lista.filter((g) => g.categoria === a.categoria);
      if (a.texto) lista = lista.filter((g) => normalizar(`${g.proveedor} ${g.lineas.map((l) => l.concepto).join(' ')}`).includes(normalizar(a.texto!)));
      return {
        total: lista.length,
        suma: Math.round(lista.reduce((t, g) => t + g.total, 0) * 100) / 100,
        gastos: lista.slice(0, 25).map((g) => ({ id: g.id, fecha: g.fecha, estado: g.estado, proveedor: g.proveedor, tipo: nombreCategoria(g.categoria), total: g.total, base: g.base, iva: g.iva, que: recortar(g.lineas.map((l) => l.concepto).join(', '), 100) })),
      };
    },
  }),
  consulta({
    nombre: 'informe',
    descripcion: 'Cifras de un mes, trimestre o año: ingresos y gastos sin IVA, resultado, margen, cobros, mejores clientes, lo más vendido, gastos por tipo, evolución de 12 meses y comparación con el periodo anterior.',
    permiso: 'informes',
    esquema: z.object({ periodo: z.enum(['mes', 'trimestre', 'anio']), fecha: opcional(fecha).describe('Cualquier día del periodo; por defecto, hoy') }),
    async consultar({ repos, hoy }, a: { periodo: 'mes' | 'trimestre' | 'anio'; fecha?: string | null }) {
      const p = periodoDe(a.periodo, a.fecha && a.fecha <= hoy ? a.fecha : hoy);
      const ant = periodoAnterior(p);
      const desde = new Date(`${p.hasta}T12:00:00Z`);
      desde.setUTCMonth(desde.getUTCMonth() - 24);
      const d = desde.toISOString().slice(0, 10);
      const [fs, gs, ps, pend] = await Promise.all([
        repos.facturas.listar({ desde: d, limite: 20000 }),
        repos.gastos.listar({ estado: 'confirmado', desde: d, limite: 20000 }),
        repos.presupuestos.listar({ limite: 5000 }),
        repos.facturas.listar({ estado: 'emitida', limite: 20000 }),
      ]);
      const actual = cifras(fs, gs, ps, p);
      const anterior = cifras(fs, gs, ps, ant);
      const categorias = gastosPorCategoria(gs, p);
      const clientes = mejoresClientes(fs, p);
      const evolucion = evolucionMensual(fs, gs, p.hasta);
      const conv = conversion(fs, ps, p);
      return {
        periodo: p.etiqueta,
        anterior: ant.etiqueta,
        actual,
        cifrasAnteriores: anterior,
        cobros: cobros(pend, hoy),
        gastosPorTipo: categorias,
        mejoresClientes: clientes,
        masVendido: masVendido(fs, p),
        evolucion12Meses: evolucion.map(({ mes, ingresos, gastos }) => ({ mes, ingresos, gastos })),
        conclusiones: conclusiones({ actual, anterior, periodo: p, cobros: cobros(pend, hoy), categorias, categoriasAntes: gastosPorCategoria(gs, ant), clientes, evolucion, conversion: conv, porRevisar: 0 }),
      };
    },
  }),
  consulta({
    nombre: 'ver_textos_web',
    descripcion: 'Textos de la web (empresa, portada, condiciones, páginas). Sin «seccion» da la lista; con ella, sus datos para leer o cambiar con cambiar_texto_web.',
    permiso: 'editar',
    esquema: z.object({ seccion: opcional(z.string()).describe('Por ejemplo «ajustes/empresa» o «paginas/reparto»') }),
    async consultar({ repos }, a: { seccion?: string | null }) {
      if (!a.seccion) return { secciones: SECCIONES.map((s) => ({ seccion: `${s.coleccion}/${s.id}`, titulo: s.titulo })) };
      const [coleccion, id] = a.seccion.split('/');
      const e = await repos.contenido.obtener(coleccion as Coleccion, id ?? '');
      return e ? { seccion: a.seccion, datos: e.borrador.datos } : { error: 'No existe esa sección.' };
    },
  }),
  consulta({
    nombre: 'cambios_recientes',
    descripcion: 'Últimos cambios guardados (con su número para deshacerlos) y lo que falta por publicar en la web.',
    permiso: 'editar',
    esquema: z.object({ limite: opcional(z.number().int().min(1).max(200)) }),
    async consultar({ repos }, a: { limite?: number | null }) {
      const [historial, pendientes] = await Promise.all([repos.contenido.historial({ limite: a.limite ?? 10 }), repos.contenido.pendientes()]);
      return { sinPublicar: pendientes.map(describirPendiente), cambios: historial.map((c) => ({ cambioId: c.id, fecha: c.fecha.slice(0, 16), quien: c.email, que: describirCambio(c) })) };
    },
  }),

  /* ---------- Cambios: siempre con «Sí» ---------- */

  cambio({
    nombre: 'cambiar_planta',
    descripcion: 'Cambia datos de una planta (precio, venta por unidad, disponibilidad, alturas, textos, revisada…). Se guarda como borrador hasta publicar.',
    permiso: 'editar',
    esquema: z.object({ planta: z.string().describe('Nombre o id'), cambios: CAMBIOS_PLANTA }),
    async preparar({ repos }, a: { planta: string; cambios: CambiosPlanta }) {
      const r = await unaPlanta(repos, a.planta);
      if (!r.ok) return r;
      if (!Object.values(a.cambios).some((v) => v !== undefined)) return { ok: false, error: 'No hay ningún cambio.' };
      const nueva = aplicarCambiosPlanta(r.planta.datos, a.cambios);
      if (nueva.precioUnidad && !nueva.ventaUnitaria) return { ok: false, error: 'El precio por unidad solo vale si la planta también se vende por unidad (ventaUnitaria).' };
      return { ok: true, resumen: `${r.planta.nombre}: ${describirCambiosPlanta(a.cambios)}.`, argumentos: { planta: r.planta.id, cambios: a.cambios } };
    },
    async aplicar(ctx, a: { planta: string; cambios: CambiosPlanta }) {
      const e = await ctx.repos.contenido.obtener('catalogo', a.planta);
      if (!e) return { ok: false, texto: 'Esa planta ya no está.' };
      const r = await guardarPlanta(ctx.repos, a.planta, aplicarCambiosPlanta(e.borrador.datos as DatosPlanta, a.cambios), autor(ctx));
      return r.ok ? { ok: true, texto: 'Guardado como borrador: saldrá en la web al publicar.' } : { ok: false, texto: r.errores.map((x) => x.mensaje).join(' ') };
    },
  }),
  cambio({
    nombre: 'crear_planta',
    descripcion: 'Añade una planta nueva al catálogo (sin revisar: no sale en la web hasta marcarla revisada y publicar). Hasta 4 m de altura.',
    permiso: 'editar',
    esquema: z.object({
      nombre_es: z.string().min(2).max(80),
      nombre_en: opcional(z.string().max(80)),
      nombreCientifico: z.string().min(2).max(120),
      familia: z.enum(FAMILIAS),
      alturaMin: z.number().positive(),
      alturaMax: z.number().positive().max(4),
      precioDesde: opcional(z.number().positive()),
      disponibilidad: z.enum(DISPONIBILIDADES),
      formatos: z.array(z.enum(FORMATOS)).min(1),
      descripcion_es: z.string().min(10).max(1200),
      descripcion_en: opcional(z.string().max(1200)),
      origen: opcional(z.string().max(120)),
      ventaUnitaria: opcional(z.boolean()),
      precioUnidad: opcional(z.number().positive()),
    }),
    async preparar({ repos }, a: NuevaPlanta) {
      if (a.alturaMin > a.alturaMax) return { ok: false, error: 'La altura mínima no puede ser mayor que la máxima.' };
      const existe = (await plantas(repos, true)).find((p) => normalizar(p.nombre) === normalizar(a.nombre_es));
      if (existe) return { ok: false, error: `Ya existe «${existe.nombre}» (id ${existe.id}). Usa cambiar_planta.` };
      return { ok: true, resumen: `Planta nueva «${a.nombre_es}» (${a.alturaMin}–${a.alturaMax} m, ${a.precioDesde ? `desde ${dinero(a.precioDesde)}` : 'precio bajo presupuesto'}). Quedará sin revisar.`, argumentos: a };
    },
    async aplicar(ctx, a: NuevaPlanta) {
      const raiz = slugDesde(a.nombre_es) || 'planta';
      let id = raiz;
      for (let i = 2; await ctx.repos.contenido.obtener('catalogo', id); i++) id = `${raiz}-${i}`;
      const { nombre_es, nombre_en, descripcion_es, descripcion_en, ...resto } = a;
      const datos: DatosPlanta = {
        ...Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== null && v !== undefined)),
        slug: id,
        nombre: { es: nombre_es, en: nombre_en || nombre_es },
        descripcion: { es: descripcion_es, en: descripcion_en || descripcion_es },
        unidadPrecio: 'unidad',
        fotos: [],
        datosDeEjemplo: false,
        revisado: false,
        destacada: false,
        ventaUnitaria: Boolean(a.ventaUnitaria),
        origen: a.origen ?? '',
      };
      datos.seo = seoPorDefecto(datos);
      const r = await guardarPlanta(ctx.repos, id, datos, autor(ctx));
      return r.ok ? { ok: true, texto: `Planta creada (id ${id}). Añade sus fotos en «Plantas» y márcala revisada para que salga en la web.` } : { ok: false, texto: r.errores.map((x) => x.mensaje).join(' ') };
    },
  }),
  cambio({
    nombre: 'quitar_o_recuperar_planta',
    descripcion: 'Quita una planta de la web (archivar) o la vuelve a poner. No se borra nada.',
    permiso: 'editar',
    esquema: z.object({ planta: z.string(), accion: z.enum(['quitar', 'recuperar']) }),
    async preparar({ repos }, a: { planta: string; accion: 'quitar' | 'recuperar' }) {
      const r = await unaPlanta(repos, a.planta, true);
      if (!r.ok) return r;
      return { ok: true, resumen: `${a.accion === 'quitar' ? 'Quitar de la web' : 'Volver a poner en el catálogo'}: ${r.planta.nombre}.`, argumentos: { planta: r.planta.id, accion: a.accion } };
    },
    async aplicar(ctx, a: { planta: string; accion: 'quitar' | 'recuperar' }) {
      await ctx.repos.contenido.archivar('catalogo', a.planta, a.accion === 'quitar', autor(ctx));
      return { ok: true, texto: 'Hecho. Se verá en la web al publicar.' };
    },
  }),
  cambio({
    nombre: 'cambiar_presupuesto',
    descripcion: 'Marca un presupuesto como nuevo, respondido o archivado.',
    permiso: 'presupuestos',
    esquema: z.object({ id: z.string(), estado: z.enum(['nuevo', 'respondido', 'archivado']) }),
    async preparar({ repos }, a: { id: string; estado: EstadoPresupuesto }) {
      const p = await repos.presupuestos.obtener(a.id);
      return p ? { ok: true, resumen: `Presupuesto de ${p.nombre}${p.empresa ? ` (${p.empresa})` : ''}: pasar a «${a.estado}».`, argumentos: a } : { ok: false, error: 'No existe ese presupuesto.' };
    },
    async aplicar(ctx, a: { id: string; estado: EstadoPresupuesto }) {
      const ok = await ctx.repos.presupuestos.cambiarEstado(a.id, a.estado);
      if (ok) await ctx.repos.auditoria.registrar(ctx.usuario.email, 'presupuesto', `${a.id} → ${a.estado} (asistente)`);
      return { ok, texto: ok ? 'Hecho.' : 'No se ha podido cambiar.' };
    },
  }),
  cambio({
    nombre: 'guardar_cliente',
    descripcion: 'Crea un cliente o cambia sus datos (con «id»). NIF español comprobado.',
    permiso: 'facturas',
    esquema: z.object({
      id: opcional(z.string()),
      nombre: z.string().min(2).max(200),
      nif: opcional(z.string().max(20)),
      direccion: opcional(z.string().max(200)),
      codigoPostal: opcional(z.string().max(10)),
      poblacion: opcional(z.string().max(100)),
      provincia: opcional(z.string().max(100)),
      pais: opcional(z.string().max(60)),
      email: opcional(z.string().max(120)),
      telefono: opcional(z.string().max(30)),
      recargo: opcional(z.boolean()),
    }),
    async preparar({ repos }, a: Record<string, unknown> & { id?: string | null; nombre: string; nif?: string | null }) {
      const previo = a.id ? await repos.clientes.obtener(a.id) : null;
      if (a.id && !previo) return { ok: false, error: 'No existe ese cliente.' };
      const form = new FormData();
      const base = previo ?? clienteVacio();
      for (const [k, v] of Object.entries({ ...base, ...Object.fromEntries(Object.entries(a).filter(([, v]) => v !== null && v !== undefined)) })) form.set(k, k === 'recargo' ? (v ? '1' : '') : String(v ?? ''));
      const r = leerCliente(form, base);
      if (r.errores.length) return { ok: false, error: r.errores.map((e) => e.mensaje).join(' ') };
      if (a.nif && !nifValido(a.nif) && /^(españa|es)?$/i.test(String(a.pais ?? ''))) return { ok: false, error: 'El NIF no es correcto.' };
      return { ok: true, resumen: `${previo ? 'Cambiar el cliente' : 'Cliente nuevo'}: ${r.cliente.nombre}${r.cliente.nif ? `, NIF ${r.cliente.nif}` : ''}${r.cliente.poblacion ? `, ${r.cliente.poblacion}` : ''}.`, argumentos: { ...a, id: base.id } };
    },
    async aplicar(ctx, a: Record<string, unknown> & { id?: string | null; nombre: string; nif?: string | null }) {
      const id = a.id ?? crypto.randomUUID();
      const base = (await ctx.repos.clientes.obtener(id)) ?? clienteVacio(id);
      const form = new FormData();
      for (const [k, v] of Object.entries({ ...base, ...Object.fromEntries(Object.entries(a).filter(([, v]) => v !== null && v !== undefined)) })) form.set(k, k === 'recargo' ? (v ? '1' : '') : String(v ?? ''));
      const r = leerCliente(form, base);
      if (r.errores.length) return { ok: false, texto: r.errores.map((e) => e.mensaje).join(' ') };
      await ctx.repos.clientes.guardar(r.cliente, ctx.usuario.email);
      return { ok: true, texto: `Cliente guardado (id ${r.cliente.id}).` };
    },
  }),
  cambio({
    nombre: 'crear_factura',
    descripcion: 'Prepara un BORRADOR de factura para un cliente existente con sus líneas (precio sin IVA; plantas al 10 %). No la emite.',
    permiso: 'facturas',
    esquema: z.object({ cliente: z.string().describe('Nombre, NIF o id del cliente'), lineas: z.array(LINEA).min(1).max(50), notas: opcional(z.string().max(500)), presupuestoId: opcional(z.string()) }),
    async preparar({ repos }, a: { cliente: string; lineas: z.infer<typeof LINEA>[]; notas?: string | null; presupuestoId?: string | null }) {
      const c = await unCliente(repos, a.cliente);
      if (!c.ok) return c;
      const lineas = a.lineas.map((l) => ({ ...lineaVacia(), ...l, iva: l.iva ?? IVA_POR_DEFECTO, descuento: l.descuento ?? 0 }));
      const t = calcularTotales(lineas, c.cliente.recargo);
      return {
        ok: true,
        resumen: `Borrador de factura para ${c.cliente.nombre}: ${lineas.map((l) => `${l.cantidad} × ${l.concepto} a ${dinero(l.precio)}`).join('; ')}. Base ${dinero(t.base)}, total con IVA ${dinero(t.total)}.`,
        argumentos: { ...a, cliente: c.cliente.id },
      };
    },
    async aplicar(ctx, a: { cliente: string; lineas: z.infer<typeof LINEA>[]; notas?: string | null; presupuestoId?: string | null }) {
      const c = await ctx.repos.clientes.obtener(a.cliente);
      if (!c) return { ok: false, texto: 'Ese cliente ya no está.' };
      const f = nuevaFactura(c, ctx.usuario.email, await ajustesFacturacion(ctx.repos));
      f.lineas = a.lineas.map((l) => ({ ...lineaVacia(), ...l, iva: l.iva ?? IVA_POR_DEFECTO, descuento: l.descuento ?? 0 }));
      f.totales = calcularTotales(f.lineas, c.recargo);
      f.notas = a.notas ?? '';
      f.presupuestoId = a.presupuestoId ?? null;
      await ctx.repos.facturas.guardarBorrador(f);
      await ctx.repos.auditoria.registrar(ctx.usuario.email, 'factura nueva', `${c.nombre} (asistente)`);
      const falta = faltaCliente(c);
      return { ok: true, texto: `Borrador creado (id ${f.id}). Ábrelo en «Facturas» para revisarlo y emitirlo.${falta.length ? ` Antes de emitir: ${falta.map((e) => e.mensaje).join(' ')}` : ''}` };
    },
  }),
  cambio({
    nombre: 'gestionar_factura',
    descripcion: 'Sobre una factura: «emitir» un borrador (le da número; ya no se puede cambiar), marcar «cobrada» o «pendiente», o «rectificar» una emitida (crea el borrador de la rectificativa).',
    permiso: 'facturas',
    esquema: z.object({ factura: z.string().describe('Id o número (F2026-0001)'), accion: z.enum(['emitir', 'cobrada', 'pendiente', 'rectificar']), fecha: opcional(fecha).describe('Día del cobro') }),
    async preparar({ repos }, a: { factura: string; accion: 'emitir' | 'cobrada' | 'pendiente' | 'rectificar'; fecha?: string | null }) {
      const r = await unaFactura(repos, a.factura);
      if (!r.ok) return r;
      const f = r.factura;
      const nombre = `${f.codigo ?? 'el borrador'} de ${f.cliente.nombre} (${dinero(f.totales.total)})`;
      if (a.accion === 'emitir' && f.estado !== 'borrador') return { ok: false, error: 'Esa factura ya está emitida.' };
      if (a.accion !== 'emitir' && f.estado === 'borrador') return { ok: false, error: 'Es un borrador: primero hay que emitirlo.' };
      const textos = { emitir: `Emitir ${nombre}. Después no se podrá cambiar ni borrar.`, cobrada: `Marcar como cobrada ${nombre}${a.fecha ? ` el ${a.fecha}` : ' hoy'}.`, pendiente: `Volver a dejar pendiente de cobro ${nombre}.`, rectificar: `Preparar el borrador de una rectificativa de ${nombre}.` };
      return { ok: true, resumen: textos[a.accion], argumentos: { ...a, factura: f.id } };
    },
    async aplicar(ctx, a: { factura: string; accion: 'emitir' | 'cobrada' | 'pendiente' | 'rectificar'; fecha?: string | null }) {
      const f = await ctx.repos.facturas.obtener(a.factura);
      if (!f) return { ok: false, texto: 'Esa factura ya no está.' };
      if (a.accion === 'emitir') {
        const r = await emitirFactura(ctx.repos, f, ctx.usuario.email);
        return r.ok ? { ok: true, texto: `Factura ${r.factura.codigo} emitida. El PDF está en «Facturas».` } : { ok: false, texto: r.errores.map((e) => e.mensaje).join(' ') };
      }
      if (a.accion === 'rectificar') {
        const r = rectificativaDe(f, ctx.usuario.email, await ajustesFacturacion(ctx.repos));
        await ctx.repos.facturas.guardarBorrador(r);
        return { ok: true, texto: `Borrador de rectificativa creado (id ${r.id}). Escribe el motivo y revísalo en «Facturas» antes de emitirlo.` };
      }
      const ok = await ctx.repos.facturas.marcarCobrada(f.id, a.accion === 'cobrada' ? (a.fecha ?? ctx.hoy) : null);
      if (ok) await ctx.repos.auditoria.registrar(ctx.usuario.email, `factura ${a.accion}`, `${f.codigo} (asistente)`);
      return { ok, texto: ok ? 'Hecho.' : 'No se ha podido cambiar.' };
    },
  }),
  cambio({
    nombre: 'registrar_gasto',
    descripcion: 'Apunta un gasto (compra, factura de proveedor, gasolina…) ya revisado.',
    permiso: 'gastos',
    esquema: z.object({
      fecha,
      proveedor: z.string().min(1).max(200),
      total: z.number().positive().describe('Total pagado con IVA'),
      categoria: z.enum(CATEGORIAS.map((c) => c.id) as [string, ...string[]]),
      concepto: opcional(z.string().max(300)),
      base: opcional(z.number()),
      iva: opcional(z.number()),
      formaPago: opcional(z.enum(['Tarjeta', 'Efectivo', 'Transferencia', 'Recibo domiciliado', 'Bizum'])),
      notas: opcional(z.string().max(500)),
    }),
    async preparar({ hoy }, a: { fecha: string; proveedor: string; total: number; categoria: string }) {
      if (a.fecha > hoy) return { ok: false, error: 'La fecha no puede ser posterior a hoy.' };
      return { ok: true, resumen: `Gasto de ${dinero(a.total)} en ${a.proveedor} el ${a.fecha.split('-').reverse().join('/')} (${nombreCategoria(a.categoria)}).`, argumentos: a };
    },
    async aplicar(ctx, a: { fecha: string; proveedor: string; total: number; categoria: string; concepto?: string | null; base?: number | null; iva?: number | null; formaPago?: string | null; notas?: string | null }) {
      const g = { ...gastoVacio(ctx.usuario.email), estado: 'confirmado' as const, fecha: a.fecha, proveedor: a.proveedor, total: a.total, categoria: a.categoria, base: a.base ?? null, iva: a.iva ?? null, formaPago: a.formaPago ?? 'Tarjeta', notas: a.notas ?? '', lineas: a.concepto ? [{ concepto: a.concepto, cantidad: 1, importe: a.total }] : [] };
      g.avisos = avisosDe(g);
      await ctx.repos.gastos.guardar(g);
      await ctx.repos.auditoria.registrar(ctx.usuario.email, 'gasto guardado', `${g.proveedor} ${g.total} (asistente)`);
      return { ok: true, texto: 'Gasto apuntado.' };
    },
  }),
  cambio({
    nombre: 'cambiar_texto_web',
    descripcion: 'Cambia un texto de la web (empresa, condiciones, portada, páginas). «campo» es la ruta del dato (ver ver_textos_web), p. ej. «telefono» o «pedidoMinimo». Los textos bilingües llevan «es» y «en».',
    permiso: 'editar',
    esquema: z.object({ seccion: z.string(), campo: z.string(), es: opcional(z.string().max(2000)), en: opcional(z.string().max(2000)), valor: opcional(z.union([z.string().max(2000), z.number(), z.boolean()])) }),
    async preparar({ repos }, a: TextoWeb) {
      const r = await prepararTexto(repos, a);
      return r.ok ? { ok: true, resumen: r.resumen, argumentos: a } : r;
    },
    async aplicar(ctx, a: TextoWeb) {
      const [coleccion, id] = a.seccion.split('/') as [Coleccion, string];
      const e = await ctx.repos.contenido.obtener(coleccion, id);
      if (!e) return { ok: false, texto: 'Esa sección no existe.' };
      const datos = structuredClone(e.borrador.datos);
      ponerRuta(datos, a.campo, valorTexto(leerRuta(datos, a.campo), a));
      const r = await guardarTextos(ctx.repos, coleccion, id, datos, e.borrador.cuerpo, autor(ctx));
      return r.ok ? { ok: true, texto: 'Guardado como borrador: saldrá en la web al publicar.' } : { ok: false, texto: r.errores.map((x) => x.mensaje).join(' ') };
    },
  }),
  cambio({
    nombre: 'publicar_cambios',
    descripcion: 'Publica en la web todos los cambios guardados (tarda unos minutos).',
    permiso: 'publicar',
    esquema: z.object({}),
    async preparar({ repos }) {
      const p = await repos.contenido.pendientes();
      return p.length ? { ok: true, resumen: `Publicar en la web ${p.length} ${p.length === 1 ? 'cambio' : 'cambios'}: ${p.slice(0, 6).map(describirPendiente).join('; ')}${p.length > 6 ? '…' : ''}.`, argumentos: {} } : { ok: false, error: 'No hay cambios pendientes de publicar.' };
    },
    async aplicar(ctx) {
      const r = await publicarCambios(ctx.repos, ctx.usuario.email, ctx.env);
      const textos = { lanzada: `Publicando ${r.cambios} cambios: la web se actualiza en unos minutos.`, 'sin-cambios': 'No había cambios.', 'sin-configurar': 'Los cambios están listos, pero falta configurar la publicación.', error: 'No se pudo avisar para actualizar la web. Prueba en unos minutos.' };
      return { ok: r.estado === 'lanzada' || r.estado === 'sin-cambios', texto: textos[r.estado] };
    },
  }),
  cambio({
    nombre: 'deshacer_cambio',
    descripcion: 'Deshace uno o varios cambios guardados (números de cambios_recientes). Cada cambio se deshace una sola vez.',
    permiso: 'editar',
    esquema: z.object({ cambioId: opcional(z.number().int().positive()), cambioIds: opcional(z.array(z.number().int().positive()).max(MAXIMO_BLOQUE)) }),
    async preparar({ repos }, a: { cambioId?: number | null; cambioIds?: number[] | null }) {
      const ids = [...new Set([...(a.cambioIds ?? []), ...(a.cambioId ? [a.cambioId] : [])])];
      if (!ids.length) return { ok: false, error: 'Di qué cambio deshacer (su número en cambios_recientes).' };
      const historial = await repos.contenido.historial({ limite: 1000 });
      const encontrados = ids.map((id) => historial.find((x) => x.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
      if (encontrados.length < ids.length) return { ok: false, error: `No encuentro ${ids.length - encontrados.length === 1 ? 'uno de esos cambios' : 'algunos de esos cambios'} (o ya se deshicieron).` };
      const resumen = encontrados.length === 1 ? `Deshacer: ${describirCambio(encontrados[0])} (${encontrados[0].fecha.slice(0, 10)}).` : `Deshacer ${encontrados.length} cambios: ${enumerar(encontrados.map(describirCambio), 5)}.`;
      return { ok: true, resumen, argumentos: { cambioIds: ids } };
    },
    async aplicar(ctx, a: { cambioIds?: number[] | null }) {
      // Del más nuevo al más viejo: así una ficha cambiada dos veces vuelve a como estaba al principio.
      const ids = [...(a.cambioIds ?? [])].sort((x, y) => y - x);
      let hechos = 0;
      for (const id of ids) if (await ctx.repos.contenido.deshacer(id, autor(ctx))) hechos++;
      if (!hechos) return { ok: false, texto: 'No se ha podido deshacer.' };
      return { ok: true, texto: `${hechos === 1 ? 'Deshecho' : `Deshechos ${hechos} cambios`}${hechos < ids.length ? ` (${ids.length - hechos} ya estaban deshechos)` : ''}. Publica para que la web lo recoja.` };
    },
  }),

  /* ---------- En bloque: muchas cosas con un solo «Sí» ---------- */

  cambio({
    nombre: 'cambiar_plantas',
    descripcion:
      'Cambia VARIAS plantas a la vez con un solo «Sí»: elige cuáles con «seleccion» (lista de nombres, familia, disponibilidad, texto, sin precio, todas…) y di qué cambiar: «cambios» (mismo valor para todas: disponibilidad, revisado, destacada, ventaUnitaria, precio, origen…), «ajustePrecio» (subir o bajar un % o unos euros), «formatosAnadir»/«formatosQuitar» o «web» (quitar o recuperar).',
    permiso: 'editar',
    esquema: z.object({
      seleccion: SELECCION_PLANTAS,
      cambios: opcional(CAMBIOS_EN_BLOQUE),
      ajustePrecio: opcional(AJUSTE_PRECIO),
      formatosAnadir: opcional(z.array(z.enum(FORMATOS))),
      formatosQuitar: opcional(z.array(z.enum(FORMATOS))),
      web: opcional(z.enum(['quitar', 'recuperar'])),
    }),
    async preparar({ repos }, a: CambioPlantas) {
      const hayAjuste = !!a.ajustePrecio && !!(a.ajustePrecio.porcentaje || a.ajustePrecio.euros);
      if (!conValor(a.cambios) && !hayAjuste && !a.formatosAnadir?.length && !a.formatosQuitar?.length && !a.web) return { ok: false, error: 'No hay ningún cambio.' };
      const r = await elegirPlantas(repos, a.seleccion, a.web === 'recuperar');
      if (!r.ok) return r;
      const cambian: { p: PlantaCandidata; nueva: DatosPlanta }[] = [];
      const fallan: string[] = [];
      for (const p of r.plantas) {
        const nueva = plantaEnBloque(p.datos, a);
        const errores = revisarPlanta(nueva);
        if (a.cambios?.precioUnidad != null && !nueva.ventaUnitaria) errores.unshift({ campo: 'precioUnidad', mensaje: 'no se vende por unidad' });
        if (errores.length) fallan.push(`${p.nombre} (${errores[0].mensaje.replace(/\.$/, '')})`);
        else if (!mismaFicha(nueva, p.datos) || (a.web && p.archivada !== (a.web === 'quitar'))) cambian.push({ p, nueva });
      }
      if (!cambian.length) return { ok: false, error: fallan.length ? `No se puede: ${enumerar(fallan, 4)}.` : 'Esas plantas ya están así: no cambia nada.' };
      const ejemplos = hayAjuste
        ? cambian
            .filter(({ p, nueva }) => nueva.precioDesde !== p.datos.precioDesde || nueva.precioUnidad !== p.datos.precioUnidad)
            .slice(0, 3)
            .map(({ p, nueva }) => (nueva.precioDesde !== p.datos.precioDesde ? `${p.nombre} ${dinero(Number(p.datos.precioDesde))} → ${dinero(Number(nueva.precioDesde))}` : `${p.nombre} ${dinero(Number(p.datos.precioUnidad))} → ${dinero(Number(nueva.precioUnidad))}`))
        : [];
      const resumen = [
        `${cambian.length === 1 ? '1 planta' : `${cambian.length} plantas`} (${enumerar(cambian.map((c) => c.p.nombre))}): ${describirBloque(a)}.`,
        ejemplos.length ? `Por ejemplo: ${ejemplos.join('; ')}.` : '',
        fallan.length ? `No se tocan ${fallan.length}: ${enumerar(fallan, 3)}.` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return { ok: true, resumen, argumentos: { ...a, seleccion: { plantas: cambian.map((c) => c.p.id) } } };
    },
    async aplicar(ctx, a: CambioPlantas) {
      const ids = a.seleccion.plantas ?? [];
      let hechas = 0;
      const fallos: string[] = [];
      for (const id of ids) {
        const e = await ctx.repos.contenido.obtener('catalogo', id);
        if (!e) {
          fallos.push(`${id} ya no está`);
          continue;
        }
        const antes = e.borrador.datos as DatosPlanta;
        const nueva = plantaEnBloque(antes, a);
        if (!mismaFicha(nueva, antes)) {
          const r = await guardarPlanta(ctx.repos, id, nueva, autor(ctx));
          if (!r.ok) {
            fallos.push(`${String(antes.nombre?.es ?? id)}: ${r.errores[0]?.mensaje ?? 'no vale'}`);
            continue;
          }
        }
        if (a.web && e.archivada !== (a.web === 'quitar')) await ctx.repos.contenido.archivar('catalogo', id, a.web === 'quitar', autor(ctx));
        hechas++;
      }
      if (!hechas) return { ok: false, texto: `No se ha cambiado ninguna: ${enumerar(fallos, 3)}.` };
      return { ok: true, texto: `${hechas === 1 ? '1 planta cambiada' : `${hechas} plantas cambiadas`} como borrador: salen en la web al publicar.${fallos.length ? ` No se pudo con ${enumerar(fallos, 3)}.` : ''}` };
    },
  }),
  cambio({
    nombre: 'cambiar_presupuestos',
    descripcion: 'Cambia el estado de VARIOS presupuestos a la vez (por ids, por estado actual, anteriores a una fecha, por texto de nombre/empresa o todos).',
    permiso: 'presupuestos',
    esquema: z.object({
      ids: opcional(z.array(z.string()).max(MAXIMO_BLOQUE)),
      estadoActual: opcional(z.enum(['nuevo', 'respondido', 'archivado'])),
      antesDe: opcional(fecha).describe('Solo los pedidos antes de este día'),
      texto: opcional(z.string().max(80)),
      todos: opcional(z.boolean()),
      estado: z.enum(['nuevo', 'respondido', 'archivado']).describe('Estado nuevo'),
    }),
    async preparar({ repos }, a: { ids?: string[] | null; estadoActual?: EstadoPresupuesto | null; antesDe?: string | null; texto?: string | null; todos?: boolean | null; estado: EstadoPresupuesto }) {
      if (!a.ids?.length && !a.estadoActual && !a.antesDe && !a.texto && !a.todos) return { ok: false, error: 'Di qué presupuestos: ids, estado actual, fecha, texto o todos.' };
      let lista = await repos.presupuestos.listar({ estado: a.estadoActual ?? undefined, limite: 5000 });
      if (a.ids?.length) lista = lista.filter((p) => a.ids!.includes(p.id));
      if (a.antesDe) lista = lista.filter((p) => p.fecha.slice(0, 10) < a.antesDe!);
      if (a.texto) lista = lista.filter((p) => normalizar(`${p.nombre} ${p.empresa} ${p.email}`).includes(normalizar(a.texto!)));
      lista = lista.filter((p) => p.estado !== a.estado);
      if (!lista.length) return { ok: false, error: 'Ningún presupuesto cambia con eso.' };
      if (lista.length > MAXIMO_BLOQUE) return { ok: false, error: `Son ${lista.length}: como mucho ${MAXIMO_BLOQUE} de una vez.` };
      return { ok: true, resumen: `Pasar a «${a.estado}» ${lista.length === 1 ? '1 presupuesto' : `${lista.length} presupuestos`}: ${enumerar(lista.map((p) => p.empresa || p.nombre), 6)}.`, argumentos: { ids: lista.map((p) => p.id), estado: a.estado } };
    },
    async aplicar(ctx, a: { ids?: string[] | null; estado: EstadoPresupuesto }) {
      let hechos = 0;
      for (const id of a.ids ?? []) if (await ctx.repos.presupuestos.cambiarEstado(id, a.estado)) hechos++;
      if (hechos) await ctx.repos.auditoria.registrar(ctx.usuario.email, 'presupuesto', `${hechos} → ${a.estado} (asistente, en bloque)`);
      return { ok: hechos > 0, texto: hechos ? `${hechos === 1 ? '1 presupuesto' : `${hechos} presupuestos`} en «${a.estado}».` : 'No se ha podido cambiar ninguno.' };
    },
  }),
  cambio({
    nombre: 'gestionar_facturas',
    descripcion: 'Sobre VARIAS facturas a la vez: «emitir» borradores, marcar «cobrada» o volver a «pendiente». Elige por lista de números/ids, cliente, estado, fechas o solo las vencidas.',
    permiso: 'facturas',
    esquema: z.object({
      facturas: opcional(z.array(z.string()).max(MAXIMO_BLOQUE)).describe('Ids o números (F2026-0001)'),
      cliente: opcional(z.string()),
      estado: opcional(z.enum(['borrador', 'emitida', 'cobrada'])),
      desde: opcional(fecha),
      hasta: opcional(fecha),
      vencidas: opcional(z.boolean()),
      accion: z.enum(['emitir', 'cobrada', 'pendiente']),
      fecha: opcional(fecha).describe('Día del cobro'),
    }),
    async preparar(
      { repos, hoy },
      a: { facturas?: string[] | null; cliente?: string | null; estado?: Factura['estado'] | null; desde?: string | null; hasta?: string | null; vencidas?: boolean | null; accion: 'emitir' | 'cobrada' | 'pendiente'; fecha?: string | null },
    ) {
      if (!a.facturas?.length && !a.cliente && !a.estado && !a.desde && !a.hasta && !a.vencidas) return { ok: false, error: 'Di qué facturas: números, cliente, estado, fechas o vencidas.' };
      if (a.fecha && a.fecha > hoy) return { ok: false, error: 'La fecha de cobro no puede ser posterior a hoy.' };
      let lista = await repos.facturas.listar({ estado: a.estado ?? undefined, desde: a.desde ?? undefined, hasta: a.hasta ?? undefined, limite: 20000 });
      if (a.facturas?.length) {
        const buscadas = new Set(a.facturas.map((x) => x.toLowerCase()));
        lista = lista.filter((f) => buscadas.has(f.id.toLowerCase()) || (f.codigo && buscadas.has(f.codigo.toLowerCase())));
      }
      if (a.cliente) {
        const c = await unCliente(repos, a.cliente);
        if (!c.ok) return c;
        lista = lista.filter((f) => f.clienteId === c.cliente.id);
      }
      if (a.vencidas) lista = lista.filter((f) => vencida(f));
      const valen = lista.filter((f) => (a.accion === 'emitir' ? f.estado === 'borrador' : a.accion === 'cobrada' ? f.estado === 'emitida' : f.estado === 'cobrada'));
      if (!valen.length) return { ok: false, error: a.accion === 'emitir' ? 'No hay borradores que emitir con eso.' : a.accion === 'cobrada' ? 'No hay facturas pendientes de cobro con eso.' : 'No hay facturas cobradas con eso.' };
      if (valen.length > MAXIMO_BLOQUE) return { ok: false, error: `Son ${valen.length}: como mucho ${MAXIMO_BLOQUE} de una vez.` };
      const suma = valen.reduce((t, f) => t + f.totales.total, 0);
      const que = { emitir: 'Emitir', cobrada: `Marcar como cobradas${a.fecha ? ` el ${a.fecha}` : ' hoy'}`, pendiente: 'Volver a dejar pendientes de cobro' }[a.accion];
      return {
        ok: true,
        resumen: `${que} ${valen.length === 1 ? '1 factura' : `${valen.length} facturas`} (${dinero(Math.round(suma * 100) / 100)} en total): ${enumerar(valen.map((f) => `${f.codigo ?? 'borrador'} de ${f.cliente.nombre}`), 5)}.${a.accion === 'emitir' ? ' Después no se podrán cambiar ni borrar.' : ''}`,
        argumentos: { facturas: valen.map((f) => f.id), accion: a.accion, fecha: a.fecha ?? null },
      };
    },
    async aplicar(ctx, a: { facturas?: string[] | null; accion: 'emitir' | 'cobrada' | 'pendiente'; fecha?: string | null }) {
      let hechas = 0;
      const fallos: string[] = [];
      for (const id of a.facturas ?? []) {
        const f = await ctx.repos.facturas.obtener(id);
        if (!f) continue;
        if (a.accion === 'emitir') {
          const r = await emitirFactura(ctx.repos, f, ctx.usuario.email);
          if (r.ok) hechas++;
          else fallos.push(`${f.cliente.nombre}: ${r.errores[0]?.mensaje ?? 'no se pudo'}`);
        } else if (await ctx.repos.facturas.marcarCobrada(f.id, a.accion === 'cobrada' ? (a.fecha ?? ctx.hoy) : null)) hechas++;
      }
      if (hechas) await ctx.repos.auditoria.registrar(ctx.usuario.email, `factura ${a.accion}`, `${hechas} facturas (asistente, en bloque)`);
      const verbo = { emitir: 'emitidas', cobrada: 'marcadas como cobradas', pendiente: 'pendientes de cobro otra vez' }[a.accion];
      return { ok: hechas > 0, texto: `${hechas} ${hechas === 1 ? 'factura' : 'facturas'} ${verbo}.${fallos.length ? ` No se pudo con ${enumerar(fallos, 3)}.` : ''}` };
    },
  }),
  cambio({
    nombre: 'gestionar_gastos',
    descripcion: 'Sobre VARIOS gastos a la vez: «confirmar» los tickets por revisar (pasan a contar en las cuentas) o cambiarles el tipo («categoria»). Elige por ids, estado, tienda, tipo actual o fechas.',
    permiso: 'gastos',
    esquema: z.object({
      gastos: opcional(z.array(z.string()).max(MAXIMO_BLOQUE)),
      estado: opcional(z.enum(['revisar', 'confirmado'])),
      proveedor: opcional(z.string().max(80)).describe('Parte del nombre de la tienda o proveedor'),
      categoriaActual: opcional(z.enum(CATEGORIAS.map((c) => c.id) as [string, ...string[]])),
      desde: opcional(fecha),
      hasta: opcional(fecha),
      accion: z.enum(['confirmar', 'categoria']),
      categoria: opcional(z.enum(CATEGORIAS.map((c) => c.id) as [string, ...string[]])).describe('Tipo nuevo (con accion «categoria»)'),
    }),
    async preparar(
      { repos, hoy },
      a: { gastos?: string[] | null; estado?: 'revisar' | 'confirmado' | null; proveedor?: string | null; categoriaActual?: string | null; desde?: string | null; hasta?: string | null; accion: 'confirmar' | 'categoria'; categoria?: string | null },
    ) {
      if (!a.gastos?.length && !a.estado && !a.proveedor && !a.categoriaActual && !a.desde && !a.hasta) return { ok: false, error: 'Di qué gastos: ids, estado, tienda, tipo o fechas.' };
      if (a.accion === 'categoria' && !a.categoria) return { ok: false, error: 'Falta el tipo nuevo.' };
      let lista = await repos.gastos.listar({ estado: a.estado ?? undefined, desde: a.desde ?? undefined, hasta: a.hasta ?? undefined, limite: 20000 });
      if (a.gastos?.length) lista = lista.filter((g) => a.gastos!.includes(g.id));
      if (a.proveedor) lista = lista.filter((g) => normalizar(g.proveedor).includes(normalizar(a.proveedor!)));
      if (a.categoriaActual) lista = lista.filter((g) => g.categoria === a.categoriaActual);
      lista = a.accion === 'confirmar' ? lista.filter((g) => g.estado === 'revisar') : lista.filter((g) => g.categoria !== a.categoria);
      if (!lista.length) return { ok: false, error: a.accion === 'confirmar' ? 'No hay tickets por revisar con eso.' : 'Esos gastos ya son de ese tipo.' };
      if (lista.length > MAXIMO_BLOQUE) return { ok: false, error: `Son ${lista.length}: como mucho ${MAXIMO_BLOQUE} de una vez.` };
      const incompletos = lista.filter((g) => !g.proveedor || !g.categoria || !(g.total > 0) || !g.fecha || g.fecha > hoy);
      if (a.accion === 'confirmar' && incompletos.length) return { ok: false, error: `Antes hay que completar ${incompletos.length === 1 ? 'un ticket' : `${incompletos.length} tickets`} (tienda, tipo, total o fecha): ${enumerar(incompletos.map((g) => g.proveedor || g.id), 3)}.` };
      const suma = Math.round(lista.reduce((t, g) => t + g.total, 0) * 100) / 100;
      const avisos = lista.filter((g) => g.avisos.length).length;
      const que = a.accion === 'confirmar' ? 'Confirmar' : `Pasar a «${nombreCategoria(a.categoria!)}»`;
      return {
        ok: true,
        resumen: `${que} ${lista.length === 1 ? '1 gasto' : `${lista.length} gastos`} (${dinero(suma)}): ${enumerar(lista.map((g) => `${g.proveedor} ${dinero(g.total)}`), 5)}.${a.accion === 'confirmar' && avisos ? ` Ojo: ${avisos} con avisos del lector de tickets.` : ''}`,
        argumentos: { gastos: lista.map((g) => g.id), accion: a.accion, categoria: a.categoria ?? null },
      };
    },
    async aplicar(ctx, a: { gastos?: string[] | null; accion: 'confirmar' | 'categoria'; categoria?: string | null }) {
      let hechos = 0;
      for (const id of a.gastos ?? []) {
        const g = await ctx.repos.gastos.obtener(id);
        if (!g) continue;
        const nuevo = a.accion === 'confirmar' ? { ...g, estado: 'confirmado' as const } : { ...g, categoria: a.categoria! };
        await ctx.repos.gastos.guardar({ ...nuevo, actualizado: new Date().toISOString() });
        hechos++;
      }
      if (hechos) await ctx.repos.auditoria.registrar(ctx.usuario.email, 'gasto guardado', `${hechos} gastos: ${a.accion} (asistente, en bloque)`);
      return { ok: hechos > 0, texto: hechos ? `${hechos === 1 ? '1 gasto' : `${hechos} gastos`} ${a.accion === 'confirmar' ? 'confirmados: ya cuentan en las cuentas' : 'cambiados de tipo'}.` : 'No se ha cambiado ninguno.' };
    },
  }),
  cambio({
    nombre: 'cambiar_clientes',
    descripcion: 'Cambia VARIOS clientes a la vez: recargo de equivalencia, provincia, país, o archivarlos/recuperarlos. Elige por nombres, texto (nombre, NIF o población) o todos.',
    permiso: 'facturas',
    esquema: z.object({
      clientes: opcional(z.array(z.string()).max(MAXIMO_BLOQUE)).describe('Nombres, NIF o ids'),
      texto: opcional(z.string().max(80)),
      todos: opcional(z.boolean()),
      recargo: opcional(z.boolean()),
      provincia: opcional(z.string().max(100)),
      pais: opcional(z.string().max(60)),
      archivar: opcional(z.boolean()).describe('true = archivar; false = recuperar'),
    }),
    async preparar(
      { repos },
      a: { clientes?: string[] | null; texto?: string | null; todos?: boolean | null; recargo?: boolean | null; provincia?: string | null; pais?: string | null; archivar?: boolean | null },
    ) {
      if (!a.clientes?.length && !a.texto && !a.todos) return { ok: false, error: 'Di qué clientes: nombres, un texto o todos.' };
      if (a.recargo == null && a.provincia == null && a.pais == null && a.archivar == null) return { ok: false, error: 'No hay ningún cambio.' };
      let lista = await repos.clientes.listar({ incluirArchivados: true });
      if (a.clientes?.length) {
        const ids = new Set<string>();
        for (const n of a.clientes) {
          const c = await unCliente(repos, n);
          if (!c.ok) return c;
          ids.add(c.cliente.id);
        }
        lista = lista.filter((c) => ids.has(c.id));
      } else if (a.archivar !== false) lista = lista.filter((c) => !c.archivado);
      if (a.texto) lista = lista.filter((c) => normalizar(`${c.nombre} ${c.nif} ${c.poblacion}`).includes(normalizar(a.texto!)));
      if (!lista.length) return { ok: false, error: 'Ningún cliente cumple eso.' };
      const partes = [a.recargo != null ? `recargo de equivalencia: ${a.recargo ? 'sí' : 'no'}` : '', a.provincia ? `provincia: ${a.provincia}` : '', a.pais ? `país: ${a.pais}` : '', a.archivar != null ? (a.archivar ? 'archivar' : 'recuperar') : ''].filter(Boolean);
      return { ok: true, resumen: `${lista.length === 1 ? '1 cliente' : `${lista.length} clientes`} (${enumerar(lista.map((c) => c.nombre), 6)}): ${partes.join('; ')}.`, argumentos: { ...a, clientes: lista.map((c) => c.id), texto: null, todos: null } };
    },
    async aplicar(ctx, a: { clientes?: string[] | null; recargo?: boolean | null; provincia?: string | null; pais?: string | null; archivar?: boolean | null }) {
      let hechos = 0;
      for (const id of a.clientes ?? []) {
        const c = await ctx.repos.clientes.obtener(id);
        if (!c) continue;
        await ctx.repos.clientes.guardar(
          { ...c, ...(a.recargo != null ? { recargo: a.recargo } : {}), ...(a.provincia ? { provincia: a.provincia } : {}), ...(a.pais ? { pais: a.pais } : {}), ...(a.archivar != null ? { archivado: a.archivar } : {}) },
          ctx.usuario.email,
        );
        hechos++;
      }
      return { ok: hechos > 0, texto: hechos ? `${hechos === 1 ? '1 cliente cambiado' : `${hechos} clientes cambiados`}.` : 'No se ha cambiado ninguno.' };
    },
  }),
  cambio({
    nombre: 'cambiar_textos_web',
    descripcion: 'Cambia VARIOS textos de la web a la vez (de una o varias secciones) con un solo «Sí». Cada elemento es como en cambiar_texto_web.',
    permiso: 'editar',
    esquema: z.object({
      textos: z
        .array(z.object({ seccion: z.string(), campo: z.string(), es: opcional(z.string().max(2000)), en: opcional(z.string().max(2000)), valor: opcional(z.union([z.string().max(2000), z.number(), z.boolean()])) }))
        .min(1)
        .max(40),
    }),
    async preparar(ctx, a: { textos: TextoWeb[] }) {
      const resumenes: string[] = [];
      for (const t of a.textos) {
        const r = await prepararTexto(ctx.repos, t);
        if (!r.ok) return { ok: false, error: `${t.seccion} → ${t.campo}: ${r.error}` };
        resumenes.push(r.resumen);
      }
      return { ok: true, resumen: `${a.textos.length} textos: ${resumenes.join(' ')}`, argumentos: a };
    },
    async aplicar(ctx, a: { textos: TextoWeb[] }) {
      // Se agrupan por sección: un solo guardado (y un solo cambio en el historial) por sección.
      const porSeccion = new Map<string, TextoWeb[]>();
      for (const t of a.textos) porSeccion.set(t.seccion, [...(porSeccion.get(t.seccion) ?? []), t]);
      for (const [seccion, textos] of porSeccion) {
        const [coleccion, id] = seccion.split('/') as [Coleccion, string];
        const e = await ctx.repos.contenido.obtener(coleccion, id);
        if (!e) return { ok: false, texto: `La sección ${seccion} no existe.` };
        const datos = structuredClone(e.borrador.datos);
        for (const t of textos) ponerRuta(datos, t.campo, valorTexto(leerRuta(datos, t.campo), t));
        const r = await guardarTextos(ctx.repos, coleccion, id, datos, e.borrador.cuerpo, autor(ctx));
        if (!r.ok) return { ok: false, texto: `${seccion}: ${r.errores.map((x) => x.mensaje).join(' ')}` };
      }
      return { ok: true, texto: 'Guardado como borrador: saldrá en la web al publicar.' };
    },
  }),
];

export const herramientasDe = (rol: Usuario['rol']) => HERRAMIENTAS.filter((h) => puede(rol, h.permiso));
export const herramienta = (nombre: string) => HERRAMIENTAS.find((h) => h.nombre === nombre);

/**
 * Grupos de herramientas por tema. En cada mensaje solo se mandan al modelo las
 * de los temas que salen en la conversación reciente (las 26 juntas son ~22.000
 * caracteres por paso: lo que más gasta del cupo diario de IA). Si no se reconoce
 * ningún tema, van todas.
 */
const TEMAS: { palabras: RegExp; herramientas: string[] }[] = [
  {
    palabras: /plant|palmer|palmit|olivo|higuer|cica|yuca|especie|precio|agotad|disponib|stock|catalog|ficha|revisad|destacad|formato|maceta|cepell|altura|unidad|foto|familia|vend[eo]/,
    herramientas: ['buscar_plantas', 'cambiar_planta', 'crear_planta', 'quitar_o_recuperar_planta', 'cambiar_plantas'],
  },
  { palabras: /presupuest|pedido|solicitud|peticion|pidi/, herramientas: ['ver_presupuestos', 'cambiar_presupuesto', 'cambiar_presupuestos'] },
  {
    palabras: /factur|client|cobr|nif|cif|rectific|emit|vencid|iva|deb[ei]|pendiente de pago|borrador/,
    herramientas: ['ver_facturas', 'ver_clientes', 'guardar_cliente', 'crear_factura', 'gestionar_factura', 'gestionar_facturas', 'cambiar_clientes'],
  },
  { palabras: /gast|ticket|compra|proveedor|gasolin|recibo|tienda/, herramientas: ['ver_gastos', 'registrar_gasto', 'gestionar_gastos'] },
  { palabras: /informe|ingres|benefic|resultado|margen|trimestre|cifra|ganad|ventas|facturad|mes |este mes|ano|año/, herramientas: ['informe'] },
  {
    palabras: /texto|web|portada|telefono|horario|condicion|pagina|publica|deshac|cambio|empresa|direccion|correo|email|minimo|plazo|envio/,
    herramientas: ['ver_textos_web', 'cambiar_texto_web', 'cambiar_textos_web', 'publicar_cambios', 'cambios_recientes', 'deshacer_cambio'],
  },
];

/** Herramientas para un texto (mensaje actual y los anteriores); `resumen_vivero` siempre. */
export function herramientasPara(lista: Herramienta[], texto: string): Herramienta[] {
  const t = normalizar(texto);
  const nombres = new Set(['resumen_vivero', ...TEMAS.filter((g) => g.palabras.test(t)).flatMap((g) => g.herramientas)]);
  return nombres.size === 1 ? lista : lista.filter((h) => nombres.has(h.nombre));
}
