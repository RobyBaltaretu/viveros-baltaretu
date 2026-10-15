import type { APIRoute } from 'astro';
import { CLAVE_AJUSTES } from '../../../server/facturas/facturas.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';

export const prerender = false;

/**
 * Copia completa de la facturación (facturas, clientes y datos de la empresa) en
 * JSON, solo para el propietario. No va en la copia diaria de GitHub porque lleva
 * datos de clientes (decisión 25).
 */
export const GET: APIRoute = async ({ locals }) => {
  const s = sesionCon(locals, 'personas');
  if (!s) return new Response(null, { status: 403 });
  const copia = {
    version: 1,
    fecha: new Date().toISOString(),
    ajustes: await s.repos.ajustesPrivados.obtener(CLAVE_AJUSTES),
    clientes: await s.repos.clientes.listar({ incluirArchivados: true }),
    facturas: await s.repos.facturas.listar({ limite: 100000 }),
  };
  await s.repos.auditoria.registrar(s.usuario.email, 'copia de facturas', `${copia.facturas.length}`);
  const dia = copia.fecha.slice(0, 10);
  return new Response(JSON.stringify(copia, null, 1), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="facturacion-${dia}.json"` },
  });
};
