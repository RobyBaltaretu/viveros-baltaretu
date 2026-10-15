import type { APIRoute } from 'astro';
import { nombreCategoria } from '../../../server/gastos/gastos.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { celdaCsv } from '../../../server/panel/presupuestos.ts';

export const prerender = false;

const numero = (n: number | null) => (n === null ? '' : n.toFixed(2).replace('.', ','));

/** Gastos revisados de un año (`?anio=2026`), para la gestoría. */
export const GET: APIRoute = async ({ locals, url }) => {
  const s = sesionCon(locals, 'gastos');
  if (!s) return new Response(null, { status: 403 });
  const anio = /^\d{4}$/.test(url.searchParams.get('anio') ?? '') ? url.searchParams.get('anio')! : String(new Date().getFullYear());
  const lista = (await s.repos.gastos.listar({ estado: 'confirmado', desde: `${anio}-01-01`, hasta: `${anio}-12-31`, limite: 20000 })).reverse();
  const cabecera = ['Fecha', 'Proveedor', 'NIF', 'Tipo', 'Concepto', 'Base', 'IVA', 'Total', 'Forma de pago', 'Notas'].map(celdaCsv).join(';');
  const filas = lista.map((g) =>
    [
      celdaCsv(g.fecha),
      celdaCsv(g.proveedor),
      celdaCsv(g.nifProveedor),
      celdaCsv(nombreCategoria(g.categoria)),
      celdaCsv(g.lineas.map((l) => l.concepto).filter(Boolean).join(', ')),
      numero(g.base),
      numero(g.iva),
      numero(g.total),
      celdaCsv(g.formaPago),
      celdaCsv(g.notas),
    ].join(';'),
  );
  await s.repos.auditoria.registrar(s.usuario.email, 'exportar gastos', anio);
  return new Response(`\uFEFF${[cabecera, ...filas].join('\r\n')}\r\n`, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="gastos-${anio}.csv"` },
  });
};
