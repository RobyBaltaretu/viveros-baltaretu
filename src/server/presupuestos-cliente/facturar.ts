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
