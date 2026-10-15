import type { Gasto, LineaGasto } from '../data/tipos.ts';
import { leerNumero } from '../facturas/importes.ts';

/** Reglas de los gastos: categorías, lectura del formulario y validación. */
export interface Error {
  campo: string;
  mensaje: string;
}

export const CATEGORIAS: { id: string; nombre: string; palabras: string[] }[] = [
  { id: 'planta', nombre: 'Planta y semillas', palabras: ['planta', 'semilla', 'esqueje', 'plantel', 'bulbo', 'arbol', 'palmera', 'olivo'] },
  { id: 'sustratos', nombre: 'Sustratos y abonos', palabras: ['sustrato', 'turba', 'abono', 'fertiliz', 'tierra', 'compost', 'humus', 'perlita'] },
  { id: 'macetas', nombre: 'Macetas y envases', palabras: ['maceta', 'contenedor', 'bandeja', 'alveolo', 'tiesto', 'envase'] },
  { id: 'fitosanitarios', nombre: 'Fitosanitarios', palabras: ['insecticida', 'fungicida', 'herbicida', 'fitosanitario', 'plaga', 'cobre', 'azufre'] },
  { id: 'riego', nombre: 'Riego', palabras: ['riego', 'gotero', 'manguera', 'aspersor', 'tuberia', 'goteo'] },
  { id: 'combustible', nombre: 'Combustible', palabras: ['gasolina', 'gasoil', 'diesel', 'gasoleo', 'carburante', 'repsol', 'cepsa', 'galp', 'bp ', 'shell', 'adblue'] },
  { id: 'transporte', nombre: 'Transporte y envíos', palabras: ['transporte', 'envio', 'mensajeria', 'porte', 'peaje', 'autopista', 'seur', 'mrw', 'correos'] },
  { id: 'herramientas', nombre: 'Herramientas y maquinaria', palabras: ['herramienta', 'tijera', 'pala', 'azada', 'motosierra', 'desbrozadora', 'maquina', 'carretilla'] },
  { id: 'mantenimiento', nombre: 'Reparaciones y mantenimiento', palabras: ['reparacion', 'taller', 'recambio', 'mantenimiento', 'ferreteria', 'tornill'] },
  { id: 'suministros', nombre: 'Luz, agua y teléfono', palabras: ['electricidad', 'iberdrola', 'endesa', 'naturgy', 'agua', 'telefono', 'movistar', 'vodafone', 'orange', 'fibra'] },
  { id: 'oficina', nombre: 'Oficina y papelería', palabras: ['papel', 'papeleria', 'tinta', 'impresora', 'oficina', 'sobre'] },
  { id: 'comidas', nombre: 'Comidas y dietas', palabras: ['restaurante', 'menu', 'cafe', 'bar ', 'comida', 'bocadillo'] },
  { id: 'otros', nombre: 'Otros', palabras: [] },
];

export const nombreCategoria = (id: string) => CATEGORIAS.find((c) => c.id === id)?.nombre ?? 'Sin categoría';

const normal = (t: string) =>
  ` ${t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()} `;

/** Categoría probable por las palabras del proveedor y las líneas. */
export function sugerirCategoria(proveedor: string, lineas: LineaGasto[]): string {
  const texto = normal([proveedor, ...lineas.map((l) => l.concepto)].join(' '));
  let mejor = { id: 'otros', puntos: 0 };
  for (const c of CATEGORIAS) {
    const puntos = c.palabras.filter((p) => texto.includes(p)).length;
    if (puntos > mejor.puntos) mejor = { id: c.id, puntos };
  }
  return mejor.id;
}

export const FORMAS_PAGO_GASTO = ['Tarjeta', 'Efectivo', 'Transferencia', 'Recibo domiciliado', 'Bizum'];

export const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
const fechaValida = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(`${f}T12:00:00Z`));

export function gastoVacio(email: string, id: string = crypto.randomUUID()): Gasto {
  const t = new Date().toISOString();
  return {
    id,
    estado: 'revisar',
    fecha: hoy(),
    proveedor: '',
    nifProveedor: '',
    categoria: '',
    lineas: [],
    base: null,
    iva: null,
    total: 0,
    formaPago: 'Tarjeta',
    notas: '',
    ticketId: null,
    leidoAutomaticamente: false,
    avisos: [],
    creado: t,
    creadoPor: email,
    actualizado: t,
  };
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export type AccionGasto = { tipo: 'guardar' } | { tipo: 'agregar' } | { tipo: 'quitar'; indice: number };

/** Lee el formulario de revisión. Las líneas llegan como `l0.concepto`, `l0.cantidad`, `l0.importe`. */
export function leerGasto(form: FormData, previo: Gasto): { gasto: Gasto; errores: Error[]; accion: AccionGasto } {
  const v = (n: string) => String(form.get(n) ?? '').trim();
  const errores: Error[] = [];
  const lineas: LineaGasto[] = [];
  const n = Math.min(Number(v('lineas')) || 0, 100);
  for (let i = 0; i < n; i++) {
    const concepto = v(`l${i}.concepto`);
    const cantidad = leerNumero(v(`l${i}.cantidad`));
    const importe = leerNumero(v(`l${i}.importe`));
    if (!concepto && importe === null) continue;
    if (importe === null || Number.isNaN(importe)) errores.push({ campo: `l${i}.importe`, mensaje: `Línea ${i + 1}: escribe el importe (por ejemplo 12,50).` });
    if (cantidad !== null && (Number.isNaN(cantidad) || cantidad <= 0)) errores.push({ campo: `l${i}.cantidad`, mensaje: `Línea ${i + 1}: la cantidad debe ser un número mayor que 0.` });
    lineas.push({ concepto, cantidad: cantidad && cantidad > 0 ? cantidad : 1, importe: importe !== null && Number.isFinite(importe) ? importe : 0 });
  }
  const boton = v('accion');
  const accion: AccionGasto = boton === 'agregar' ? { tipo: 'agregar' } : boton.startsWith('quitar:') ? { tipo: 'quitar', indice: Number(boton.slice(7)) } : { tipo: 'guardar' };
  if (accion.tipo === 'agregar') lineas.push({ concepto: '', cantidad: 1, importe: 0 });
  if (accion.tipo === 'quitar') lineas.splice(accion.indice, 1);

  const total = leerNumero(v('total'));
  const base = leerNumero(v('base'));
  const iva = leerNumero(v('iva'));
  const fecha = v('fecha');
  const gasto: Gasto = {
    ...previo,
    fecha: fechaValida(fecha) ? fecha : previo.fecha,
    proveedor: v('proveedor').slice(0, 200),
    nifProveedor: v('nifProveedor').toUpperCase().slice(0, 20),
    categoria: CATEGORIAS.some((c) => c.id === v('categoria')) ? v('categoria') : '',
    lineas,
    total: total !== null && Number.isFinite(total) ? redondear(total) : 0,
    base: base !== null && Number.isFinite(base) ? redondear(base) : null,
    iva: iva !== null && Number.isFinite(iva) ? redondear(iva) : null,
    formaPago: v('formaPago') || previo.formaPago,
    notas: v('notas').slice(0, 1000),
  };
  if (accion.tipo !== 'guardar') return { gasto, errores: [], accion };

  if (!fechaValida(fecha)) errores.push({ campo: 'fecha', mensaje: 'La fecha no es correcta.' });
  else if (fecha > hoy()) errores.push({ campo: 'fecha', mensaje: 'La fecha no puede ser posterior a hoy.' });
  if (!gasto.proveedor) errores.push({ campo: 'proveedor', mensaje: 'Escribe dónde se compró (la tienda o el proveedor).' });
  if (!gasto.categoria) errores.push({ campo: 'categoria', mensaje: 'Elige de qué tipo es el gasto.' });
  if (total === null || Number.isNaN(total) || total <= 0) errores.push({ campo: 'total', mensaje: 'Escribe el total pagado (por ejemplo 45,90).' });
  if (base !== null && Number.isNaN(base)) errores.push({ campo: 'base', mensaje: 'La base no es un número.' });
  if (iva !== null && Number.isNaN(iva)) errores.push({ campo: 'iva', mensaje: 'El IVA no es un número.' });
  return { gasto, errores, accion };
}

/** Avisos para revisar con calma (no impiden guardar). */
export function avisosDe(g: Pick<Gasto, 'lineas' | 'total' | 'base' | 'iva' | 'fecha'>): string[] {
  const avisos: string[] = [];
  const suma = redondear(g.lineas.reduce((t, l) => t + l.importe, 0));
  if (g.lineas.length && g.total && Math.abs(suma - g.total) > 0.05) avisos.push(`Las líneas suman ${suma.toFixed(2).replace('.', ',')} € y el total es ${g.total.toFixed(2).replace('.', ',')} €: revisa los importes.`);
  if (g.base !== null && g.iva !== null && g.total && Math.abs(g.base + g.iva - g.total) > 0.05) avisos.push('La base más el IVA no da el total: revisa los números.');
  return avisos;
}
