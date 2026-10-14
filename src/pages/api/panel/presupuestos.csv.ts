import type { APIRoute } from 'astro';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { presupuestosCsv } from '../../../server/panel/presupuestos.ts';

export const prerender = false;

/** Todos los presupuestos en CSV (separado por punto y coma, para Excel en español). */
export const GET: APIRoute = async ({ locals }) => {
  const s = sesionCon(locals, 'presupuestos');
  if (!s) return new Response(null, { status: 403 });
  const lista = await s.repos.presupuestos.listar({ limite: 5000 });
  await s.repos.auditoria.registrar(s.usuario.email, 'exportar presupuestos', `${lista.length}`);
  const dia = new Date().toISOString().slice(0, 10);
  return new Response(presupuestosCsv(lista), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="presupuestos-${dia}.csv"` },
  });
};
