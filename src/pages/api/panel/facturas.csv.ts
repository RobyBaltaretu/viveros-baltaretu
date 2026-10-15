import type { APIRoute } from 'astro';
import { libroFacturasCsv } from '../../../server/panel/facturacion.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';

export const prerender = false;

/** Libro de facturas emitidas de un año (`?anio=2026`), para la gestoría. */
export const GET: APIRoute = async ({ locals, url }) => {
  const s = sesionCon(locals, 'facturas');
  if (!s) return new Response(null, { status: 403 });
  const anio = /^\d{4}$/.test(url.searchParams.get('anio') ?? '') ? url.searchParams.get('anio')! : String(new Date().getFullYear());
  const lista = await s.repos.facturas.listar({ desde: `${anio}-01-01`, hasta: `${anio}-12-31`, limite: 10000 });
  await s.repos.auditoria.registrar(s.usuario.email, 'exportar facturas', anio);
  return new Response(libroFacturasCsv(lista), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="facturas-${anio}.csv"` },
  });
};
