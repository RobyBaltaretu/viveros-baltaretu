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
import { guardarPlanta, seoPorDefecto, slugDesde, type DatosPlanta } from '../panel/plantas.ts';
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
    descripcion: 'Busca plantas del catálogo por nombre (con faltas vale), familia o disponibilidad. Con «planta» devuelve la ficha completa de una.',
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
      return { total: lista.length, plantas: lista.slice(0, 30).map(fichaCorta) };
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
    esquema: z.object({ limite: opcional(z.number().int().min(1).max(30)) }),
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
    async preparar({ repos }, a: { seccion: string; campo: string; es?: string | null; en?: string | null; valor?: string | number | boolean | null }) {
      const [coleccion, id] = a.seccion.split('/');
      if (!SECCIONES.some((s) => s.coleccion === coleccion && s.id === id)) return { ok: false, error: 'Esa sección no existe. Usa ver_textos_web.' };
      const e = await repos.contenido.obtener(coleccion as Coleccion, id);
      if (!e) return { ok: false, error: 'Esa sección no existe.' };
      const actual = leerRuta(e.borrador.datos, a.campo);
      if (actual === undefined) return { ok: false, error: `No existe el campo «${a.campo}» en ${a.seccion}.` };
      const bilingue = actual && typeof actual === 'object' && 'es' in (actual as object);
      if (bilingue ? !a.es && !a.en : a.valor === undefined || a.valor === null) return { ok: false, error: bilingue ? 'Falta el texto en español o en inglés.' : 'Falta el valor nuevo.' };
      const nuevo = bilingue ? { ...(actual as object), ...(a.es ? { es: a.es } : {}), ...(a.en ? { en: a.en } : {}) } : a.valor;
      return { ok: true, resumen: `${a.seccion} → ${a.campo}: «${recortar(bilingue ? (nuevo as { es: string }).es : nuevo, 120)}».`, argumentos: a };
    },
    async aplicar(ctx, a: { seccion: string; campo: string; es?: string | null; en?: string | null; valor?: string | number | boolean | null }) {
      const [coleccion, id] = a.seccion.split('/') as [Coleccion, string];
      const e = await ctx.repos.contenido.obtener(coleccion, id);
      if (!e) return { ok: false, texto: 'Esa sección no existe.' };
      const datos = structuredClone(e.borrador.datos);
      const actual = leerRuta(datos, a.campo);
      const bilingue = actual && typeof actual === 'object' && 'es' in (actual as object);
      ponerRuta(datos, a.campo, bilingue ? { ...(actual as object), ...(a.es ? { es: a.es } : {}), ...(a.en ? { en: a.en } : {}) } : a.valor);
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
    descripcion: 'Deshace un cambio guardado (número de cambios_recientes).',
    permiso: 'editar',
    esquema: z.object({ cambioId: z.number().int().positive() }),
    async preparar({ repos }, a: { cambioId: number }) {
      const c = (await repos.contenido.historial({ limite: 200 })).find((x) => x.id === a.cambioId);
      return c ? { ok: true, resumen: `Deshacer: ${describirCambio(c)} (${c.fecha.slice(0, 10)}).`, argumentos: a } : { ok: false, error: 'No encuentro ese cambio.' };
    },
    async aplicar(ctx, a: { cambioId: number }) {
      const c = await ctx.repos.contenido.deshacer(a.cambioId, autor(ctx));
      return c ? { ok: true, texto: 'Deshecho. Publica para que la web lo recoja.' } : { ok: false, texto: 'No se ha podido deshacer.' };
    },
  }),
];

export const herramientasDe = (rol: Usuario['rol']) => HERRAMIENTAS.filter((h) => puede(rol, h.permiso));
export const herramienta = (nombre: string) => HERRAMIENTAS.find((h) => h.nombre === nombre);
