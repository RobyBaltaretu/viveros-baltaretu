import type { APIRoute } from 'astro';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { csvProveedores } from '../../../server/proveedores/proveedores.ts';

export const prerender = false;

/** Todos los proveedores (también los ocultos), para tenerlos en una hoja de cálculo. */
export const GET: APIRoute = async ({ locals }) => {
  const s = sesionCon(locals, 'facturas');
  if (!s) return new Response(null, { status: 403 });
  const lista = await s.repos.proveedores.listar({ incluirArchivados: true });
  await s.repos.auditoria.registrar(s.usuario.email, 'exportar proveedores', String(lista.length));
  return new Response(`\uFEFF${csvProveedores(lista)}\r\n`, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="proveedores.csv"', 'Cache-Control': 'private, no-store' },
  });
};
