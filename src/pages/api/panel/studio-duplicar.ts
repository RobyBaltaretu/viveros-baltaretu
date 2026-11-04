import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { cuerpoLimitado } from '../../../server/panel/cuerpo.ts';
import { asegurarEsquema } from '../../../server/data/d1/migraciones.ts';
import type { BaseD1 } from '../../../server/data/d1/base.ts';
import { validarInterpretacion, type InterpretacionBoceto } from '../../../server/simulador/boceto.ts';
export const prerender=false;
const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export const POST:APIRoute=async({locals,request})=>{
 if(clienteActual().id!=='turia')return json(404,{ok:false});
 const sesion=sesionCon(locals,'editar');if(!sesion)return json(403,{ok:false});
 const limitado=await cuerpoLimitado(request,2000);if(!limitado)return json(413,{ok:false});
 let id='';try{id=String((await limitado.json() as {id?:string}).id||'');}catch{return json(400,{ok:false});}
 if(!/^studio_[a-f0-9-]{36}$/.test(id))return json(400,{ok:false});
 const db=(env as unknown as {DB:BaseD1}).DB;
 await asegurarEsquema(db);
 const original=await db.prepare('SELECT titulo,estado,interpretacion FROM studio_bocetos WHERE id=? AND cliente_id=?')
   .bind(id,'turia').first<{titulo:string;estado:string;interpretacion:string}>();
 if(!original)return json(404,{ok:false});
 if(original.estado!=='validada')return json(409,{ok:false,error:'Solo se versionan diseños validados'});
 const b=JSON.parse(original.interpretacion) as InterpretacionBoceto;
 const nueva:InterpretacionBoceto={...b,estado:'requiere-revision',confirmadaPor:undefined,confirmadaEn:undefined,
   fotoEspacioId:'pendiente-espacio',fotoBocetoId:'pendiente-boceto'};
 const errores=validarInterpretacion(nueva);if(errores.length)return json(422,{ok:false,errores});
 const nuevoId='studio_'+crypto.randomUUID(),fecha=new Date().toISOString(),texto=JSON.stringify(nueva);
 await db.batch([
  db.prepare('INSERT INTO studio_bocetos(id,cliente_id,titulo,estado,interpretacion,revision,creado,actualizado,actualizado_por,origen_boceto_id) VALUES (?,?,?,?,?,1,?,?,?,?)')
    .bind(nuevoId,'turia',original.titulo+' · revisión', 'borrador',texto,fecha,fecha,sesion.usuario.email,id),
  db.prepare('INSERT INTO studio_boceto_versiones(boceto_id,revision,interpretacion,creado,creado_por) VALUES (?,1,?,?,?)')
    .bind(nuevoId,texto,fecha,sesion.usuario.email)
 ]);
 return json(201,{ok:true,id:nuevoId,revision:1,origenId:id,requiereSubirFotos:true});
};
