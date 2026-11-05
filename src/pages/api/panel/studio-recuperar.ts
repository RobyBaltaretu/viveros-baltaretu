import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { cuerpoLimitado } from '../../../server/panel/cuerpo.ts';
import { asegurarEsquema } from '../../../server/data/d1/migraciones.ts';
import type { BaseD1 } from '../../../server/data/d1/base.ts';
import { sentenciasStudio } from '../../../server/data/d1/studio.ts';
export const prerender=false;
const json=(status:number,v:unknown)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
/** Reconciliación conservadora: no devuelve cuota porque el proveedor pudo cobrar. */
export const POST:APIRoute=async({locals,request})=>{
 if(clienteActual().id!=='turia')return json(404,{ok:false});
 if(!sesionCon(locals,'editar'))return json(403,{ok:false});
 const body=await cuerpoLimitado(request,2048);if(!body)return json(413,{ok:false});
 let id:string;try{id=String((await body.json() as {id?:unknown}).id||'');}catch{return json(400,{ok:false});}
 if(!/^studiogen_[a-f0-9-]{36}$/.test(id))return json(400,{ok:false,error:'ID inválido'});
 const db=(env as unknown as {DB:BaseD1}).DB;await asegurarEsquema(db);
 const limite=new Date(Date.now()-15*60_000).toISOString();
 const resultado=await sentenciasStudio(db).marcarGeneracionCaducada()
  .bind(new Date().toISOString(),id,'turia',limite).run();
 if(!resultado.meta?.changes)return json(409,{ok:false,error:'La generación no está bloqueada o aún no ha superado 15 minutos'});
 return json(200,{ok:true,estado:'fallida',cuotaDevuelta:false,advertencia:'No se devuelve cuota automáticamente: el proveedor podría haber facturado la solicitud'});
};
