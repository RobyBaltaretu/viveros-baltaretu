import type { Factura, Repositorios } from '../data/tipos.ts';
import { AJUSTES_VACIOS, CLAVE_AJUSTES, type AjustesFacturacion, type Planta } from '../facturas/facturas.ts';
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
