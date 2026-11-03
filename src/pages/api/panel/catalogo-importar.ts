import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { cuerpoLimitado } from '../../../server/panel/cuerpo.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { importarCandidatos, ErrorImportacion } from '../../../server/catalogo/importacion-proveedor.ts';
import { interpretarTextoConGroq, interpretarMuestraConGroq } from '../../../server/catalogo/interpretacion-groq.ts';

export const prerender = false;
const json = (estado: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo),{
  status:estado,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},
});

// Los límites por usuario protegen la cuota Free compartida con el chat Gubia.
// No hay ninguna ruta hacia Gemini, ni respaldo de pago.
export const MAX_LOTES_DIA = 30;
export const MAX_VISION_DIA = 8;
const dia = () => new Date().toISOString().slice(0,10);
const dato = (valor: unknown, max=80) => typeof valor==='string' ? valor.slice(0,max) : '';

export const POST: APIRoute = async ({locals,request}) => {
  if (clienteActual().id!=='turia') return json(404,{ok:false,error:'No disponible.'});
  const s=sesionCon(locals,'facturas');
  if(!s)return json(403,{ok:false,error:'No tienes permiso para importar materiales.'});
  if(!request.headers.get('content-type')?.startsWith('application/json'))
    return json(415,{ok:false,error:'Este importador procesa el PDF localmente. Envía solo las fichas en JSON.'});
  const limitado=await cuerpoLimitado(request,900_000);
  if(!limitado)return json(413,{ok:false,error:'La petición supera el tamaño permitido.'});
  let input: Record<string,unknown> | null;
  try {
    const parsed:unknown=await limitado.json();
    input=parsed!==null && typeof parsed==='object' && !Array.isArray(parsed) ? parsed as Record<string,unknown> : null;
  }catch{input=null;}
  if(!input)return json(400,{ok:false,error:'Solicitud no válida.'});
  const accion=input.accion;
  try{
    if(accion==='confirmar'){
      const result=await importarCandidatos(s.repos,dato(input.proveedor),dato(input.archivo,90),input.articulos,s.usuario.email);
      return json(200,{ok:true,...result});
    }
    if(accion!=='interpretar' && accion!=='vision')
      return json(400,{ok:false,error:'Operación de importación no reconocida.'});
    const clave=(env as Record<string,unknown>).GROQ_API_KEY;
    if(typeof clave!=='string'||!clave.trim())
      return json(503,{ok:false,error:'Configura GROQ_API_KEY para utilizar la interpretación inteligente gratuita. Puedes seguir revisando el PDF localmente.'});
    const fecha=dia(),tipo=accion==='vision'?'vision':'texto';
    const cuenta=s.usuario.email+':gubia-local-'+tipo;
    const limite=accion==='vision'?MAX_VISION_DIA:MAX_LOTES_DIA;
    if(await s.repos.usoAsistente.obtener(cuenta,fecha)>=limite)
      return json(429,{ok:false,error:'Has alcanzado el límite diario de Gubia Importador. Conserva tu revisión y continúa otro día.'});
    // Se contabiliza antes de la solicitud, incluso cuando la API externa falla.
    await s.repos.usoAsistente.sumar(cuenta,fecha);
    const proveedor=dato(input.proveedor);
    if(accion==='vision'){
      const articulos=await interpretarMuestraConGroq(proveedor,input.imagen,input.pagina,input.texto,{apiKey:clave});
      return json(200,{ok:true,articulos});
    }
    const resultado=await interpretarTextoConGroq(proveedor,input.paginas,{apiKey:clave});
    return json(200,{ok:true,...resultado});
  }catch(e){
    if(e instanceof ErrorImportacion)return json(e.estado,{ok:false,error:e.message});
    console.error('[Gubia Local] Error de análisis o confirmación',e instanceof Error?e.name:'desconocido');
    return json(500,{ok:false,error:'No se ha completado la operación. Conserva los materiales revisados y reintenta.'});
  }
};
