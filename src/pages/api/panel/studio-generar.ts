import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { iaDe } from '../../../plataforma/configuracion.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { cuerpoLimitado } from '../../../server/panel/cuerpo.ts';
import { asegurarEsquema } from '../../../server/data/d1/migraciones.ts';
import type { BaseD1 } from '../../../server/data/d1/base.ts';
import { claveGemini, mesDe, limitePresupuestado } from '../../../server/simulador/cuota.ts';
import { instruccionesRender } from '../../../server/simulador/render-boceto.ts';
import type { InterpretacionBoceto } from '../../../server/simulador/boceto.ts';
import { URL_GEMINI } from '../../../services/renovationAiService.ts';
import { tipoDeImagen } from '../../../server/panel/fotos.ts';
import { sentenciasStudio } from '../../../server/data/d1/studio.ts';
export const prerender=false;
type Bucket={get(key:string):Promise<{arrayBuffer():Promise<ArrayBuffer>}|null>;put(key:string,data:Uint8Array):Promise<unknown>;delete(key:string):Promise<void>};
const e=env as unknown as {DB:BaseD1;IMAGENES_PRIVADAS?:Bucket};
const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const b64=(bytes:Uint8Array)=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
export const POST:APIRoute=async({locals,request})=>{
  const tenant=clienteActual().id;if(tenant!=='turia')return json(404,{ok:false});
  const sesion=sesionCon(locals,'editar');if(!sesion)return json(403,{ok:false});
  if(!e.IMAGENES_PRIVADAS)return json(503,{ok:false,error:'R2 privado no configurado'});
  const key=claveGemini(env as Record<string,unknown>);if(!key)return json(503,{ok:false,error:'Gemini no configurado'});
  const body=await cuerpoLimitado(request,2048);if(!body)return json(413,{ok:false});
  let id:string,clave:string;try{const entrada=await body.json() as {id?:string;clave?:string};id=String(entrada.id||'');clave=String(entrada.clave||'');}catch{return json(400,{ok:false});}
  if(!/^[a-f0-9-]{36}$/.test(clave))return json(400,{ok:false,error:'Falta identificador de solicitud válido'});
  if(!/^studio_[a-f0-9-]{36}$/.test(id))return json(400,{ok:false,error:'ID inválido'});
  await asegurarEsquema(e.DB);
  const anterior=await sentenciasStudio(e.DB).leerGeneracion()
    .bind(tenant,id,clave).first<{id:string;revision:number;estado:string;resultado_archivo_id:string|null}>();
  if(anterior)return json(anterior.estado==='procesando'?202:200,{ok:anterior.estado==='completada',reutilizada:true,generacion:anterior.id,estado:anterior.estado,archivoId:anterior.resultado_archivo_id,revision:anterior.revision,error:anterior.estado==='fallida'?'La generación anterior falló; inicia una solicitud nueva':undefined});
  const row=await sentenciasStudio(e.DB).leerBoceto7()
    .bind(id,tenant,'validada').first<{revision:number;interpretacion:string}>();
  if(!row)return json(409,{ok:false,error:'Valida el boceto antes de generar'});
  const interpretacion=JSON.parse(row.interpretacion) as InterpretacionBoceto;
  if(interpretacion.modulos.some(m=>m.piezas.some(p=>!p.catalogoVarianteId)))return json(409,{ok:false,error:'Asigna materiales a todas las piezas'});
  const [variantes,articulos]=await Promise.all([sesion.repos.catalogo.variantes?.()??Promise.resolve([]),sesion.repos.catalogo.articulos()]);
  const porVariante=new Map(variantes.map(v=>[v.id,v]));
  const porArticulo=new Map(articulos.map(a=>[a.id,a]));
  const acabados=interpretacion.modulos.flatMap(m=>m.piezas.map(p=>{
    const v=porVariante.get(p.catalogoVarianteId||'');
    const a=v?porArticulo.get(v.articuloId):undefined;
    return {modulo:m.id,pieza:p.id,tipo:p.tipo,variante:v,articulo:a};
  }));
  if(acabados.some(x=>!x.variante||!x.articulo||x.variante.estado!=='activo'||x.articulo.archivado))
    return json(409,{ok:false,error:'Hay materiales inexistentes, archivados o descatalogados'});
  const referencias=acabados.map(x=>({modulo:x.modulo,pieza:x.pieza,tipo:x.tipo,
    referencia:x.variante!.referencia,acabado:x.variante!.acabado||x.articulo!.acabado,
    soporte:x.variante!.soporte,espesorMm:x.variante!.dimensiones.espesorMm??x.articulo!.espesor}));
  let especificacion:ReturnType<typeof instruccionesRender>;
  try{especificacion=instruccionesRender(interpretacion);}catch{return json(422,{ok:false,error:'Boceto no válido'});}
  const archivos=await sentenciasStudio(e.DB).leerArchivo3()
    .bind(id,tenant,interpretacion.fotoEspacioId,interpretacion.fotoBocetoId).all<{id:string;objeto_r2:string;mime:string;clase:string}>();
  const cargar=async(fid:string,clase:'espacio'|'boceto')=>{
    const a=archivos.results.find(x=>x.id===fid);if(!a||a.clase!==clase)throw Error('Imagen ausente o clase incorrecta');
    const obj=await e.IMAGENES_PRIVADAS!.get(a.objeto_r2);if(!obj)throw Error('Imagen no disponible');
    const bytes=new Uint8Array(await obj.arrayBuffer());
    if(bytes.length>6_000_000||tipoDeImagen(bytes)?.tipo!==a.mime)throw Error('Imagen no válida');
    return {mimeType:a.mime,data:b64(bytes)};
  };
  let foto,boceto;try{[foto,boceto]=await Promise.all([cargar(interpretacion.fotoEspacioId,'espacio'),cargar(interpretacion.fotoBocetoId,'boceto')]);}
  catch{return json(422,{ok:false,error:'Faltan imágenes originales'});}
  const activa=await sentenciasStudio(e.DB).leerGeneracion2()
    .bind(id,tenant,row.revision,'procesando').first();
  if(activa)return json(409,{ok:false,error:'Ya hay una generación en curso. Consulta el historial antes de reintentar'});
  const mes=mesDe(),limite=limitePresupuestado(iaDe(clienteActual()).simulacionesMes);
  if(!(await sesion.repos.usoSimulador.reservar(tenant,mes,limite)))return json(403,{ok:false,error:'Presupuesto mensual agotado'});
  const generacion='studiogen_'+crypto.randomUUID(),fecha=new Date().toISOString();
  const solicitud=JSON.stringify({revision:row.revision,especificacion,referencias});
  try{
    await sentenciasStudio(e.DB).insertarGeneracion()
      .bind(generacion,id,tenant,row.revision,'procesando',solicitud,20,fecha,fecha,clave).run();
  }catch{
    await sesion.repos.usoSimulador.devolver(tenant,mes);
    return json(409,{ok:false,error:'Ya existe una generación activa o no se pudo reservar el trabajo'});
  }
  const modelo=iaDe(clienteActual()).modelos.gemini;
  const prompt='Render fotográfico de carpintería. PRIMERA imagen: espacio real, SEGUNDA: boceto. Preservar el espacio, las instalaciones y el encuadre. Respetar exactamente los módulos y los acabados del diseño validado. No añadir elementos. Diseño estructurado: '+JSON.stringify({especificacion,referencias});
  let respuesta:Response;
  try{respuesta=await fetch(URL_GEMINI+'/'+encodeURIComponent(modelo)+':generateContent',{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},{inlineData:foto},{inlineData:boceto}]}],
      generationConfig:{responseModalities:['IMAGE'],imageConfig:{imageSize:'1K'}}})
  });}catch{
    await sentenciasStudio(e.DB).actualizarGeneracion().bind('fallida','Conexión con proveedor',new Date().toISOString(),generacion).run();
    return json(502,{ok:false,error:'Error de conexión; revisa el historial antes de reintentar'});
  }
  if(!respuesta.ok){
    if([400,403,429].includes(respuesta.status))await sesion.repos.usoSimulador.devolver(tenant,mes);
    await sentenciasStudio(e.DB).actualizarGeneracion()
      .bind('fallida','Proveedor HTTP '+respuesta.status,new Date().toISOString(),generacion).run();
    return json(respuesta.status===429?429:502,{ok:false,error:'El proveedor no pudo generar la imagen'});
  }
  const resultado=await respuesta.json().catch(()=>null) as {candidates?:{content?:{parts?:{inlineData?:{mimeType:string;data:string}}[]}}[]}|null;
  const imagen=resultado?.candidates?.[0]?.content?.parts?.find(p=>p.inlineData?.data)?.inlineData;
  if(!imagen||!['image/jpeg','image/png','image/webp'].includes(imagen.mimeType)){
    await sentenciasStudio(e.DB).actualizarGeneracion().bind('fallida','Respuesta sin imagen',new Date().toISOString(),generacion).run();
    return json(502,{ok:false,error:'El proveedor no devolvió una imagen válida'});
  }
  let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(imagen.data),c=>c.charCodeAt(0));}catch{
    await sentenciasStudio(e.DB).actualizarGeneracion().bind('fallida','Imagen base64 ilegible',new Date().toISOString(),generacion).run();
    return json(502,{ok:false,error:'Imagen de proveedor ilegible'});
  }
  if(bytes.length>6_000_000||tipoDeImagen(bytes)?.tipo!==imagen.mimeType){
    await sentenciasStudio(e.DB).actualizarGeneracion()
      .bind('fallida','Imagen inválida',new Date().toISOString(),generacion).run();
    return json(502,{ok:false,error:'Imagen resultante no válida'});
  }
  const archivoId='studiofile_'+crypto.randomUUID(),objetoR2='privado/studio/'+tenant+'/'+id+'/'+archivoId;
  try{await e.IMAGENES_PRIVADAS.put(objetoR2,bytes);}catch{
    await sentenciasStudio(e.DB).actualizarGeneracion().bind('fallida','R2 no disponible',new Date().toISOString(),generacion).run();
    return json(503,{ok:false,error:'No se pudo almacenar la imagen generada'});
  }
  try{
    await e.DB.batch([
      sentenciasStudio(e.DB).insertarArchivo()
        .bind(archivoId,id,tenant,'resultado',objetoR2,imagen.mimeType,bytes.length,new Date().toISOString()),
      sentenciasStudio(e.DB).actualizarGeneracion2()
        .bind('completada',archivoId,new Date().toISOString(),generacion,tenant)
    ]);
  }catch{
    await e.IMAGENES_PRIVADAS.delete(objetoR2).catch(()=>{});
    await sentenciasStudio(e.DB).actualizarGeneracion().bind('fallida','Error guardando metadatos de resultado',new Date().toISOString(),generacion).run().catch(()=>{});
    return json(500,{ok:false,error:'No se pudo guardar el resultado'});
  }
  return json(200,{ok:true,generacion,archivoId,revision:row.revision});
};
export const GET:APIRoute=async({locals,url})=>{
  if(clienteActual().id!=='turia')return json(404,{ok:false});
  if(!sesionCon(locals))return json(403,{ok:false});
  const id=url.searchParams.get('id')||'';if(!/^studio_[a-f0-9-]{36}$/.test(id))return json(400,{ok:false});
  await asegurarEsquema(e.DB);
  const r=await sentenciasStudio(e.DB).leerGeneracion3()
    .bind(id,clienteActual().id).all();
  const ahora=Date.now();
  const generaciones=(r.results as {estado:string;creado:string}[]).map((g)=>({...g,requiereRevision:g.estado==='procesando'&&ahora-Date.parse(g.creado)>15*60_000}));
  return json(200,{ok:true,generaciones});
};
