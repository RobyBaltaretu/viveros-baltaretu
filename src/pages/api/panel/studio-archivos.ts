import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { asegurarEsquema } from '../../../server/data/d1/migraciones.ts';
import type { BaseD1 } from '../../../server/data/d1/base.ts';
import { tipoDeImagen } from '../../../server/panel/fotos.ts';
import { respuestaImagenPrivada } from '../../../server/panel/imagen-privada.ts';
import { sentenciasStudio } from '../../../server/data/d1/studio.ts';

export const prerender = false;
const MAX_BYTES=6_000_000;
type Bucket={put(key:string,bytes:Uint8Array):Promise<unknown>;get(key:string):Promise<{arrayBuffer():Promise<ArrayBuffer>}|null>;delete(key:string):Promise<void>};
const entorno=env as unknown as {DB:BaseD1;IMAGENES_PRIVADAS?:Bucket};
const json=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const idValido=(s:unknown):s is string=>typeof s==='string' && /^[a-zA-Z0-9_-]{8,100}$/.test(s);
const tenant=()=>clienteActual().id;
export const POST:APIRoute=async({locals,request})=>{
  if(tenant()!=='turia')return json(404,{ok:false});
  if(!sesionCon(locals,'editar'))return json(403,{ok:false});
  const bucket=entorno.IMAGENES_PRIVADAS;
  if(!bucket)return json(503,{ok:false,error:'El almacenamiento privado R2 debe configurarse antes de subir imágenes'});
  const longitud=Number(request.headers.get('content-length')||0);
  if(longitud>MAX_BYTES+4096)return json(413,{ok:false,error:'Imagen demasiado grande'});
  const url=new URL(request.url),bocetoId=url.searchParams.get('bocetoId'),clase=url.searchParams.get('clase');
  if(!idValido(bocetoId)||!['espacio','boceto','referencia'].includes(clase||''))return json(400,{ok:false,error:'Boceto o tipo de imagen inválido'});
  await asegurarEsquema(entorno.DB);
  const existe=await sentenciasStudio(entorno.DB).leerBoceto().bind(bocetoId,tenant()).first<{id:string;estado:string}>();
  if(!existe)return json(404,{ok:false});
  if(existe.estado==='validada'||existe.estado==='archivada')return json(409,{ok:false,error:'Diseño inmutable; crea una revisión editable'});
  // Subida binaria, no multipart; límite real aun cuando no se informa Content-Length.
  const reader=request.body?.getReader();if(!reader)return json(400,{ok:false});
  const bloques:Uint8Array[]=[];let tamano=0;
  try {
    while(true){const r=await reader.read();if(r.done)break;tamano+=r.value.byteLength;
      if(tamano>MAX_BYTES){await reader.cancel();return json(413,{ok:false,error:'Imagen demasiado grande'});}
      bloques.push(r.value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(tamano);let offset=0;
  for(const bloque of bloques){bytes.set(bloque,offset);offset+=bloque.byteLength;}
  const tipo=tipoDeImagen(bytes);
  if(!tipo)return json(415,{ok:false,error:'Solo JPEG, PNG y WebP válidos'});
  const id='studiofile_'+crypto.randomUUID();
  const clave='privado/studio/'+tenant()+'/'+bocetoId+'/'+id;
  await bucket.put(clave,bytes);
  try {
    await sentenciasStudio(entorno.DB).insertarArchivo()
      .bind(id,bocetoId,tenant(),clase,clave,tipo.tipo,tamano,new Date().toISOString()).run();
  }catch(error){await bucket.delete(clave).catch(()=>{});throw error;}
  return json(201,{ok:true,id,clase,tamano});
};
export const GET:APIRoute=async({locals,url})=>{
  if(tenant()!=='turia')return json(404,{ok:false});
  if(!sesionCon(locals))return json(403,{ok:false});
  const id=url.searchParams.get('id');if(!idValido(id))return json(400,{ok:false});
  await asegurarEsquema(entorno.DB);
  const fila=await sentenciasStudio(entorno.DB).leerArchivo().bind(id,tenant()).first<{objeto_r2:string}>();
  if(!fila)return json(404,{ok:false});
  const objeto=await entorno.IMAGENES_PRIVADAS?.get(fila.objeto_r2);
  if(!objeto)return json(404,{ok:false});
  return respuestaImagenPrivada(new Uint8Array(await objeto.arrayBuffer()),'portafolio');
};
