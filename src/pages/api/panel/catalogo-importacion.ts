import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { mismoOrigen } from '../../../server/panel/acceso.ts';
import { cuerpoLimitado } from '../../../server/panel/cuerpo.ts';
import { claveGemini } from '../../../server/simulador/cuota.ts';
import { analizarLotePDF, ErrorImportacion, importarCandidatos, MAX_PDF_BYTES } from '../../../server/catalogo/importacion-proveedor.ts';

export const prerender = false;
const respuesta = (estado: number, datos: unknown) => new Response(JSON.stringify(datos), {
  status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
});

/** Paso 1: PDF -> candidatos (sin escribir). Paso 2: candidatos revisados -> artículos nuevos. */
export const POST: APIRoute = async ({ request, locals }) => {
  if (clienteActual().id !== 'turia') return respuesta(404, { ok: false, error: 'Función no disponible.' });
  const s = sesionCon(locals, 'facturas');
  if (!s) return respuesta(403, { ok: false, error: 'No tienes permiso para importar materiales.' });
  if (!mismoOrigen(request)) return respuesta(403, { ok: false, error: 'Origen de petición no permitido.' });
  try {
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data'))
      return respuesta(415, {ok:false,error:'Envía los datos como formulario.'});
    const limitado = await cuerpoLimitado(request, MAX_PDF_BYTES + 128_000);
    if (!limitado) return respuesta(413, {ok:false,error:'PDF demasiado grande (máximo 8 MB).'});
    const form = await limitado.formData();
    const accion = String(form.get('accion') || '');
    const proveedor = String(form.get('proveedor') || '').trim();
    if (proveedor.length < 2 || proveedor.length > 80) return respuesta(400, {ok:false,error:'Introduce el nombre del proveedor.'});
    if (accion === 'analizar') {
      const archivo = form.get('archivo');
      if (!(archivo instanceof File) || archivo.size < 10 || archivo.size > MAX_PDF_BYTES ||
          !archivo.name.toLowerCase().endsWith('.pdf')) return respuesta(400, {ok:false,error:'Selecciona un PDF válido de hasta 8 MB.'});
      const apiKey = claveGemini(env as Record<string, unknown>);
      if (!apiKey) return respuesta(503, {ok:false,error:'Gubia necesita configurar GOOGLE_API_KEY como secreto del Worker.'});
      const modelo = (env as Record<string, unknown>).GEMINI_CATALOGO_MODELO;
      const resultado = await analizarLotePDF(new Uint8Array(await archivo.arrayBuffer()), proveedor, Number(form.get('inicio') || '1'), {
        apiKey, modelo: typeof modelo === 'string' && /^[a-z0-9.-]{3,70}$/.test(modelo) ? modelo : undefined,
      });
      return respuesta(200, {ok:true,...resultado});
    }
    if (accion === 'importar') {
      const filename = String(form.get('filename') || '').slice(0, 90);
      const raw = String(form.get('articulos') || '');
      if (raw.length > 110_000) return respuesta(413, {ok:false,error:'La importación supera el tamaño permitido.'});
      let candidatos: unknown;
      try { candidatos = JSON.parse(raw); }
      catch { return respuesta(400, {ok:false,error:'La selección de artículos no es válida.'}); }
      const resultado = await importarCandidatos(s.repos, proveedor, filename, candidatos, s.usuario.email);
      return respuesta(200, {ok:true,...resultado});
    }
    return respuesta(400, {ok:false,error:'Operación no reconocida.'});
  } catch (e) {
    if (e instanceof ErrorImportacion) return respuesta(e.estado, {ok:false,error:e.message});
    console.error('[Gubia] Error procesando el catálogo de proveedor');
    return respuesta(500, {ok:false,error:'No se ha podido procesar el catálogo. Inténtalo de nuevo.'});
  }
};
