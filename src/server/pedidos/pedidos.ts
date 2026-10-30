import { categoria as categoriaCatalogo } from '../catalogo/catalogo.ts';
import type { ResultadoEscandallo } from '../catalogo/escandallo.ts';
import type { ArticuloCatalogo, EstadoPedido, Gasto, LineaPedido, PedidoProveedor, Proveedor, Repositorios } from '../data/tipos.ts';
import { gastoVacio } from '../gastos/gastos.ts';
import { numero } from '../presupuestos-cliente/formulario.ts';
import { claveProveedor } from '../proveedores/proveedores.ts';

/**
 * Pedidos de material a proveedor (módulo `pedidosProveedor`):
 * - Borrador → enviado → recibido. Solo el borrador se cambia o se borra.
 * - Lo que se le envía (mensaje y PDF) nunca lleva precios: el coste es interno.
 * - Las líneas salen del catálogo (artículos, o los materiales de un trabajo
 *   con sus medidas) o se escriben a mano.
 * - Al recibirlo, se puede apuntar como gasto (por revisar, como un ticket).
 */
export interface Error {
  campo: string;
  mensaje: string;
}

export const NOMBRE_ESTADO_PEDIDO: Record<EstadoPedido, string> = { borrador: 'Por enviar', enviado: 'Esperando', recibido: 'Recibido' };

const cent = (n: number) => Math.round(n * 100);
const tres = (n: number) => Math.round(n * 1000) / 1000;

/** Coste del pedido: cada línea a céntimos (cantidad × coste), y la suma. */
export const costeDe = (lineas: Pick<LineaPedido, 'cantidad' | 'coste'>[]) => lineas.reduce((t, l) => t + cent(tres(l.cantidad) * l.coste), 0) / 100;

export interface EntradaPedido {
  proveedorId: string;
  presupuestoClienteId: string | null;
  entrega: string | null;
  lineas: LineaPedido[];
  notas: string;
  notasInternas: string;
}

const fechaValida = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(`${f}T12:00:00Z`));
const recorta = (t: string, max: number) => t.trim().slice(0, max);

/** El formulario del editor: líneas `l0.concepto`, `l0.cantidad`… (las vacías no cuentan). */
export function leerFormularioPedido(form: FormData): EntradaPedido & { filas: number } {
  const v = (n: string) => String(form.get(n) ?? '');
  const filas = Math.min(Math.max(Number(v('filas')) || 0, 0), 200);
  const lineas: LineaPedido[] = [];
  for (let i = 0; i < filas; i++) {
    const concepto = recorta(v(`l${i}.concepto`), 200);
    const cantidad = v(`l${i}.cantidad`);
    if (!concepto) continue;
    lineas.push({
      articuloId: v(`l${i}.articulo`) || null,
      concepto,
      referencia: recorta(v(`l${i}.referencia`), 60),
      detalle: recorta(v(`l${i}.detalle`), 200),
      cantidad: numero(cantidad) ?? Number.NaN,
      unidad: recorta(v(`l${i}.unidad`), 10) || 'ud',
      coste: numero(v(`l${i}.coste`)) ?? 0,
    });
  }
  const entrega = v('entrega').trim();
  return { proveedorId: v('proveedorId'), presupuestoClienteId: v('presupuestoClienteId') || null, entrega: entrega || null, lineas, notas: recorta(v('notas'), 1000), notasInternas: recorta(v('notasInternas'), 1000), filas };
}

export function validarPedido(e: EntradaPedido, proveedor: Proveedor | null): Error[] {
  const errores: Error[] = [];
  if (!proveedor) errores.push({ campo: 'proveedorId', mensaje: 'Elige a qué proveedor se lo pides.' });
  else if (proveedor.archivado) errores.push({ campo: 'proveedorId', mensaje: 'Ese proveedor está oculto: vuelve a usarlo desde su ficha o elige otro.' });
  if (e.entrega && !fechaValida(e.entrega)) errores.push({ campo: 'entrega', mensaje: 'La fecha de entrega no es válida.' });
  if (!e.lineas.length) errores.push({ campo: 'lineas', mensaje: 'Añade al menos una cosa que pedir.' });
  e.lineas.forEach((l, i) => {
    if (!(Number.isFinite(l.cantidad) && l.cantidad > 0 && l.cantidad <= 100_000)) errores.push({ campo: `l${i}.cantidad`, mensaje: `Línea ${i + 1}: escribe cuánto pides (un número mayor que 0).` });
    if (!(Number.isFinite(l.coste) && l.coste >= 0 && l.coste <= 1_000_000)) errores.push({ campo: `l${i}.coste`, mensaje: `Línea ${i + 1}: el coste no es válido.` });
  });
  return errores;
}

const datosProveedor = (p: Proveedor): PedidoProveedor['proveedor'] => ({ nombre: p.nombre, nif: p.nif, contacto: p.contacto, telefono: p.telefono, email: p.email });

type Resultado = { ok: true; pedido: PedidoProveedor } | { ok: false; errores: Error[] };

export async function crearPedido(repos: Repositorios, e: EntradaPedido, email: string, hoy: string, id: string = crypto.randomUUID()): Promise<Resultado> {
  const proveedor = e.proveedorId ? await repos.proveedores.obtener(e.proveedorId) : null;
  const errores = validarPedido(e, proveedor);
  if (errores.length || !proveedor) return { ok: false, errores };
  const pedido = await repos.pedidosProveedor.crear(
    { id, estado: 'borrador', proveedorId: proveedor.id, proveedor: datosProveedor(proveedor), presupuestoClienteId: e.presupuestoClienteId, fecha: hoy, entrega: e.entrega, lineas: e.lineas, notas: e.notas, notasInternas: e.notasInternas, coste: costeDe(e.lineas), enviadoEl: null, recibidoEl: null, gastoId: null },
    email,
  );
  return { ok: true, pedido };
}

/** Cambiar un pedido: solo en borrador (lo enviado ya lo tiene el proveedor). */
export async function cambiarPedido(repos: Repositorios, id: string, e: EntradaPedido, email: string): Promise<Resultado> {
  const previo = await repos.pedidosProveedor.obtener(id);
  if (!previo) return { ok: false, errores: [{ campo: 'pedido', mensaje: 'Ese pedido no existe.' }] };
  if (previo.estado !== 'borrador') return { ok: false, errores: [{ campo: 'pedido', mensaje: 'Solo se cambia un pedido por enviar. Vuelve a ponerlo por enviar primero.' }] };
  const proveedor = e.proveedorId ? await repos.proveedores.obtener(e.proveedorId) : null;
  const errores = validarPedido(e, proveedor);
  if (errores.length || !proveedor) return { ok: false, errores };
  const pedido: PedidoProveedor = { ...previo, proveedorId: proveedor.id, proveedor: datosProveedor(proveedor), presupuestoClienteId: e.presupuestoClienteId, entrega: e.entrega, lineas: e.lineas, notas: e.notas, notasInternas: e.notasInternas, coste: costeDe(e.lineas) };
  await repos.pedidosProveedor.guardar(pedido, email);
  return { ok: true, pedido };
}

/** A qué estados se puede pasar desde cada uno. */
export const pasosPedido = (e: EstadoPedido): EstadoPedido[] => (e === 'borrador' ? ['enviado'] : e === 'enviado' ? ['recibido', 'borrador'] : ['enviado']);

export async function cambiarEstadoPedido(repos: Repositorios, id: string, nuevo: EstadoPedido, email: string, hoy: string): Promise<{ ok: true; pedido: PedidoProveedor } | { ok: false; error: string }> {
  const p = await repos.pedidosProveedor.obtener(id);
  if (!p) return { ok: false, error: 'Ese pedido no existe.' };
  if (!pasosPedido(p.estado).includes(nuevo)) return { ok: false, error: `Un pedido ${NOMBRE_ESTADO_PEDIDO[p.estado].toLowerCase()} no puede pasar a ${NOMBRE_ESTADO_PEDIDO[nuevo].toLowerCase()}.` };
  const pedido: PedidoProveedor = {
    ...p,
    estado: nuevo,
    enviadoEl: nuevo === 'enviado' ? (p.enviadoEl ?? hoy) : nuevo === 'borrador' ? null : p.enviadoEl,
    recibidoEl: nuevo === 'recibido' ? hoy : null,
  };
  await repos.pedidosProveedor.guardar(pedido, email);
  return { ok: true, pedido };
}

const cifra = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 3 });
const fechaEs = (iso: string) => iso.split('-').reverse().join('/');

/** Una línea tal como la lee el proveedor: cantidad, unidad, qué, referencia y detalle. Sin precio. */
export const textoLinea = (l: LineaPedido) => `${cifra(l.cantidad)} ${l.unidad} · ${l.concepto}${l.referencia ? ` (ref. ${l.referencia})` : ''}${l.detalle ? ` · ${l.detalle}` : ''}`;

/** Mensaje para el proveedor (WhatsApp o correo). Nunca lleva precios ni costes. */
export function mensajePedido(p: PedidoProveedor, empresa: string): string {
  return [
    `Hola${p.proveedor.contacto ? ` ${p.proveedor.contacto}` : ''}, soy de ${empresa || '[PLACEHOLDER: nombre de la empresa]'}.`,
    `Os hago el pedido ${p.codigo}:`,
    ...p.lineas.map((l) => `- ${textoLinea(l)}`),
    ...(p.entrega ? [`Lo necesitamos para el ${fechaEs(p.entrega)}.`] : []),
    ...(p.notas ? [p.notas] : []),
    '¿Me confirmáis plazo y precio? Gracias.',
  ].join('\n');
}

export function enlaceWhatsappPedido(p: PedidoProveedor, empresa: string): string {
  let tel = p.proveedor.telefono.replace(/\D/g, '');
  if (tel.length === 9) tel = `34${tel}`;
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensajePedido(p, empresa))}`;
}

export const enlaceCorreoPedido = (p: PedidoProveedor, empresa: string) => `mailto:${encodeURIComponent(p.proveedor.email)}?subject=${encodeURIComponent(`Pedido ${p.codigo}${empresa ? ` de ${empresa}` : ''}`)}&body=${encodeURIComponent(mensajePedido(p, empresa))}`;

/** Grupos del escandallo que no se piden a un proveedor (son horas o servicios propios). */
const NO_SE_PIDEN = new Set(['Mano de obra', 'Servicios']);

/**
 * Los materiales de un trabajo del catálogo (con sus medidas) como líneas de
 * pedido: un artículo por línea (juntos si se repite), con la merma, la
 * cantidad redondeada hacia arriba a centésimas y su referencia y coste.
 */
export function lineasDeTrabajo(e: Pick<ResultadoEscandallo, 'lineas'>, articulos: ArticuloCatalogo[], detalle: string): LineaPedido[] {
  const porId = new Map(articulos.map((a) => [a.id, a]));
  const juntas = new Map<string, LineaPedido>();
  for (const l of e.lineas) {
    if (NO_SE_PIDEN.has(l.grupo) || !l.articuloId) continue;
    const a = porId.get(l.articuloId);
    const ya = juntas.get(l.articuloId);
    if (ya) ya.cantidad = tres(ya.cantidad + l.cantidad);
    else juntas.set(l.articuloId, { articuloId: l.articuloId, concepto: l.articulo, referencia: a?.referencia ?? '', detalle: [a?.acabado, detalle].filter(Boolean).join(' · ').slice(0, 200), cantidad: l.cantidad, unidad: l.unidad, coste: l.costeUnidad });
  }
  return [...juntas.values()].map((l) => ({ ...l, cantidad: Math.ceil(tres(l.cantidad) * 100) / 100 }));
}

/** El proveedor al que más se le compra de esas líneas (por el nombre escrito en cada artículo). */
export function proveedorProbable(lineas: LineaPedido[], articulos: ArticuloCatalogo[], proveedores: Proveedor[]): Proveedor | null {
  const porId = new Map(articulos.map((a) => [a.id, a]));
  const votos = new Map<string, number>();
  for (const l of lineas) {
    const a = l.articuloId ? porId.get(l.articuloId) : null;
    const p = a?.proveedor ? proveedores.find((x) => claveProveedor(x.nombre) === claveProveedor(a.proveedor)) : null;
    if (p) votos.set(p.id, (votos.get(p.id) ?? 0) + 1);
  }
  const [mejor] = [...votos.entries()].sort((x, y) => y[1] - x[1]);
  return mejor ? (proveedores.find((p) => p.id === mejor[0]) ?? null) : null;
}

/** Tipo de gasto de la carpintería según la categoría del artículo del catálogo. */
const GASTO_DE_CATEGORIA: Record<string, string> = {
  tableros: 'tableros',
  macizos: 'tableros',
  encimeras: 'tableros',
  chapas: 'cantos',
  cantos: 'cantos',
  cristal: 'cristal',
  herrajes: 'herrajes',
  tiradores: 'herrajes',
  accesorios: 'herrajes',
  iluminacion: 'herrajes',
  consumibles: 'consumibles',
  acabados: 'acabados',
};

/**
 * El gasto de un pedido recibido, por revisar (como un ticket leído): el
 * proveedor, una línea por cosa con su coste e IVA del 21 %, y el tipo de lo
 * que más pesa. Se revisa con la factura del proveedor antes de confirmarlo.
 */
export function gastoDePedido(p: PedidoProveedor, articulos: ArticuloCatalogo[], email: string, hoy: string, iva = 21): Gasto {
  const porId = new Map(articulos.map((a) => [a.id, a]));
  const pesos = new Map<string, number>();
  for (const l of p.lineas) {
    const cat = l.articuloId ? porId.get(l.articuloId)?.categoria : undefined;
    const tipo = (cat && GASTO_DE_CATEGORIA[cat]) || 'otros';
    pesos.set(tipo, (pesos.get(tipo) ?? 0) + l.cantidad * l.coste);
  }
  const [tipo] = [...pesos.entries()].sort((a, b) => b[1] - a[1]);
  const base = costeDe(p.lineas);
  const cuota = Math.round(base * iva) / 100;
  return {
    ...gastoVacio(email),
    fecha: hoy,
    proveedor: p.proveedor.nombre,
    nifProveedor: p.proveedor.nif,
    categoria: tipo?.[0] ?? 'otros',
    lineas: p.lineas.map((l) => ({ concepto: l.concepto, cantidad: l.cantidad, importe: Math.round(tres(l.cantidad) * l.coste * (100 + iva)) / 100 })),
    base,
    iva: cuota,
    total: Math.round((base + cuota) * 100) / 100,
    formaPago: 'Transferencia',
    notas: `Pedido ${p.codigo}. Revisa los importes con la factura del proveedor.`,
    avisos: p.lineas.some((l) => !(l.coste > 0)) ? ['Hay líneas sin coste en el pedido: completa el importe con la factura.'] : [],
  };
}

/** Coste por unidad del catálogo para una línea nueva (0 si el artículo no tiene coste). */
export const costeDeArticulo = (a: Pick<ArticuloCatalogo, 'coste'>) => (a.coste > 0 ? a.coste : 0);

export const unidadDe = (a: Pick<ArticuloCatalogo, 'unidad' | 'categoria'>) => a.unidad || categoriaCatalogo(a.categoria)?.unidad || 'ud';
