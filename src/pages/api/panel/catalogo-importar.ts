import { ErrorEspacioImagen } from '../../../server/data/tipos';
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { cuerpoLimitado } from '../../../server/panel/cuerpo.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { importarCandidatos, ErrorImportacion } from '../../../server/catalogo/importacion-proveedor.ts';
import { interpretarTextoConGroq, interpretarMuestraConGroq } from '../../../server/catalogo/interpretacion-groq.ts';

export const prerender = false;
const json = (estado: number, cuerpo: unknown, extras: Record<string,string> = {}) => new Response(JSON.stringify(cuerpo),{
  status:estado,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...extras},
});

// Los límites por usuario protegen la cuota Free compartida con el chat Gubia.
// No hay ninguna ruta hacia Gemini, ni respaldo de pago.
export const MAX_LOTES_DIA = 700;
/** Máximo compartido de llamadas gpt-oss-120b para Turia; el límite externo de Groq prevalece. */
export const GROQ_LLAMADAS_DIA = 1000;
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
      const result=await importarCandidatos(s.repos,dato(input.proveedor),dato(input.archivo,90),input.articulos,s.usuario.email,input.muestras);
      return json(200,{ok:true,...result});
    }
    if(accion!=='interpretar' && accion!=='vision')
      return json(400,{ok:false,error:'Operación de importación no reconocida.'});
    const clave=(env as Record<string,unknown>).GROQ_API_KEY;
    if(typeof clave!=='string'||!clave.trim())
      return json(503,{ok:false,error:'Configura GROQ_API_KEY para utilizar la interpretación inteligente gratuita. Puedes seguir revisando el PDF localmente.'});
    const fecha=dia();
    if (accion==='vision') {
      // Vision usa otro modelo Groq: contador independiente.
      const cuenta=s.usuario.email+':gubia-local-vision';
      if (!(await s.repos.usoAsistente.reservar(cuenta,fecha,MAX_VISION_DIA)))
        return json(429,{ok:false,error:'Has alcanzado el límite diario de revisión visual. Conserva las fichas.'});
    } else {
      // 70% del presupuesto del modelo de texto para la importación cuando hay
      // cargas. Reserva atómica compartida con Gubia; sin llamadas artificiales.
      if (!(await s.repos.usoAsistente.reservarGroq(fecha,'importador',GROQ_LLAMADAS_DIA)))
        return json(429,{ok:false,error:'El presupuesto de Groq para importar está agotado. Conserva la revisión y continúa mañana.'});
    }
    const proveedor=dato(input.proveedor);
    if(accion==='vision'){
      const articulos=await interpretarMuestraConGroq(proveedor,input.imagen,input.pagina,input.texto,{apiKey:clave});
      return json(200,{ok:true,articulos});
    }
    const resultado=await interpretarTextoConGroq(proveedor,input.paginas,{apiKey:clave});
    return json(200,{ok:true,...resultado});
  }catch(e){
    if(e instanceof ErrorEspacioImagen)return json(507,{ok:false,error:e.message});
    if(e instanceof ErrorImportacion)return json(e.estado,{ok:false,error:e.message,reintentarEnMs:e.reintentarEnMs},
      e.reintentarEnMs?{'Retry-After':String(Math.max(1,Math.ceil(e.reintentarEnMs/1000)))}:{});
    console.error('[Gubia Local] Error de análisis o confirmación',e instanceof Error?e.name:'desconocido');
    return json(500,{ok:false,error:'No se ha completado la operación. Conserva los materiales revisados y reintenta.'});
  }
};
