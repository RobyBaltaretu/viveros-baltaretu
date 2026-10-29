import type { Factura, Gasto, PresupuestoCliente } from '../server/data/tipos.ts';
import { cifras, cobros, periodoAnterior, periodoDe } from '../server/informes/informes.ts';
import { dinero } from '../server/facturas/importes.ts';
import { estadoEfectivo } from '../server/presupuestos-cliente/presupuestos.ts';

/**
 * Inicio del diseño nuevo: las cifras que importan (KPIs del mes) y «Por
 * hacer», una lista de cosas concretas, cada una con su acción, de la más
 * urgente a la menos. Todo se calcula aquí, sin consultas: la página trae los
 * datos y esto decide qué enseñar (y se prueba sin base de datos).
 */

export interface Kpi {
  id: 'facturado' | 'porCobrar' | 'enJuego' | 'aceptacion';
  nombre: string;
  /** Importe en euros o porcentaje (según `formato`); null si aún no hay datos. */
  valor: number | null;
  formato: 'euros' | 'porcentaje';
  /** Frase corta debajo de la cifra. */
  nota: string;
  /** Tono de la nota: aviso si hay algo que mirar. */
  tono: 'normal' | 'aviso' | 'bien';
  href: string;
}

export interface Tarea {
  id: string;
  /** rojo: dinero vencido; naranja: caduca pronto; azul: siguiente paso; gris: rutina. */
  color: 'rojo' | 'naranja' | 'azul' | 'gris';
  titulo: string;
  detalle: string;
  accion: string;
  href: string;
}

export interface MesFacturado {
  etiqueta: string;
  /** Base sin IVA de lo facturado (emitidas y cobradas) ese mes. */
  base: number;
  actual: boolean;
}

export interface DatosInicio {
  hoy: string;
  /** Facturas desde hace seis meses (emitidas, cobradas, borradores…). */
  facturas: Factura[];
  /** Gastos confirmados del mes. */
  gastosMes: Gasto[];
  ticketsPorRevisar: number;
  presupuestos: PresupuestoCliente[];
  /** Qué secciones existen para este cliente y rol. */
  ver: { facturas: boolean; presupuestos: boolean; gastos: boolean; informes: boolean };
}

const DIA = 86_400_000;
const dias = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / DIA);
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const eur = dinero;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const hace = (n: number) => (n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`);
const dentroDe = (n: number) => (n <= 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`);
const nombreCliente = (c: { nombre: string }) => c.nombre || 'Sin nombre';
// Como en los informes: en el modo de pruebas cuentan también las facturas de prueba.
const cuentan = (f: Factura) => f.estado === 'emitida' || f.estado === 'cobrada';

/** Un presupuesto enviado sin respuesta en este tiempo merece una llamada (T-07). */
export const DIAS_SIN_RESPUESTA = 15;
/** Aviso de que un presupuesto enviado caduca pronto. */
export const DIAS_AVISO_CADUCA = 5;

export function kpis(d: DatosInicio): Kpi[] {
  const mes = periodoDe('mes', d.hoy);
  const antes = periodoAnterior(mes);
  const reales = d.facturas;
  const ahora = cifras(reales, d.gastosMes, [], mes);
  const previo = cifras(reales, [], [], antes);
  const cobro = cobros(reales, d.hoy);
  const out: Kpi[] = [];
  if (d.ver.facturas) {
    const cambio = previo.ingresos > 0 ? Math.round(((ahora.ingresos - previo.ingresos) / previo.ingresos) * 100) : null;
    out.push({
      id: 'facturado',
      nombre: `Facturado en ${mes.etiqueta.split(' ')[0]}`,
      valor: ahora.ingresos,
      formato: 'euros',
      nota: cambio === null ? `sin IVA · ${plural(ahora.facturas, 'factura', 'facturas')}` : `sin IVA · ${cambio >= 0 ? '+' : ''}${cambio} % que ${antes.etiqueta.split(' ')[0]}`,
      tono: cambio !== null && cambio < 0 ? 'aviso' : 'normal',
      href: '/panel/facturas',
    });
    out.push({
      id: 'porCobrar',
      nombre: 'Por cobrar',
      valor: cobro.pendiente,
      formato: 'euros',
      nota: cobro.vencidas ? `${plural(cobro.vencidas, 'factura vencida', 'facturas vencidas')} (${eur(cobro.vencido)})` : cobro.facturas ? `${plural(cobro.facturas, 'factura', 'facturas')}, ninguna vencida` : 'Todo cobrado',
      tono: cobro.vencidas ? 'aviso' : cobro.facturas ? 'normal' : 'bien',
      href: '/panel/facturas',
    });
  }
  if (d.ver.presupuestos) {
    const enviados = d.presupuestos.filter((p) => estadoEfectivo(p, d.hoy) === 'enviado');
    out.push({
      id: 'enJuego',
      nombre: 'Presupuestos en juego',
      valor: Math.round(enviados.reduce((t, p) => t + p.totales.total, 0) * 100) / 100,
      formato: 'euros',
      nota: enviados.length ? `${plural(enviados.length, 'enviado', 'enviados')}, esperando respuesta` : 'Ninguno esperando respuesta',
      tono: 'normal',
      href: '/panel/presupuestos-cliente',
    });
    // Aceptación de los últimos 90 días: de los que ya tienen respuesta (o caducaron).
    const desde = new Date(Date.parse(d.hoy) - 90 * DIA).toISOString().slice(0, 10);
    const decididos = d.presupuestos.filter((p) => p.fecha >= desde && ['aceptado', 'rechazado', 'caducado'].includes(estadoEfectivo(p, d.hoy)));
    const aceptados = decididos.filter((p) => p.estado === 'aceptado').length;
    out.push({
      id: 'aceptacion',
      nombre: 'Aceptación (90 días)',
      valor: decididos.length ? Math.round((aceptados / decididos.length) * 100) : null,
      formato: 'porcentaje',
      nota: decididos.length ? `${plural(aceptados, 'aceptado', 'aceptados')} de ${decididos.length} con respuesta` : 'Aún sin respuestas',
      tono: 'normal',
      href: '/panel/presupuestos-cliente?ver=aceptados',
    });
  }
  return out;
}

/** Facturado (sin IVA) en los últimos seis meses, para la gráfica de barras. */
export function evolucion(d: DatosInicio): MesFacturado[] {
  const meses: MesFacturado[] = [];
  let p = periodoDe('mes', d.hoy);
  for (let i = 0; i < 6; i++) {
    const base = d.facturas.filter((f) => cuentan(f) && f.fecha >= p.desde && f.fecha <= p.hasta).reduce((t, f) => t + f.totales.base, 0);
    meses.unshift({ etiqueta: MESES_CORTOS[Number(p.desde.slice(5, 7)) - 1]!, base: Math.round(base * 100) / 100, actual: i === 0 });
    p = periodoAnterior(p);
  }
  return meses;
}

/** Lo que hay que hacer, de lo más urgente a lo menos. Cada cosa con su botón. */
export function porHacer(d: DatosInicio): Tarea[] {
  const t: Tarea[] = [];
  if (d.ver.facturas) {
    const vencidas = d.facturas.filter((f) => f.estado === 'emitida' && f.vencimiento < d.hoy).sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
    for (const f of vencidas)
      t.push({ id: `vencida-${f.id}`, color: 'rojo', titulo: `Factura ${f.codigo ?? ''} sin cobrar`.replace('  ', ' '), detalle: `${nombreCliente(f.cliente)} · venció ${hace(dias(f.vencimiento, d.hoy))} · ${eur(f.totales.total)}`, accion: 'Ver', href: `/panel/facturas/${f.id}` });
  }
  if (d.ver.presupuestos) {
    const vivos = d.presupuestos.map((p) => ({ p, e: estadoEfectivo(p, d.hoy) }));
    for (const { p } of vivos.filter((x) => x.e === 'enviado' && x.p.validez && dias(d.hoy, x.p.validez) <= DIAS_AVISO_CADUCA).sort((a, b) => (a.p.validez ?? '').localeCompare(b.p.validez ?? '')))
      t.push({ id: `caduca-${p.id}`, color: 'naranja', titulo: `${p.concepto}: caduca ${dentroDe(dias(d.hoy, p.validez!))}`, detalle: `${p.codigo} · ${nombreCliente(p.cliente)} · ${eur(p.totales.total)}`, accion: 'Ver', href: `/panel/presupuestos-cliente/${p.id}` });
    for (const { p } of vivos.filter((x) => x.e === 'aceptado' && x.p.totales.anticipo > 0 && !x.p.facturaAnticipoId))
      t.push({ id: `anticipo-${p.id}`, color: 'azul', titulo: `Facturar el anticipo de «${p.concepto}»`, detalle: `${p.codigo} · ${nombreCliente(p.cliente)} · ${p.anticipoPct.toString().replace('.', ',')} % = ${eur(p.totales.anticipo)}`, accion: 'Facturar', href: `/panel/presupuestos-cliente/${p.id}` });
    for (const { p } of vivos.filter((x) => x.e === 'aceptado' && x.p.facturaAnticipoId && !x.p.cobroAnticipo))
      t.push({ id: `cobro-${p.id}`, color: 'azul', titulo: `Anticipo por cobrar de «${p.concepto}»`, detalle: `${p.codigo} · ${nombreCliente(p.cliente)} · ${eur(p.totales.anticipo)}`, accion: 'Apuntar cobro', href: `/panel/presupuestos-cliente/${p.id}` });
    const yaCaducan = new Set(t.map((x) => x.id));
    for (const { p } of vivos.filter((x) => x.e === 'enviado' && !yaCaducan.has(`caduca-${x.p.id}`) && dias(x.p.fecha, d.hoy) >= DIAS_SIN_RESPUESTA))
      t.push({ id: `respuesta-${p.id}`, color: 'gris', titulo: `Sin respuesta: «${p.concepto}»`, detalle: `${p.codigo} · ${nombreCliente(p.cliente)} · hecho ${hace(dias(p.fecha, d.hoy))}`, accion: 'Ver', href: `/panel/presupuestos-cliente/${p.id}` });
    for (const { p } of vivos.filter((x) => x.e === 'borrador'))
      t.push({ id: `borrador-${p.id}`, color: 'gris', titulo: `Terminar y enviar «${p.concepto}»`, detalle: `${p.codigo} · ${nombreCliente(p.cliente)} · ${eur(p.totales.total)}`, accion: 'Abrir', href: `/panel/presupuestos-cliente/${p.id}/editar` });
  }
  if (d.ver.facturas) {
    const borradores = d.facturas.filter((f) => f.estado === 'borrador');
    if (borradores.length) t.push({ id: 'facturas-borrador', color: 'gris', titulo: plural(borradores.length, 'factura en borrador', 'facturas en borrador'), detalle: 'Revísalas y emítelas para que cuenten', accion: 'Ver', href: '/panel/facturas?estado=borrador' });
  }
  if (d.ver.gastos && d.ticketsPorRevisar)
    t.push({ id: 'tickets', color: 'gris', titulo: plural(d.ticketsPorRevisar, 'ticket por revisar', 'tickets por revisar'), detalle: 'Leídos de la foto: falta confirmarlos', accion: 'Revisar', href: '/panel/gastos' });
  return t;
}

export const saludo = (hora: number) => (hora < 6 ? 'Buenas noches' : hora < 14 ? 'Buenos días' : hora < 21 ? 'Buenas tardes' : 'Buenas noches');
