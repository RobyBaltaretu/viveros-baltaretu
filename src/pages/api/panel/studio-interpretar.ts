import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { cuerpoLimitado } from '../../../server/panel/cuerpo.ts';
import { asegurarEsquema } from '../../../server/data/d1/migraciones.ts';
import type { BaseD1 } from '../../../server/data/d1/base.ts';
import { tipoDeImagen } from '../../../server/panel/fotos.ts';
import { claveGemini, mesDe, limitePresupuestado } from '../../../server/simulador/cuota.ts';
import { iaDe } from '../../../plataforma/configuracion.ts';
import { interpretarBoceto } from '../../../server/simulador/interpretar-boceto.ts';
import { sentenciasStudio } from '../../../server/data/d1/studio.ts';
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
  if(Number(request.headers.get('content-length')||0)>2000)return json(413,{ok:false});
  const limitado=await cuerpoLimitado(request,2000);if(!limitado)return json(413,{ok:false});
  let id:string;try{id=String((await limitado.json() as {id?:string}).id||'');}catch{return json(400,{ok:false});}
  if(!/^studio_[a-z0-9-]{36}$/.test(id))return json(400,{ok:false});
  await asegurarEsquema(e.DB);
  const f=await sentenciasStudio(e.DB).leerBoceto5().bind(id,'turia').first<{revision:number;interpretacion:string}>();
  if(!f)return json(404,{ok:false});
  const actual=JSON.parse(f.interpretacion) as {fotoEspacioId:string;fotoBocetoId:string;estado:string};
  if(actual.estado==='validada')return json(409,{ok:false,error:'Boceto validado'});
  const fotos=await sentenciasStudio(e.DB).leerArchivo4()
    .bind(id,'turia',actual.fotoEspacioId,actual.fotoBocetoId).all<{id:string;objeto_r2:string}>();
  const leer=async(fid:string)=>{
    const foto=fotos.results.find(x=>x.id===fid);if(!foto)throw Error('Fotografía pendiente');
    const obj=await e.IMAGENES_PRIVADAS!.get(foto.objeto_r2);if(!obj)throw Error('Fotografía no encontrada');
    const bytes=new Uint8Array(await obj.arrayBuffer()),tipo=tipoDeImagen(bytes);
    if(!tipo||bytes.length>6_000_000)throw Error('Fotografía no válida');
    return {mime:tipo.tipo,base64:base64(bytes)};
  };
  let espacio,dibujo;try{[espacio,dibujo]=await Promise.all([leer(actual.fotoEspacioId),leer(actual.fotoBocetoId)]);}catch{return json(409,{ok:false,error:'Guarda primero las dos fotografías'});}
  const mes=mesDe(),limite=limitePresupuestado(iaDe(clienteActual()).simulacionesMes);
  if(!(await s.repos.usoSimulador.reservar('turia',mes,limite)))return json(403,{ok:false,error:'Cuota mensual de IA agotada'});
  const resultado=await interpretarBoceto(espacio,dibujo,{espacio:actual.fotoEspacioId,dibujo:actual.fotoBocetoId},key,'gemini-2.5-flash');
  if(!resultado.ok && [400,403,429].includes(resultado.estado||0))await s.repos.usoSimulador.devolver('turia',mes);
  if(!resultado.ok)return json(resultado.estado===429?429:502,{ok:false,error:resultado.error});
  const revision=f.revision+1,fecha=new Date().toISOString(),texto=JSON.stringify(resultado.interpretacion);
  const cambio=await sentenciasStudio(e.DB).actualizarBoceto2()
    .bind(texto,'pendiente',revision,fecha,s.usuario.email,id,'turia',f.revision).run();
  if(!cambio.meta?.changes)return json(409,{ok:false,error:'Conflicto de revisión'});
  await sentenciasStudio(e.DB).insertarVersion3()
    .bind(id,revision,texto,fecha,s.usuario.email).run();
  return json(200,{ok:true,revision,interpretacion:resultado.interpretacion});
};
