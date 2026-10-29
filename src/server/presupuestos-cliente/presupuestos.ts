import { z } from 'astro/zod';
import type { EstadoPresupuestoCliente, LineaPresupuestoCliente, PresupuestoCliente, Repositorios, TotalesPresupuesto } from '../data/tipos.ts';
import { calcularTotales } from '../facturas/importes.ts';

/**
 * Presupuestos que el negocio hace a sus clientes (módulo presupuestosCliente;
 * en la carpintería, uno por obra). Importes como en las facturas: euros en los
 * datos, cálculos en céntimos y cada línea redondeada a céntimos. El anticipo es
 * un porcentaje del total con IVA que se elige en cada presupuesto.
 */
const cent = (euros: number) => Math.round(euros * 100);
const euros = (centimos: number) => Math.round(centimos) / 100;

/** Total, anticipo y restante. Los extras opcionales se ofrecen aparte y no suman. */
export function calcularPresupuesto(lineas: LineaPresupuestoCliente[], iva: number, anticipoPct: number): TotalesPresupuesto {
  const comoFactura = (l: LineaPresupuestoCliente) => ({ concepto: l.concepto, cantidad: l.cantidad, precio: l.precio, descuento: 0, iva });
  const t = calcularTotales(lineas.filter((l) => !l.extra).map(comoFactura));
  const extras = calcularTotales(lineas.filter((l) => l.extra).map(comoFactura));
  const anticipo = euros(Math.round((cent(t.total) * anticipoPct) / 100));
  return { base: t.base, cuotaIva: t.cuotaIva, total: t.total, anticipo, restante: euros(cent(t.total) - cent(anticipo)), baseExtras: extras.base };
}

/** Serie del año: P2026, P2027… La numeración es correlativa dentro de cada serie. */
export const serieDe = (fecha: string) => `P${fecha.slice(0, 4)}`;

/** Un presupuesto enviado y sin respuesta caduca al pasar su fecha de validez. */
export const estadoEfectivo = (p: Pick<PresupuestoCliente, 'estado' | 'validez'>, hoy: string): EstadoPresupuestoCliente =>
  p.estado === 'enviado' && p.validez && p.validez < hoy ? 'caducado' : p.estado;

export const NOMBRE_ESTADO: Record<EstadoPresupuestoCliente, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
  caducado: 'Caducado',
};

/** Cambios de estado permitidos (desde el estado efectivo). */
const PASOS: Record<EstadoPresupuestoCliente, EstadoPresupuestoCliente[]> = {
  borrador: ['enviado'],
  enviado: ['aceptado', 'rechazado', 'borrador'],
  caducado: ['aceptado', 'rechazado', 'borrador'],
  aceptado: [],
  rechazado: ['borrador'],
};
export const pasosDesde = (e: EstadoPresupuestoCliente) => PASOS[e];

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escribe la fecha como 2026-10-31.');
const texto = (max: number) => z.string().trim().max(max, `Como mucho ${max} letras.`);
const linea = z.object({
  concepto: texto(200).min(1, 'Cada línea necesita un concepto.'),
  cantidad: z.coerce.number().positive('La cantidad tiene que ser mayor que 0.').max(1_000_000, 'Cantidad demasiado grande.'),
  precio: z.coerce.number().min(0, 'El precio no puede ser negativo.').max(10_000_000, 'Precio demasiado grande.'),
  material: texto(120).default(''),
  extra: z.boolean().default(false),
});
export const esquemaPresupuesto = z
  .object({
    clienteId: z.string().min(1, 'Elige el cliente.'),
    obraId: z.string().nullable().default(null),
    concepto: texto(200).min(1, 'Escribe qué se presupuesta (por ejemplo, «Armario empotrado del dormitorio»).'),
    fecha,
    validez: fecha.nullable().default(null),
    lineas: z.array(linea).max(100, 'Como mucho 100 líneas.'),
    iva: z.coerce.number().refine((n) => [21, 10, 4, 0].includes(n), 'Elige un tipo de IVA.'),
    anticipoPct: z.coerce.number().min(0, 'El anticipo va de 0 a 100 %.').max(100, 'El anticipo va de 0 a 100 %.'),
    formaPago: texto(80).default(''),
    notas: texto(1000).default(''),
  })
  .refine((p) => p.lineas.some((l) => !l.extra), { message: 'Añade al menos una línea que no sea un extra.', path: ['lineas'] })
  .refine((p) => !p.validez || p.validez >= p.fecha, { message: 'La validez no puede ser anterior a la fecha del presupuesto.', path: ['validez'] });
export type EntradaPresupuesto = z.input<typeof esquemaPresupuesto>;

type Resultado = { ok: true; presupuesto: PresupuestoCliente } | { ok: false; error: string };
const fallo = (error: string): Resultado => ({ ok: false, error });

/**
 * Valida y calcula. Con `ivaFijo` (configuración del cliente, por ejemplo el
 * 21 % de una carpintería) se usa ese IVA aunque llegue otro.
 */
function preparar(entrada: EntradaPresupuesto, ivaFijo: number | null) {
  const r = esquemaPresupuesto.safeParse(ivaFijo === null ? entrada : { ...entrada, iva: ivaFijo });
  if (!r.success) return { error: r.error.issues[0]?.message ?? 'Revisa los datos.' } as const;
  const d = r.data;
  // Redondea cantidades (3 decimales) y precios (céntimos) como en las facturas.
  const lineas = d.lineas.map((l) => ({ ...l, cantidad: Math.round(l.cantidad * 1000) / 1000, precio: Math.round(l.precio * 100) / 100 }));
  const anticipoPct = Math.round(d.anticipoPct * 100) / 100;
  return { datos: { ...d, lineas, anticipoPct, totales: calcularPresupuesto(lineas, d.iva, anticipoPct) } } as const;
}

/** Alta: nace en borrador, con el número siguiente de la serie del año. */
export async function crearPresupuesto(repos: Repositorios, entrada: EntradaPresupuesto, email: string, ivaFijo: number | null): Promise<Resultado> {
  const p = preparar(entrada, ivaFijo);
  if ('error' in p) return fallo(p.error!);
  const cliente = await repos.clientes.obtener(p.datos.clienteId);
  if (!cliente || cliente.archivado) return fallo('Ese cliente no existe.');
  const id = `pc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const presupuesto = await repos.presupuestosCliente.crear(
    { ...p.datos, id, serie: serieDe(p.datos.fecha), estado: 'borrador', cliente, cobroAnticipo: null, cobroResto: null, facturaAnticipoId: null, facturaId: null },
    email,
  );
  return { ok: true, presupuesto };
}

/** Cambiar los datos: solo en borrador (lo enviado al cliente no se toca; se vuelve a borrador primero). */
export async function cambiarPresupuesto(repos: Repositorios, id: string, entrada: EntradaPresupuesto, email: string, ivaFijo: number | null): Promise<Resultado> {
  const previo = await repos.presupuestosCliente.obtener(id);
  if (!previo) return fallo('Ese presupuesto no existe.');
  if (previo.estado !== 'borrador') return fallo('Solo se cambia un presupuesto en borrador. Vuelve a ponerlo en borrador primero.');
  const p = preparar(entrada, ivaFijo);
  if ('error' in p) return fallo(p.error!);
  const cliente = p.datos.clienteId === previo.clienteId ? ((await repos.clientes.obtener(previo.clienteId)) ?? previo.cliente) : await repos.clientes.obtener(p.datos.clienteId);
  if (!cliente) return fallo('Ese cliente no existe.');
  // La serie y el número no cambian aunque cambie la fecha.
  const presupuesto: PresupuestoCliente = { ...previo, ...p.datos, cliente };
  await repos.presupuestosCliente.guardar(presupuesto, email);
  return { ok: true, presupuesto };
}

export async function cambiarEstado(repos: Repositorios, id: string, nuevo: EstadoPresupuestoCliente, email: string, hoy: string): Promise<Resultado> {
  const p = await repos.presupuestosCliente.obtener(id);
  if (!p) return fallo('Ese presupuesto no existe.');
  if (!pasosDesde(estadoEfectivo(p, hoy)).includes(nuevo)) return fallo(`Un presupuesto ${NOMBRE_ESTADO[estadoEfectivo(p, hoy)].toLowerCase()} no puede pasar a ${NOMBRE_ESTADO[nuevo].toLowerCase()}.`);
  const presupuesto = { ...p, estado: nuevo };
  await repos.presupuestosCliente.guardar(presupuesto, email);
  return { ok: true, presupuesto };
}

/** Apunta cuándo se cobró el anticipo o el resto (solo de un presupuesto aceptado). */
export async function apuntarCobro(repos: Repositorios, id: string, parte: 'anticipo' | 'resto', dia: string | null, email: string): Promise<Resultado> {
  const p = await repos.presupuestosCliente.obtener(id);
  if (!p) return fallo('Ese presupuesto no existe.');
  if (p.estado !== 'aceptado') return fallo('Los cobros se apuntan en un presupuesto aceptado.');
  if (dia !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return fallo('Escribe la fecha como 2026-10-31.');
  const presupuesto = { ...p, ...(parte === 'anticipo' ? { cobroAnticipo: dia } : { cobroResto: dia }) };
  await repos.presupuestosCliente.guardar(presupuesto, email);
  return { ok: true, presupuesto };
}
