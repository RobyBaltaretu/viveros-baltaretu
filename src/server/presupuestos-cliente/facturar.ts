import type { Cliente, Factura, LineaFactura, PresupuestoCliente, Repositorios } from '../data/tipos.ts';
import { nuevaFactura, type AjustesFacturacion } from '../facturas/facturas.ts';
import { calcularTotales } from '../facturas/importes.ts';

/**
 * De un presupuesto aceptado a sus facturas (borradores que se revisan y se
 * emiten como cualquier otra, con las reglas de siempre):
 * - Factura de anticipo: una línea por el anticipo. Su base se elige para que
 *   la factura sume exactamente el anticipo del presupuesto (con IVA).
 * - Factura final: las líneas del presupuesto (sin los extras) y, si ya se
 *   facturó el anticipo, una línea que lo descuenta (cantidad −1).
 */
const cent = (euros: number) => Math.round(euros * 100);

/**
 * Base sin IVA cuya factura (base + IVA redondeado) da exactamente `total`.
 * Casi siempre existe; si no, la más cercana (diferencia de 1 céntimo).
 */
export function baseParaTotal(total: number, iva: number): number {
  const objetivo = cent(total);
  const aprox = Math.round(objetivo / (1 + iva / 100));
  let mejor = aprox;
  for (const b of [aprox - 2, aprox - 1, aprox, aprox + 1, aprox + 2]) {
    const t = b + Math.round((b * iva) / 100);
    if (Math.abs(t - objetivo) < Math.abs(mejor + Math.round((mejor * iva) / 100) - objetivo)) mejor = b;
  }
  return mejor / 100;
}

const linea = (concepto: string, cantidad: number, precio: number, iva: number): LineaFactura => ({ concepto, cantidad, precio, descuento: 0, iva });

function borrador(p: PresupuestoCliente, cliente: Cliente, email: string, ajustes: AjustesFacturacion, lineas: LineaFactura[], nota: string): Factura {
  const f = nuevaFactura(cliente, email, ajustes);
  return { ...f, lineas, totales: calcularTotales(lineas, cliente.recargo), formaPago: p.formaPago || f.formaPago, notas: nota };
}

export function facturaDeAnticipo(p: PresupuestoCliente, cliente: Cliente, email: string, ajustes: AjustesFacturacion): Factura {
  const base = baseParaTotal(p.totales.anticipo, p.iva);
  const pct = String(p.anticipoPct).replace('.', ',');
  return borrador(p, cliente, email, ajustes, [linea(`Anticipo del ${pct} % del presupuesto ${p.codigo}: ${p.concepto}`, 1, base, p.iva)], `Anticipo del presupuesto ${p.codigo}.`);
}

export function facturaFinal(p: PresupuestoCliente, cliente: Cliente, email: string, ajustes: AjustesFacturacion, anticipo: Factura | null): Factura {
  const lineas = p.lineas.filter((l) => !l.extra).map((l) => linea(l.material ? `${l.concepto} (${l.material})` : l.concepto, l.cantidad, l.precio, p.iva));
  if (anticipo) lineas.push(linea(`Anticipo ya facturado${anticipo.codigo ? ` en la factura ${anticipo.codigo}` : ''}`, -1, anticipo.totales.base, p.iva));
  return borrador(p, cliente, email, ajustes, lineas, `Presupuesto ${p.codigo}: ${p.concepto}.`);
}

type Resultado = { ok: true; factura: Factura } | { ok: false; error: string };

/** Crea el borrador de la factura (anticipo o final) y lo deja enlazado en el presupuesto. Una de cada, como mucho. */
export async function facturarPresupuesto(repos: Repositorios, id: string, tipo: 'anticipo' | 'final', email: string, ajustes: AjustesFacturacion): Promise<Resultado> {
  const p = await repos.presupuestosCliente.obtener(id);
  if (!p) return { ok: false, error: 'Ese presupuesto no existe.' };
  if (p.estado !== 'aceptado') return { ok: false, error: 'Solo se factura un presupuesto aceptado.' };
  const yaHecha = tipo === 'anticipo' ? p.facturaAnticipoId : p.facturaId;
  if (yaHecha) {
    const f = await repos.facturas.obtener(yaHecha);
    if (f) return { ok: true, factura: f };
  }
  if (tipo === 'anticipo' && p.totales.anticipo <= 0) return { ok: false, error: 'Este presupuesto no tiene anticipo.' };
  const cliente = (await repos.clientes.obtener(p.clienteId)) ?? p.cliente;
  const anticipo = tipo === 'final' && p.facturaAnticipoId ? await repos.facturas.obtener(p.facturaAnticipoId) : null;
  const factura = tipo === 'anticipo' ? facturaDeAnticipo(p, cliente, email, ajustes) : facturaFinal(p, cliente, email, ajustes, anticipo);
  await repos.facturas.guardarBorrador(factura);
  await repos.presupuestosCliente.guardar({ ...p, ...(tipo === 'anticipo' ? { facturaAnticipoId: factura.id } : { facturaId: factura.id }) }, email);
  return { ok: true, factura };
}

/** Lo que queda por facturar: primero el anticipo (si lo hay), después la final; null si ya está todo. */
export function porFacturar(p: Pick<PresupuestoCliente, 'totales' | 'facturaAnticipoId' | 'facturaId'>): 'anticipo' | 'final' | null {
  if (p.totales.anticipo > 0 && !p.facturaAnticipoId) return 'anticipo';
  return p.facturaId ? null : 'final';
}

/** Importe con IVA de esa factura: el anticipo, o lo que queda (el total si no hubo anticipo). */
export const importeAFacturar = (p: Pick<PresupuestoCliente, 'totales' | 'facturaAnticipoId'>, que: 'anticipo' | 'final') => (que === 'anticipo' ? p.totales.anticipo : p.facturaAnticipoId ? p.totales.restante : p.totales.total);

/**
 * Presupuestos que se pueden facturar ya: los aceptados con algo por facturar
 * y los enviados aún vigentes (al facturarlos, se dan por aceptados). Primero
 * los aceptados; dentro de cada grupo, los más recientes.
 */
export function facturables(ps: PresupuestoCliente[], hoy: string): { p: PresupuestoCliente; que: 'anticipo' | 'final'; importe: number; acepta: boolean }[] {
  return ps
    .filter((p) => p.estado === 'aceptado' || (p.estado === 'enviado' && !(p.validez && p.validez < hoy)))
    .flatMap((p) => {
      const que = porFacturar(p);
      return que ? [{ p, que, importe: importeAFacturar(p, que), acepta: p.estado === 'enviado' }] : [];
    })
    .sort((a, b) => Number(a.acepta) - Number(b.acepta) || b.p.fecha.localeCompare(a.p.fecha));
}

/** Factura lo que toque de un presupuesto; si estaba enviado, primero lo da por aceptado. */
export async function facturarLoQueToca(repos: Repositorios, id: string, email: string, ajustes: AjustesFacturacion, hoy: string): Promise<Resultado> {
  let p = await repos.presupuestosCliente.obtener(id);
  if (!p) return { ok: false, error: 'Ese presupuesto no existe.' };
  if (p.estado === 'enviado') {
    if (p.validez && p.validez < hoy) return { ok: false, error: 'Ese presupuesto ha caducado: cambia su fecha de validez antes de facturarlo.' };
    p = { ...p, estado: 'aceptado' };
    await repos.presupuestosCliente.guardar(p, email);
  }
  const que = porFacturar(p);
  if (!que) return p.facturaId ? facturarPresupuesto(repos, id, 'final', email, ajustes) : { ok: false, error: 'Ese presupuesto ya está facturado.' };
  return facturarPresupuesto(repos, id, que, email, ajustes);
}
