import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { asegurarEsquema } from '../../../server/data/d1/migraciones.ts';
import type { BaseD1 } from '../../../server/data/d1/base.ts';
import { tipoDeImagen } from '../../../server/panel/fotos.ts';
import { claveGemini } from '../../../server/simulador/cuota.ts';
import { interpretarBoceto } from '../../../server/simulador/interpretar-boceto.ts';
export const prerender=false;
type Bucket={get(key:string):Promise<{arrayBuffer():Promise<ArrayBuffer>}|null>};
const e=env as unknown as {DB:BaseD1;IMAGENES_PRIVADAS?:Bucket};
const json=(status:number,v:unknown)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const base64=(bytes:Uint8Array)=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
export const POST:APIRoute=async({locals,request})=>{
  if(clienteActual().id!=='turia')return json(404,{ok:false});
  const s=sesionCon(locals,'editar');if(!s)return json(403,{ok:false});
  const key=claveGemini(e as unknown as Record<string,unknown>);
  if(!key||!e.IMAGENES_PRIVADAS)return json(503,{ok:false,error:'Falta configurar Gemini o R2 privado'});
  let id='';try{id=String((await request.json() as {id?:string}).id||'');}catch{return json(400,{ok:false});}
  if(!/^studio_[a-z0-9-]{36}$/.test(id))return json(400,{ok:false});
  await asegurarEsquema(e.DB);
  const f=await e.DB.prepare('SELECT revision,interpretacion FROM studio_bocetos WHERE id=? AND cliente_id=?').bind(id,'turia').first<{revision:number;interpretacion:string}>();
  if(!f)return json(404,{ok:false});
  const actual=JSON.parse(f.interpretacion) as {fotoEspacioId:string;fotoBocetoId:string;estado:string};
  if(actual.estado==='validada')return json(409,{ok:false,error:'Boceto validado'});
  const fotos=await e.DB.prepare('SELECT id,objeto_r2 FROM studio_boceto_archivos WHERE boceto_id=? AND cliente_id=? AND id IN (?,?)')
    .bind(id,'turia',actual.fotoEspacioId,actual.fotoBocetoId).all<{id:string;objeto_r2:string}>();
  const leer=async(fid:string)=>{
    const foto=fotos.results.find(x=>x.id===fid);if(!foto)throw Error('Fotografía pendiente');
    const obj=await e.IMAGENES_PRIVADAS!.get(foto.objeto_r2);if(!obj)throw Error('Fotografía no encontrada');
    const bytes=new Uint8Array(await obj.arrayBuffer()),tipo=tipoDeImagen(bytes);
    if(!tipo||bytes.length>6_000_000)throw Error('Fotografía no válida');
    return {mime:tipo.tipo,base64:base64(bytes)};
  };
  let espacio,dibujo;try{[espacio,dibujo]=await Promise.all([leer(actual.fotoEspacioId),leer(actual.fotoBocetoId)]);}catch{return json(409,{ok:false,error:'Guarda primero las dos fotografías'});}
  const resultado=await interpretarBoceto(espacio,dibujo,{espacio:actual.fotoEspacioId,dibujo:actual.fotoBocetoId},key,'gemini-2.5-flash');
  if(!resultado.ok)return json(resultado.estado===429?429:502,{ok:false,error:resultado.error});
  const revision=f.revision+1,fecha=new Date().toISOString(),texto=JSON.stringify(resultado.interpretacion);
  const cambio=await e.DB.prepare('UPDATE studio_bocetos SET interpretacion=?,estado=?,revision=?,actualizado=?,actualizado_por=? WHERE id=? AND cliente_id=? AND revision=?')
    .bind(texto,'pendiente',revision,fecha,s.usuario.email,id,'turia',f.revision).run();
  if(!cambio.meta?.changes)return json(409,{ok:false,error:'Conflicto de revisión'});
  await e.DB.prepare('INSERT INTO studio_boceto_versiones(boceto_id,revision,interpretacion,creado,creado_por) VALUES (?,?,?,?,?)')
    .bind(id,revision,texto,fecha,s.usuario.email).run();
  return json(200,{ok:true,revision,interpretacion:resultado.interpretacion});
};
