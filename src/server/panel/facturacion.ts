import type { DatosEmisor, Factura, Repositorios } from '../data/tipos.ts';
import {
  AJUSTES_VACIOS,
  CAMPOS_EMISOR,
  CLAVE_AJUSTES,
  codigoDe,
  huellaDe,
  serieDe,
  validarEmision,
  type AjustesFacturacion,
  type Error as ErrorFactura,
  type Planta,
} from '../facturas/facturas.ts';
import { calcularTotales } from '../facturas/importes.ts';
import { celdaCsv } from './presupuestos.ts';

/** Piezas del panel de facturas que leen de los repositorios. */
export async function ajustesFacturacion(repos: Repositorios): Promise<AjustesFacturacion> {
  return { ...AJUSTES_VACIOS, ...((await repos.ajustesPrivados.obtener<Partial<AjustesFacturacion>>(CLAVE_AJUSTES)) ?? {}) };
}

/** Plantas del catálogo (las que no están quitadas) para añadirlas a una factura. */
export async function plantasParaFacturar(repos: Repositorios): Promise<Planta[]> {
  const entradas = await repos.contenido.listar('catalogo');
  return entradas
    .map((e) => {
      const d = e.borrador.datos as { nombre?: { es?: string }; precioDesde?: number | null };
      return { slug: e.id, nombre: d.nombre?.es ?? e.id, precio: d.precioDesde ?? null };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

const numeroCsv = (n: number) => n.toFixed(2).replace('.', ',');

/** Libro de facturas emitidas para la gestoría (CSV con punto y coma, para Excel en español). */
export function libroFacturasCsv(facturas: Factura[]): string {
  const tipos = [21, 10, 4, 0];
  const cabecera = ['Fecha', 'Número', 'Tipo', 'Rectifica a', 'Cliente', 'NIF', ...tipos.flatMap((t) => [`Base ${t} %`, `IVA ${t} %`]), 'Recargo de equivalencia', 'Total', 'Estado', 'Cobrada el'];
  const filas = facturas
    .filter((f) => f.estado !== 'borrador')
    .sort((a, b) => (a.codigo ?? '').localeCompare(b.codigo ?? ''))
    .map((f) => {
      const por = (t: number) => f.totales.desglose.find((d) => d.iva === t);
      return [
        celdaCsv(f.fecha),
        celdaCsv(f.codigo),
        celdaCsv(f.tipo),
        celdaCsv(f.rectificaCodigo ?? ''),
        celdaCsv(f.cliente.nombre),
        celdaCsv(f.cliente.nif),
        ...tipos.flatMap((t) => [numeroCsv(por(t)?.base ?? 0), numeroCsv(por(t)?.cuota ?? 0)]),
        numeroCsv(f.totales.cuotaRecargo),
        numeroCsv(f.totales.total),
        celdaCsv(f.estado === 'cobrada' ? 'cobrada' : 'pendiente'),
        celdaCsv(f.cobradaEl ?? ''),
      ].join(';');
    });
  return `\uFEFF${[cabecera.map(celdaCsv).join(';'), ...filas].join('\r\n')}\r\n`;
}

/** Datos del emisor que salen en la factura, sacados de los ajustes. */
export const emisorDe = (a: AjustesFacturacion): DatosEmisor => Object.fromEntries(CAMPOS_EMISOR.map((c) => [c.campo, a[c.campo] ?? ''])) as unknown as DatosEmisor;

/** Borrador con la ficha actual del cliente y los totales recalculados. */
export async function borradorAlDia(repos: Repositorios, f: Factura): Promise<Factura> {
  if (f.estado !== 'borrador') return f;
  const actual = await repos.clientes.obtener(f.clienteId);
  return actual ? { ...f, cliente: actual, totales: calcularTotales(f.lineas.filter((l) => l.concepto), actual.recargo) } : f;
}

/** Lo que impide emitir (vacío = se puede). */
export async function comprobarEmision(repos: Repositorios, f: Factura, ajustes: AjustesFacturacion): Promise<ErrorFactura[]> {
  const ultima = await repos.facturas.ultimaEmitida(serieDe(f.tipo, f.fecha));
  return validarEmision(f, emisorDe(ajustes), f.cliente, ultima?.fecha ?? null);
}

/**
 * Emite un borrador: comprueba, le da el número siguiente de la serie, copia los
 * datos de ese día y encadena la huella. La usan la pantalla y el asistente.
 */
export async function emitirFactura(repos: Repositorios, borrador: Factura, email: string): Promise<{ ok: true; factura: Factura } | { ok: false; errores: ErrorFactura[] }> {
  const ajustes = await ajustesFacturacion(repos);
  const fa = await borradorAlDia(repos, borrador);
  const errores = await comprobarEmision(repos, fa, ajustes);
  if (errores.length) return { ok: false, errores };
  await repos.facturas.guardarBorrador(fa);
  const serie = serieDe(fa.tipo, fa.fecha);
  const anterior = await repos.facturas.ultimaHuella();
  const emitida = await repos.facturas.emitir(fa.id, {
    serie,
    fecha: fa.fecha,
    emisor: emisorDe(ajustes),
    cliente: fa.cliente,
    huellaAnterior: anterior,
    codigo: (n) => codigoDe(serie, n),
    huella: (_n, codigo) => huellaDe({ codigo, fecha: fa.fecha, total: fa.totales.total, nifEmisor: ajustes.nif, nifCliente: fa.cliente.nif }, anterior),
  });
  if (!emitida) return { ok: false, errores: [{ campo: 'estado', mensaje: 'Esa factura ya no es un borrador.' }] };
  await repos.auditoria.registrar(email, 'factura emitida', `${emitida.codigo} · ${emitida.totales.total}`);
  return { ok: true, factura: emitida };
}
