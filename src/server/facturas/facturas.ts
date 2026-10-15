import type { Cliente, DatosEmisor, Factura, LineaFactura, Presupuesto, TipoFactura } from '../data/tipos.ts';
import { calcularTotales, IVA_POR_DEFECTO, leerNumero, TIPOS_IVA } from './importes.ts';
import { nifValido, normalizarNif } from './nif.ts';

/**
 * Reglas de las facturas: datos obligatorios, numeración correlativa por serie
 * y año, rectificativas y huella encadenada. Es una ayuda para facturar; el
 * propietario debe confirmar con su asesor el cumplimiento de VeriFactu.
 */
export interface Error {
  campo: string;
  mensaje: string;
}

export interface AjustesFacturacion extends DatosEmisor {
  formaPago: string;
  diasVencimiento: number;
}

export const CLAVE_AJUSTES = 'facturacion';

export const AJUSTES_VACIOS: AjustesFacturacion = {
  nombre: '',
  nif: '',
  direccion: '',
  codigoPostal: '',
  poblacion: '',
  provincia: '',
  email: '',
  telefono: '',
  iban: '',
  pie: '',
  formaPago: 'Transferencia bancaria',
  diasVencimiento: 30,
};

export const FORMAS_PAGO = ['Transferencia bancaria', 'Contado', 'Tarjeta', 'Recibo domiciliado', 'Bizum'];

const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
export const sumarDias = (fecha: string, dias: number) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const fechaValida = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(`${f}T12:00:00Z`));

/* ---------- Emisor ---------- */

export const CAMPOS_EMISOR: { campo: keyof DatosEmisor; etiqueta: string; obligatorio: boolean }[] = [
  { campo: 'nombre', etiqueta: 'Razón social o nombre', obligatorio: true },
  { campo: 'nif', etiqueta: 'NIF', obligatorio: true },
  { campo: 'direccion', etiqueta: 'Dirección', obligatorio: true },
  { campo: 'codigoPostal', etiqueta: 'Código postal', obligatorio: true },
  { campo: 'poblacion', etiqueta: 'Población', obligatorio: true },
  { campo: 'provincia', etiqueta: 'Provincia', obligatorio: true },
  { campo: 'email', etiqueta: 'Correo', obligatorio: false },
  { campo: 'telefono', etiqueta: 'Teléfono', obligatorio: false },
  { campo: 'iban', etiqueta: 'Cuenta (IBAN) para transferencias', obligatorio: false },
  { campo: 'pie', etiqueta: 'Texto al pie (registro mercantil u otros)', obligatorio: false },
];

const PLACEHOLDER = /\[PLACEHOLDER\]/i;

/** Lo que falta del emisor para poder emitir (vacío = completo). */
export function faltaEmisor(e: DatosEmisor): Error[] {
  const errores: Error[] = CAMPOS_EMISOR.filter((c) => c.obligatorio && (!e[c.campo].trim() || PLACEHOLDER.test(e[c.campo]))).map((c) => ({
    campo: c.campo,
    mensaje: `Falta en los datos de facturación: ${c.etiqueta}.`,
  }));
  if (e.nif.trim() && !errores.some((x) => x.campo === 'nif') && !nifValido(e.nif)) errores.push({ campo: 'nif', mensaje: 'El NIF de la empresa no es correcto: revisa la letra o el número.' });
  return errores;
}

export function ibanValido(iban: string): boolean {
  const t = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(t)) return false;
  const reordenado = (t.slice(4) + t.slice(0, 4)).replace(/[A-Z]/g, (l) => String(l.charCodeAt(0) - 55));
  let resto = 0;
  for (const d of reordenado) resto = (resto * 10 + Number(d)) % 97;
  return resto === 1;
}

export function leerAjustes(form: FormData): { ajustes: AjustesFacturacion; errores: Error[] } {
  const v = (n: string) => String(form.get(n) ?? '').trim();
  const ajustes: AjustesFacturacion = { ...AJUSTES_VACIOS };
  for (const c of CAMPOS_EMISOR) ajustes[c.campo] = v(c.campo);
  ajustes.nif = normalizarNif(ajustes.nif);
  ajustes.iban = ajustes.iban.replace(/\s/g, '').toUpperCase();
  ajustes.formaPago = v('formaPago') || AJUSTES_VACIOS.formaPago;
  const dias = leerNumero(v('diasVencimiento'));
  const errores: Error[] = [];
  if (dias === null || Number.isNaN(dias) || dias < 0 || dias > 365 || !Number.isInteger(dias)) errores.push({ campo: 'diasVencimiento', mensaje: 'Días para pagar: escribe un número entre 0 y 365.' });
  else ajustes.diasVencimiento = dias;
  if (ajustes.nif && !nifValido(ajustes.nif)) errores.push({ campo: 'nif', mensaje: 'El NIF no es correcto: revisa la letra o el número.' });
  if (ajustes.iban && !ibanValido(ajustes.iban)) errores.push({ campo: 'iban', mensaje: 'La cuenta (IBAN) no es correcta: revisa los números.' });
  if (ajustes.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ajustes.email)) errores.push({ campo: 'email', mensaje: 'El correo no parece correcto.' });
  return { ajustes, errores };
}

/* ---------- Clientes ---------- */

export const clienteVacio = (id: string = crypto.randomUUID()): Cliente => ({
  id,
  nombre: '',
  nif: '',
  direccion: '',
  codigoPostal: '',
  poblacion: '',
  provincia: '',
  pais: 'España',
  email: '',
  telefono: '',
  recargo: false,
  notas: '',
  archivado: false,
});

export const esEspana = (pais: string) => /^(españa|espana|es|spain)$/i.test(pais.trim());

export function leerCliente(form: FormData, previo: Cliente): { cliente: Cliente; errores: Error[] } {
  const v = (n: string) => String(form.get(n) ?? '').trim();
  const cliente: Cliente = {
    ...previo,
    nombre: v('nombre'),
    nif: normalizarNif(v('nif')),
    direccion: v('direccion'),
    codigoPostal: v('codigoPostal'),
    poblacion: v('poblacion'),
    provincia: v('provincia'),
    pais: v('pais') || 'España',
    email: v('email'),
    telefono: v('telefono'),
    recargo: form.get('recargo') === '1',
    notas: v('notas'),
  };
  const errores: Error[] = [];
  if (!cliente.nombre) errores.push({ campo: 'nombre', mensaje: 'Falta el nombre o la razón social del cliente.' });
  if (cliente.nif && esEspana(cliente.pais) && !nifValido(cliente.nif)) errores.push({ campo: 'nif', mensaje: 'El NIF no es correcto: revisa la letra o el número.' });
  if (cliente.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cliente.email)) errores.push({ campo: 'email', mensaje: 'El correo no parece correcto.' });
  return { cliente, errores };
}

/** Lo que falta del cliente para facturarle (una factura completa lleva nombre, NIF y domicilio). */
export function faltaCliente(c: Cliente): Error[] {
  const falta: [keyof Cliente, string][] = [
    ['nombre', 'el nombre'],
    ['nif', 'el NIF'],
    ['direccion', 'la dirección'],
    ['codigoPostal', 'el código postal'],
    ['poblacion', 'la población'],
  ];
  return falta.filter(([k]) => !String(c[k]).trim()).map(([k, t]) => ({ campo: `cliente.${k}`, mensaje: `Falta ${t} del cliente. Complétalo en su ficha.` }));
}

/* ---------- Facturas ---------- */

export function nuevaFactura(cliente: Cliente, email: string, ajustes: AjustesFacturacion, tipo: TipoFactura = 'ordinaria'): Factura {
  const fecha = hoy();
  const ahora = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    tipo,
    estado: 'borrador',
    serie: null,
    numero: null,
    codigo: null,
    fecha,
    vencimiento: sumarDias(fecha, ajustes.diasVencimiento),
    clienteId: cliente.id,
    cliente,
    emisor: null,
    lineas: [],
    totales: calcularTotales([], cliente.recargo),
    formaPago: ajustes.formaPago,
    notas: '',
    exencion: '',
    rectificaId: null,
    rectificaCodigo: null,
    motivoRectificacion: '',
    presupuestoId: null,
    cobradaEl: null,
    huella: null,
    huellaAnterior: null,
    creada: ahora,
    creadaPor: email,
    actualizada: ahora,
  };
}

export const lineaVacia = (): LineaFactura => ({ concepto: '', cantidad: 1, precio: 0, descuento: 0, iva: IVA_POR_DEFECTO });

export interface Planta {
  slug: string;
  nombre: string;
  precio: number | null;
}

/** Borrador a partir de un presupuesto de la web: mismas plantas y cantidades, con el precio «desde» de la ficha. */
export function lineasDePresupuesto(p: Presupuesto, plantas: Planta[]): LineaFactura[] {
  return p.lineas.map((l) => {
    const planta = plantas.find((x) => x.slug === l.especie);
    return { ...lineaVacia(), concepto: planta?.nombre ?? l.nombre, cantidad: l.cantidad, precio: planta?.precio ?? 0 };
  });
}

/** Cliente nuevo con los datos que dejó en el presupuesto (falta el NIF y la dirección). */
export function clienteDePresupuesto(p: Presupuesto): Cliente {
  return { ...clienteVacio(), nombre: p.empresa || p.nombre, email: p.email, telefono: p.telefono, provincia: p.provincia, notas: p.empresa ? `Contacto: ${p.nombre}` : '' };
}

/** Rectificativa de una emitida: mismas líneas en negativo, para corregir o anular. */
export function rectificativaDe(f: Factura, email: string, ajustes: AjustesFacturacion): Factura {
  return {
    ...nuevaFactura(f.cliente, email, ajustes, 'rectificativa'),
    clienteId: f.clienteId,
    lineas: f.lineas.map((l) => ({ ...l, cantidad: -l.cantidad })),
    totales: calcularTotales(
      f.lineas.map((l) => ({ ...l, cantidad: -l.cantidad })),
      f.cliente.recargo,
    ),
    formaPago: f.formaPago,
    exencion: f.exencion,
    rectificaId: f.id,
    rectificaCodigo: f.codigo,
  };
}

export type AccionBorrador = { tipo: 'guardar' } | { tipo: 'emitir' } | { tipo: 'agregar' } | { tipo: 'quitar'; indice: number } | { tipo: 'planta'; slug: string };

/** Lee el formulario del borrador. Las líneas vienen como `l0.concepto`, `l0.cantidad`… */
export function leerBorrador(form: FormData, previa: Factura, plantas: Planta[]): { factura: Factura; errores: Error[]; accion: AccionBorrador } {
  const v = (n: string) => String(form.get(n) ?? '').trim();
  const errores: Error[] = [];
  const lineas: LineaFactura[] = [];
  const n = Math.min(Number(v('lineas')) || 0, 200);
  for (let i = 0; i < n; i++) {
    const concepto = v(`l${i}.concepto`);
    const textos = [v(`l${i}.cantidad`), v(`l${i}.precio`), v(`l${i}.descuento`)];
    if (!concepto && textos.every((t) => !t || t === '0' || t === '1')) {
      lineas.push({ ...lineaVacia(), cantidad: leerNumero(textos[0]) ?? 1 });
      continue;
    }
    const [cantidad, precio, descuento] = textos.map(leerNumero);
    const iva = Number(v(`l${i}.iva`));
    const linea = i + 1;
    if (cantidad === null || Number.isNaN(cantidad) || cantidad === 0) errores.push({ campo: `l${i}.cantidad`, mensaje: `Línea ${linea}: la cantidad debe ser un número distinto de 0.` });
    if (precio === null || Number.isNaN(precio) || precio < 0) errores.push({ campo: `l${i}.precio`, mensaje: `Línea ${linea}: el precio debe ser un número (0 o más).` });
    if (descuento !== null && (Number.isNaN(descuento) || descuento < 0 || descuento > 100)) errores.push({ campo: `l${i}.descuento`, mensaje: `Línea ${linea}: el descuento va de 0 a 100.` });
    if (!(TIPOS_IVA as readonly number[]).includes(iva)) errores.push({ campo: `l${i}.iva`, mensaje: `Línea ${linea}: elige el IVA.` });
    lineas.push({
      concepto,
      cantidad: cantidad !== null && Number.isFinite(cantidad) ? cantidad : 1,
      precio: precio !== null && Number.isFinite(precio) ? precio : 0,
      descuento: descuento !== null && Number.isFinite(descuento) ? descuento : 0,
      iva: (TIPOS_IVA as readonly number[]).includes(iva) ? iva : IVA_POR_DEFECTO,
    });
  }
  const fecha = v('fecha') || previa.fecha;
  const vencimiento = v('vencimiento') || previa.vencimiento;
  if (!fechaValida(fecha)) errores.push({ campo: 'fecha', mensaje: 'La fecha de la factura no es correcta.' });
  if (!fechaValida(vencimiento)) errores.push({ campo: 'vencimiento', mensaje: 'La fecha de pago no es correcta.' });
  else if (fechaValida(fecha) && vencimiento < fecha) errores.push({ campo: 'vencimiento', mensaje: 'La fecha de pago no puede ser anterior a la de la factura.' });

  const boton = v('accion');
  let accion: AccionBorrador = { tipo: 'guardar' };
  if (boton === 'emitir') accion = { tipo: 'emitir' };
  else if (boton === 'agregar') accion = { tipo: 'agregar' };
  else if (boton.startsWith('quitar:')) accion = { tipo: 'quitar', indice: Number(boton.slice(7)) };
  else if (boton === 'planta') accion = { tipo: 'planta', slug: v('planta') };

  if (accion.tipo === 'agregar') lineas.push(lineaVacia());
  if (accion.tipo === 'quitar' && lineas[accion.indice]) {
    lineas.splice(accion.indice, 1);
    // Los errores de la línea quitada ya no cuentan.
    errores.splice(0, errores.length, ...errores.filter((e) => !e.campo.startsWith(`l${accion.indice}.`)));
  }
  if (accion.tipo === 'planta') {
    const p = plantas.find((x) => x.slug === accion.slug);
    if (p) {
      const vacia = lineas.findIndex((l) => !l.concepto && l.precio === 0);
      const nueva = { ...lineaVacia(), concepto: p.nombre, precio: p.precio ?? 0 };
      if (vacia >= 0) lineas[vacia] = nueva;
      else lineas.push(nueva);
    } else errores.push({ campo: 'planta', mensaje: 'Elige una planta de la lista.' });
  }

  const factura: Factura = {
    ...previa,
    fecha: fechaValida(fecha) ? fecha : previa.fecha,
    vencimiento: fechaValida(vencimiento) ? vencimiento : previa.vencimiento,
    lineas,
    formaPago: v('formaPago') || previa.formaPago,
    notas: v('notas').slice(0, 1000),
    exencion: v('exencion').slice(0, 300),
    motivoRectificacion: previa.tipo === 'rectificativa' ? v('motivoRectificacion').slice(0, 300) : '',
  };
  factura.totales = calcularTotales(factura.lineas.filter((l) => l.concepto), factura.cliente.recargo);
  return { factura, errores, accion };
}

/** Comprobaciones para emitir: datos completos, líneas correctas y fecha en orden con la última de la serie. */
export function validarEmision(f: Factura, emisor: DatosEmisor, cliente: Cliente, fechaUltima: string | null): Error[] {
  const errores: Error[] = [...faltaEmisor(emisor), ...faltaCliente(cliente)];
  const lineas = f.lineas.filter((l) => l.concepto);
  if (lineas.length === 0) errores.push({ campo: 'lineas', mensaje: 'Añade al menos una línea con su concepto.' });
  if (f.lineas.some((l) => !l.concepto && (l.precio !== 0 || l.cantidad !== 1))) errores.push({ campo: 'lineas', mensaje: 'Hay una línea sin concepto: escríbelo o quítala.' });
  if (lineas.some((l) => l.iva === 0) && !f.exencion) errores.push({ campo: 'exencion', mensaje: 'Hay líneas sin IVA: escribe el motivo (por ejemplo, «Entrega intracomunitaria exenta, art. 25 Ley del IVA»).' });
  if (f.tipo === 'ordinaria' && f.totales.total <= 0) errores.push({ campo: 'lineas', mensaje: 'El total de la factura debe ser mayor que 0.' });
  if (f.tipo === 'rectificativa' && !f.motivoRectificacion) errores.push({ campo: 'motivoRectificacion', mensaje: 'Escribe por qué se rectifica la factura.' });
  if (fechaUltima && f.fecha < fechaUltima) errores.push({ campo: 'fecha', mensaje: `La fecha no puede ser anterior a la de la última factura de la serie (${fechaUltima.split('-').reverse().join('/')}).` });
  if (f.fecha > sumarDias(hoy(), 0)) errores.push({ campo: 'fecha', mensaje: 'La fecha de la factura no puede ser posterior a hoy.' });
  return errores;
}

/** Serie por tipo y año: F2026 (ordinarias) y R2026 (rectificativas). La numeración empieza en 1 cada año. */
export const serieDe = (tipo: TipoFactura, fecha: string) => `${tipo === 'rectificativa' ? 'R' : 'F'}${fecha.slice(0, 4)}`;
export const codigoDe = (serie: string, numero: number) => `${serie}-${String(numero).padStart(4, '0')}`;

/** Huella SHA-256 encadenada: si se altera una factura emitida, deja de cuadrar con las siguientes. */
export async function huellaDe(f: { codigo: string; fecha: string; total: number; nifEmisor: string; nifCliente: string }, anterior: string | null): Promise<string> {
  const texto = [f.nifEmisor, f.codigo, f.fecha, f.total.toFixed(2), f.nifCliente, anterior ?? ''].join('|');
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const NOMBRE_ESTADO: Record<Factura['estado'], string> = { borrador: 'Borrador', emitida: 'Pendiente de cobro', cobrada: 'Cobrada' };

/** Una emitida sin cobrar con la fecha de pago pasada. */
export const vencida = (f: Factura, dia = hoy()) => f.estado === 'emitida' && f.vencimiento < dia;
export { hoy };
