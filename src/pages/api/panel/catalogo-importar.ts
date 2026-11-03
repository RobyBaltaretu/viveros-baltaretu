import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { cuerpoLimitado } from '../../../server/panel/cuerpo.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { claveGemini } from '../../../server/simulador/cuota.ts';
import { analizarLotePDF, ErrorImportacion, importarCandidatos, MAX_PDF_BYTES } from '../../../server/catalogo/importacion-proveedor.ts';

export const prerender = false;
const json = (estado: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), {
  status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

/**
 * Gubia importador. Permisos comprobados también en API; el frontend jamás
 * crea artículos sin que un propietario o gerente confirme el lote.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  if (clienteActual().id !== 'turia') return json(404, { ok: false, error: 'No disponible.' });
  const sesion = sesionCon(locals, 'facturas');
  if (!sesion) return json(403, { ok: false, error: 'No tienes permiso para importar artículos.' });
  const tipo = request.headers.get('content-type') || '';
  const esMultipart = tipo.startsWith('multipart/form-data;');
  const max = esMultipart ? MAX_PDF_BYTES + 64_000 : 330_000;
  let cuerpo: Response | null;
  try { cuerpo = await cuerpoLimitado(request, max); }
  catch { return json(400, { ok: false, error: 'Solicitud ilegible.' }); }
  if (!cuerpo) return json(413, { ok: false, error: 'El archivo o la selección supera el tamaño máximo.' });

  try {
    if (esMultipart) {
      const form = await cuerpo.formData();
      if (form.get('accion') !== 'analizar') return json(400, {ok:false,error:'Acción no válida.'});
      const archivo = form.get('archivo');
      const proveedor = String(form.get('proveedor') || '').trim();
      const inicio = Number(form.get('inicio') || '1');
      if (!(archivo instanceof File) || archivo.type !== 'application/pdf' || archivo.size > MAX_PDF_BYTES)
        return json(400, { ok: false, error: 'Selecciona un PDF válido de hasta 8 MB.' });
      if (proveedor.length < 2 || proveedor.length > 80) return json(400, {ok:false,error:'Indica el proveedor (2–80 caracteres).'});
      // Control de consumo por usuario: 40 bloques PDF por día como máximo.
      const dia = new Date().toISOString().slice(0, 10);
      const contador = sesion.usuario.email + ':gubia-importacion-pdf';
      if (await sesion.repos.usoAsistente.obtener(contador, dia) >= 40)
        return json(429, {ok:false,error:'Se ha alcanzado el límite diario de análisis PDF.'});
      const key = claveGemini(env as Record<string, unknown>);
      if (!key) return json(503, { ok: false, error: 'Gubia necesita configurar GOOGLE_API_KEY en el Worker de Turia.' });
      await sesion.repos.usoAsistente.sumar(contador, dia);
      const datos = await analizarLotePDF(new Uint8Array(await archivo.arrayBuffer()), proveedor, inicio, { apiKey:key });
      return json(200, { ok:true, ...datos });
    }
    if (tipo.startsWith('application/json')) {
      const form = await cuerpo.json().catch(() => null) as Record<string, unknown> | null;
      if (!form || form.accion !== 'confirmar') return json(400, { ok:false,error:'Acción no válida.' });
      const proveedor = typeof form.proveedor === 'string' ? form.proveedor : '';
      const archivo = typeof form.archivo === 'string' ? form.archivo : '';
      const r = await importarCandidatos(sesion.repos, proveedor, archivo, form.articulos, sesion.usuario.email);
      return json(200, {ok:true,...r});
    }
    return json(415, { ok:false,error:'Formato de petición no admitido.' });
  } catch (e) {
    if (e instanceof ErrorImportacion) return json(e.estado, {ok:false,error:e.message});
    console.error('[Gubia Importador] Error en importación de catálogo', e instanceof Error ? e.name : 'desconocido');
    return json(500,{ok:false,error:'No ha sido posible completar esta operación. No repitas la confirmación sin revisar el catálogo.'});
  }
};
