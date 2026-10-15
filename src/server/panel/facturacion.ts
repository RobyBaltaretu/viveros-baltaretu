import type { DatosEmisor, Factura, Repositorios } from '../data/tipos.ts';
import {
  AJUSTES_VACIOS,
  CAMPOS_EMISOR,
  CLAVE_AJUSTES,
  codigoDe,
  faltaEmisor,
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
    .filter((f) => f.estado !== 'borrador' && !f.prueba && !f.serie?.startsWith('PRUEBA-'))
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

/** Clave del modo de pruebas en los ajustes privados. */
export const CLAVE_MODO_PRUEBAS = 'modo-pruebas';
export const modoPruebas = async (repos: Repositorios) => Boolean((await repos.ajustesPrivados.obtener<{ activo: boolean }>(CLAVE_MODO_PRUEBAS))?.activo);

/** Emisor ficticio de las facturas de prueba cuando aún no hay datos reales. */
export const EMISOR_PRUEBA: DatosEmisor = {
  nombre: 'EMPRESA DE PRUEBA (sin validez)',
  nif: 'B00000000',
  direccion: 'Calle de Prueba 1',
  codigoPostal: '46000',
  poblacion: 'Valencia',
  provincia: 'Valencia',
  email: 'pruebas@example.com',
  telefono: '',
  iban: '',
  pie: 'Factura de prueba generada en el modo de pruebas del panel. Sin validez fiscal.',
};

/**
 * Serie y emisor con los que se emitiría: en modo de pruebas (o si la factura es
 * de prueba) la serie es PRUEBA-… y, si faltan los datos reales, el emisor ficticio.
 */
async function destinoEmision(repos: Repositorios, f: Factura, ajustes: AjustesFacturacion) {
  const prueba = f.prueba || (await modoPruebas(repos));
  const real = emisorDe(ajustes);
  const emisor = prueba && faltaEmisor(real).length ? EMISOR_PRUEBA : real;
  return { prueba, serie: `${prueba ? 'PRUEBA-' : ''}${serieDe(f.tipo, f.fecha)}`, emisor };
}

/** Lo que impide emitir (vacío = se puede). */
export async function comprobarEmision(repos: Repositorios, f: Factura, ajustes: AjustesFacturacion): Promise<ErrorFactura[]> {
  const { serie, emisor } = await destinoEmision(repos, f, ajustes);
  const ultima = await repos.facturas.ultimaEmitida(serie);
  return validarEmision(f, emisor, f.cliente, ultima?.fecha ?? null);
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
  const { prueba, serie, emisor } = await destinoEmision(repos, fa, ajustes);
  await repos.facturas.guardarBorrador({ ...fa, prueba });
  // Las de prueba no entran en la cadena de huellas de las reales.
  const anterior = prueba ? null : await repos.facturas.ultimaHuella();
  const emitida = await repos.facturas.emitir(fa.id, {
    serie,
    fecha: fa.fecha,
    emisor,
    cliente: fa.cliente,
    huellaAnterior: anterior,
    codigo: (n) => codigoDe(serie, n),
    huella: (_n, codigo) => huellaDe({ codigo, fecha: fa.fecha, total: fa.totales.total, nifEmisor: emisor.nif, nifCliente: fa.cliente.nif }, anterior),
  });
  if (!emitida) return { ok: false, errores: [{ campo: 'estado', mensaje: 'Esa factura ya no es un borrador.' }] };
  await repos.auditoria.registrar(email, 'factura emitida', `${emitida.codigo} · ${emitida.totales.total}`);
  return { ok: true, factura: emitida };
}
