import type { Factura, Gasto, Presupuesto } from '../data/tipos.ts';
import { nombreCategoria } from '../gastos/gastos.ts';
import { dinero, importeLinea } from '../facturas/importes.ts';

/**
 * Cálculo de los informes del panel a partir de facturas, gastos y
 * presupuestos. Todo son funciones puras: la página solo pide los datos.
 *
 * Criterios: los ingresos son la base imponible (sin IVA) de las facturas
 * emitidas en el periodo, rectificativas incluidas (restan). Los gastos son los
 * revisados, sin IVA cuando el ticket lo trae y, si no, el total pagado.
 */
export type TipoPeriodo = 'mes' | 'trimestre' | 'anio';

export interface Periodo {
  tipo: TipoPeriodo;
  desde: string;
  hasta: string;
  etiqueta: string;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ultimoDia = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();
const dos = (n: number) => String(n).padStart(2, '0');

/** Periodo que contiene `fecha` (AAAA-MM-DD). */
export function periodoDe(tipo: TipoPeriodo, fecha: string): Periodo {
  const a = Number(fecha.slice(0, 4));
  const m = Number(fecha.slice(5, 7));
  if (tipo === 'mes') return { tipo, desde: `${a}-${dos(m)}-01`, hasta: `${a}-${dos(m)}-${ultimoDia(a, m)}`, etiqueta: `${MESES[m - 1]} de ${a}` };
  if (tipo === 'trimestre') {
    const t = Math.ceil(m / 3);
    const fin = t * 3;
    return { tipo, desde: `${a}-${dos(fin - 2)}-01`, hasta: `${a}-${dos(fin)}-${ultimoDia(a, fin)}`, etiqueta: `${t}.º trimestre de ${a}` };
  }
  return { tipo, desde: `${a}-01-01`, hasta: `${a}-12-31`, etiqueta: `año ${a}` };
}

/** El periodo anterior del mismo tipo (para comparar). */
export function periodoAnterior(p: Periodo): Periodo {
  const d = new Date(`${p.desde}T12:00:00Z`);
  d.setUTCDate(0);
  return periodoDe(p.tipo, d.toISOString().slice(0, 10));
}

export function periodoSiguiente(p: Periodo): Periodo {
  const d = new Date(`${p.hasta}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return periodoDe(p.tipo, d.toISOString().slice(0, 10));
}

const enPeriodo = (fecha: string, p: { desde: string; hasta: string }) => fecha >= p.desde && fecha <= p.hasta;
const r2 = (n: number) => Math.round(n * 100) / 100;
const emitidas = (fs: Factura[]) => fs.filter((f) => f.estado !== 'borrador');
export const baseGasto = (g: Gasto) => g.base ?? g.total;

export interface Cifras {
  ingresos: number;
  facturado: number;
  facturas: number;
  gastos: number;
  resultado: number;
  /** Resultado / ingresos, en %. `null` sin ingresos. */
  margen: number | null;
  ticketMedio: number | null;
  clientes: number;
  ivaRepercutido: number;
  ivaSoportado: number;
  cobrado: number;
  presupuestos: number;
}

export function cifras(fs: Factura[], gs: Gasto[], ps: Presupuesto[], p: { desde: string; hasta: string }): Cifras {
  const f = emitidas(fs).filter((x) => enPeriodo(x.fecha, p));
  const g = gs.filter((x) => x.estado === 'confirmado' && enPeriodo(x.fecha, p));
  const ingresos = r2(f.reduce((t, x) => t + x.totales.base, 0));
  const gastos = r2(g.reduce((t, x) => t + baseGasto(x), 0));
  const ordinarias = f.filter((x) => x.tipo === 'ordinaria');
  return {
    ingresos,
    facturado: r2(f.reduce((t, x) => t + x.totales.total, 0)),
    facturas: ordinarias.length,
    gastos,
    resultado: r2(ingresos - gastos),
    margen: ingresos > 0 ? Math.round(((ingresos - gastos) / ingresos) * 1000) / 10 : null,
    ticketMedio: ordinarias.length ? r2(ordinarias.reduce((t, x) => t + x.totales.base, 0) / ordinarias.length) : null,
    clientes: new Set(f.map((x) => x.clienteId)).size,
    ivaRepercutido: r2(f.reduce((t, x) => t + x.totales.cuotaIva + x.totales.cuotaRecargo, 0)),
    ivaSoportado: r2(g.reduce((t, x) => t + (x.iva ?? 0), 0)),
    cobrado: r2(emitidas(fs).filter((x) => x.estado === 'cobrada' && x.cobradaEl && enPeriodo(x.cobradaEl, p)).reduce((t, x) => t + x.totales.total, 0)),
    presupuestos: ps.filter((x) => enPeriodo(x.fecha.slice(0, 10), p)).length,
  };
}

/** Cambio en % respecto al periodo anterior (`null` si antes era 0). */
export const variacion = (ahora: number, antes: number) => (antes === 0 ? null : Math.round(((ahora - antes) / Math.abs(antes)) * 1000) / 10);

export interface PuntoMes {
  mes: string;
  /** «oct» para el eje y «octubre de 2026» para la tabla. */
  etiqueta: string;
  nombre: string;
  ingresos: number;
  gastos: number;
}

/** Ingresos y gastos de los 12 meses que terminan en el mes de `hasta`. */
export function evolucionMensual(fs: Factura[], gs: Gasto[], hasta: string): PuntoMes[] {
  const a = Number(hasta.slice(0, 4));
  const m = Number(hasta.slice(5, 7));
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 12 + i, 1));
    const mes = d.toISOString().slice(0, 7);
    const p = { desde: `${mes}-01`, hasta: `${mes}-31` };
    const c = cifras(fs, gs, [], p);
    return { mes, etiqueta: MESES[d.getUTCMonth()].slice(0, 3), nombre: `${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`, ingresos: c.ingresos, gastos: c.gastos };
  });
}

export interface Parte {
  nombre: string;
  valor: number;
  detalle?: string;
}

/** Los `n` mayores y el resto sumado en «Otros». */
function principales(mapa: Map<string, number>, n: number, otros = 'Otros'): Parte[] {
  const orden = [...mapa.entries()].filter(([, v]) => v !== 0).sort((x, y) => y[1] - x[1]);
  const top: Parte[] = orden.slice(0, n).map(([nombre, valor]) => ({ nombre, valor: r2(valor) }));
  const resto = orden.slice(n).reduce((t, [, v]) => t + v, 0);
  if (resto) top.push({ nombre: otros, valor: r2(resto) });
  return top;
}

export function gastosPorCategoria(gs: Gasto[], p: { desde: string; hasta: string }): Parte[] {
  const mapa = new Map<string, number>();
  for (const g of gs) if (g.estado === 'confirmado' && enPeriodo(g.fecha, p)) mapa.set(nombreCategoria(g.categoria), (mapa.get(nombreCategoria(g.categoria)) ?? 0) + baseGasto(g));
  return principales(mapa, 7, 'Resto de tipos');
}

export function mejoresClientes(fs: Factura[], p: { desde: string; hasta: string }): Parte[] {
  const mapa = new Map<string, number>();
  for (const f of emitidas(fs)) if (enPeriodo(f.fecha, p)) mapa.set(f.cliente.nombre, (mapa.get(f.cliente.nombre) ?? 0) + f.totales.base);
  return principales(mapa, 5, 'Resto de clientes');
}

export function masVendido(fs: Factura[], p: { desde: string; hasta: string }): Parte[] {
  const importe = new Map<string, number>();
  const unidades = new Map<string, number>();
  for (const f of emitidas(fs))
    if (enPeriodo(f.fecha, p))
      for (const l of f.lineas)
        if (l.concepto) {
          importe.set(l.concepto, (importe.get(l.concepto) ?? 0) + importeLinea(l));
          unidades.set(l.concepto, (unidades.get(l.concepto) ?? 0) + l.cantidad);
        }
  return [...importe.entries()]
    .filter(([, v]) => v > 0)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 8)
    .map(([nombre, valor]) => ({ nombre, valor: r2(valor), detalle: `${String(unidades.get(nombre) ?? 0).replace('.', ',')} uds.` }));
}

export interface Cobros {
  pendiente: number;
  facturas: number;
  vencido: number;
  vencidas: number;
}

export function cobros(fs: Factura[], hoy: string): Cobros {
  const pendientes = fs.filter((f) => f.estado === 'emitida');
  const vencidas = pendientes.filter((f) => f.vencimiento < hoy);
  return {
    pendiente: r2(pendientes.reduce((t, f) => t + f.totales.total, 0)),
    facturas: pendientes.length,
    vencido: r2(vencidas.reduce((t, f) => t + f.totales.total, 0)),
    vencidas: vencidas.length,
  };
}

/** Presupuestos del periodo que acabaron en factura. */
export function conversion(fs: Factura[], ps: Presupuesto[], p: { desde: string; hasta: string }): { recibidos: number; facturados: number; tasa: number | null } {
  const recibidos = ps.filter((x) => enPeriodo(x.fecha.slice(0, 10), p));
  const conFactura = new Set(emitidas(fs).map((f) => f.presupuestoId).filter(Boolean));
  const facturados = recibidos.filter((x) => conFactura.has(x.id)).length;
  return { recibidos: recibidos.length, facturados, tasa: recibidos.length ? Math.round((facturados / recibidos.length) * 100) : null };
}

const pct = (n: number) => `${n > 0 ? '+' : ''}${String(n).replace('.', ',')} %`;

/** Frases cortas con lo más llamativo del periodo. Solo las que tienen datos detrás. */
export function conclusiones(d: {
  actual: Cifras;
  anterior: Cifras;
  periodo: Periodo;
  cobros: Cobros;
  categorias: Parte[];
  categoriasAntes: Parte[];
  clientes: Parte[];
  evolucion: PuntoMes[];
  conversion: { recibidos: number; facturados: number; tasa: number | null };
  porRevisar: number;
}): string[] {
  const frases: string[] = [];
  const { actual: a, anterior: b } = d;
  const vi = variacion(a.ingresos, b.ingresos);
  if (vi !== null && a.ingresos) frases.push(`Los ingresos ${vi >= 0 ? 'suben' : 'bajan'} un ${pct(Math.abs(vi)).replace('+', '')} respecto al periodo anterior (${dinero(b.ingresos)} → ${dinero(a.ingresos)}).`);
  else if (a.ingresos && !b.ingresos) frases.push(`Primeros ingresos registrados: ${dinero(a.ingresos)}.`);
  const vg = variacion(a.gastos, b.gastos);
  if (vg !== null && Math.abs(vg) >= 10) frases.push(`Los gastos ${vg >= 0 ? 'suben' : 'bajan'} un ${pct(Math.abs(vg)).replace('+', '')} (${dinero(b.gastos)} → ${dinero(a.gastos)}).`);
  if (a.ingresos || a.gastos) frases.push(a.resultado >= 0 ? `Resultado positivo de ${dinero(a.resultado)}${a.margen !== null ? ` (margen del ${String(a.margen).replace('.', ',')} %)` : ''}.` : `Los gastos superan a los ingresos en ${dinero(-a.resultado)}.`);
  // El tipo de gasto que más ha crecido en euros.
  let subida: { nombre: string; diferencia: number } | null = null;
  for (const c of d.categorias) {
    if (c.nombre === 'Resto de tipos') continue;
    const antes = d.categoriasAntes.find((x) => x.nombre === c.nombre)?.valor ?? 0;
    if (c.valor - antes > 0 && (!subida || c.valor - antes > subida.diferencia)) subida = { nombre: c.nombre, diferencia: c.valor - antes };
  }
  if (subida && subida.diferencia >= 50) frases.push(`Donde más ha subido el gasto: ${subida.nombre.toLowerCase()} (+${dinero(subida.diferencia)}).`);
  const [mejor] = d.clientes;
  if (mejor && a.ingresos && mejor.nombre !== 'Resto de clientes') frases.push(`Mejor cliente: ${mejor.nombre}, con el ${Math.round((mejor.valor / a.ingresos) * 100)} % de los ingresos.`);
  if (d.cobros.vencidas) frases.push(`Hay ${d.cobros.vencidas} ${d.cobros.vencidas === 1 ? 'factura' : 'facturas'} con la fecha de pago pasada: ${dinero(d.cobros.vencido)} por reclamar.`);
  if (d.conversion.tasa !== null) frases.push(`De ${d.conversion.recibidos} presupuestos recibidos, ${d.conversion.facturados} ya tienen factura (${d.conversion.tasa} %).`);
  const conVentas = d.evolucion.filter((x) => x.ingresos > 0);
  if (conVentas.length >= 3) {
    const pico = conVentas.reduce((x, y) => (y.ingresos > x.ingresos ? y : x));
    frases.push(`En los últimos 12 meses, el mes con más ventas fue ${pico.nombre} (${dinero(pico.ingresos)}).`);
  }
  if (d.porRevisar) frases.push(`Quedan ${d.porRevisar} ${d.porRevisar === 1 ? 'ticket' : 'tickets'} por revisar: no cuentan hasta que se guarden.`);
  return frases;
}
