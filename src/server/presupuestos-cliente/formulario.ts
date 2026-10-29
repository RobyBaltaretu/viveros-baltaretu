import type { LineaPresupuestoCliente, PresupuestoCliente } from '../data/tipos.ts';
import { dinero } from '../facturas/importes.ts';
import type { EntradaPresupuesto } from './presupuestos.ts';

/** Lo que se enseña en el formulario (un presupuesto guardado o lo que se acaba de escribir). */
export interface ValoresFormPresupuesto {
  clienteId?: string;
  concepto?: string;
  fecha?: string;
  validez?: string | null;
  lineas?: LineaPresupuestoCliente[];
  iva?: number;
  anticipoPct?: number;
  formaPago?: string;
  notas?: string;
}

/**
 * Número escrito a la española: «1.250,50», «1.250» (mil doscientos cincuenta)
 * o «12,5»; también «12.5». Vacío → null.
 */
export const numero = (t: string) => {
  const limpio = t.trim().replace(/\s|€|%/g, '');
  if (!limpio) return null;
  if (limpio.includes(',')) return Number(limpio.replace(/\./g, '').replace(',', '.'));
  return Number(/^-?\d{1,3}(\.\d{3})+$/.test(limpio) ? limpio.replace(/\./g, '') : limpio);
};

/** Datos del formulario tal como llegan del navegador. Las filas de líneas vacías no cuentan. */
export function leerFormularioPresupuesto(form: FormData, ivaFijo: number | null): EntradaPresupuesto & ValoresFormPresupuesto & { filas: number; lineas: LineaPresupuestoCliente[] } {
  const v = (n: string) => String(form.get(n) ?? '').trim();
  const filas = Math.min(Number(v('filas')) || 0, 100);
  const lineas = [];
  for (let i = 0; i < filas; i++) {
    const concepto = v(`l${i}.concepto`);
    const cantidad = v(`l${i}.cantidad`);
    const precio = v(`l${i}.precio`);
    if (!concepto && !precio) continue;
    lineas.push({ concepto, cantidad: numero(cantidad) ?? 1, precio: numero(precio) ?? Number.NaN, material: v(`l${i}.material`), extra: form.get(`l${i}.extra`) !== null });
  }
  return {
    clienteId: v('clienteId'),
    obraId: null,
    concepto: v('concepto'),
    fecha: v('fecha'),
    validez: v('validez') || null,
    lineas,
    iva: ivaFijo ?? numero(v('iva')) ?? Number.NaN,
    anticipoPct: numero(v('anticipoPct')) ?? 0,
    formaPago: v('formaPago'),
    notas: v('notas'),
    filas,
  };
}

/** Texto para enviar el presupuesto por correo o por WhatsApp (el PDF se adjunta aparte). */
export function mensajeDe(p: PresupuestoCliente, empresa: string): string {
  const anticipo = p.anticipoPct > 0 ? ` Para empezar, un anticipo del ${String(p.anticipoPct).replace('.', ',')} % (${dinero(p.totales.anticipo)}).` : '';
  return `Hola${p.cliente.nombre ? `, ${p.cliente.nombre}` : ''}. Te envío el presupuesto ${p.codigo} de «${p.concepto}»: ${dinero(p.totales.total)} con IVA.${anticipo}${p.validez ? ` Vale hasta el ${p.validez.split('-').reverse().join('/')}.` : ''} Te lo adjunto en PDF. Un saludo${empresa ? `, ${empresa}` : ''}.`;
}

export const enlaceCorreo = (p: PresupuestoCliente, empresa: string) =>
  `mailto:${encodeURIComponent(p.cliente.email)}?subject=${encodeURIComponent(`Presupuesto ${p.codigo}: ${p.concepto}`)}&body=${encodeURIComponent(mensajeDe(p, empresa))}`;

/** WhatsApp: el teléfono del cliente con prefijo (9 cifras sin prefijo = España, 34). Sin teléfono, se elige el contacto en WhatsApp. */
export function enlaceWhatsapp(p: PresupuestoCliente, empresa: string): string {
  let tel = p.cliente.telefono.replace(/\D/g, '');
  if (tel.length === 9) tel = `34${tel}`;
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensajeDe(p, empresa))}`;
}
