import type { APIRoute } from 'astro';
import { pdfFactura } from '../../../server/facturas/pdf.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';

export const prerender = false;

/** PDF de una factura. `?descargar=1` lo baja como archivo; si no, se abre en el navegador. */
export const GET: APIRoute = async ({ locals, url }) => {
  const s = sesionCon(locals, 'facturas');
  if (!s) return new Response(null, { status: 403 });
  const f = await s.repos.facturas.obtener(url.searchParams.get('id') ?? '');
  if (!f) return new Response(null, { status: 404 });
  const factura = f.estado === 'borrador' ? { ...f, cliente: (await s.repos.clientes.obtener(f.clienteId)) ?? f.cliente } : f;
  const nombre = `${f.codigo ?? 'borrador'}.pdf`;
  const bytes = await pdfFactura(factura);
  return new Response(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), {
    headers: { 'Content-Disposition': `${url.searchParams.has('descargar') ? 'attachment' : 'inline'}; filename="${nombre}"` },
  });
};
