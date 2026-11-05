import { URL_GEMINI } from '../../services/renovationAiService.ts';
import { validarInterpretacion, type InterpretacionBoceto, type CotaBoceto } from './boceto.ts';
export type ImagenBoceto = { mime: string; base64: string };
const desconocida = (): CotaBoceto => ({valorMm:null,precision:'desconocida',origen:'boceto',confirmada:false});
export type UnidadBoceto='cm'|'mm'|'m';
const FACTOR:Record<UnidadBoceto,number>={mm:1,cm:10,m:1000};
/** Unidad del dibujo; sin unidad escrita, un carpintero acota en centímetros. */
export const unidadDe=(u:unknown):UnidadBoceto=>u==='mm'||u==='m'?u:'cm';
/** Cota leída del dibujo, pasada a mm: siempre «aproximada» (la confirma la persona). Acepta un número o {valorMm}. */
export function cota(v:unknown,unidad:UnidadBoceto='mm'):CotaBoceto {
  const crudo=typeof v==='number'?v:v&&typeof v==='object'?(v as Record<string,unknown>).valorMm:null;
  if(typeof crudo!=='number'||!Number.isFinite(crudo)||crudo<=0)return desconocida();
  // {valorMm} ya viene en mm; un número va en la unidad del dibujo.
  const n=typeof v==='number'?crudo*FACTOR[unidad]:crudo;
  if(n>100000)return desconocida();
  return {valorMm:Math.round(n),precision:'aproximada',origen:'boceto',confirmada:false};
}

/** Modelo de Gemini para leer los bocetos (texto, barato). Se puede cambiar con GEMINI_MODELO_BOCETO. */
export const MODELO_INTERPRETACION='gemini-3.8-flash';

const TIPOS_MODULO=['armario','cajonera','balda','hueco-electrodomestico','encimera','panel','otro'];
const TIPOS_PIEZA=['puerta','costado','interior','balda','cajon','encimera','canto','trasera','otra'];
/** Forma exacta de la respuesta (salida estructurada de Gemini): así no hay que adivinar sus claves. */
export const ESQUEMA_RESPUESTA={
  type:'OBJECT',
  properties:{
    unidad:{type:'STRING',enum:['cm','mm','m'],description:'Unidad de las cotas del dibujo. Si no está escrita, cm.'},
    modulos:{type:'ARRAY',description:'Módulos de izquierda a derecha, tal como se ven en el dibujo',items:{type:'OBJECT',properties:{
      tipo:{type:'STRING',enum:TIPOS_MODULO},
      ancho:{type:'NUMBER',nullable:true,description:'Cota escrita en el dibujo, en su unidad; null si no hay'},
      alto:{type:'NUMBER',nullable:true,description:'Cota escrita en el dibujo, en su unidad; null si no hay'},
      fondo:{type:'NUMBER',nullable:true,description:'Cota escrita en el dibujo, en su unidad; null si no hay. Si solo hay un fondo general, úsalo en todos'},
      contenido:{type:'STRING',description:'Qué lleva: electrodomésticos, fregadero, encimera, barra de colgar, baldas, altillo, número de puertas…'},
      piezas:{type:'ARRAY',items:{type:'STRING',enum:TIPOS_PIEZA}},
      notas:{type:'STRING'},
    },required:['tipo','ancho','alto','fondo','contenido','piezas']}},
    conservar:{type:'ARRAY',description:'Elementos del espacio que no se tocan: pilar, termo, ventana, tuberías, enchufes…',items:{type:'STRING'}},
    obstaculos:{type:'ARRAY',items:{type:'STRING'}},
    preguntas:{type:'ARRAY',items:{type:'STRING'}},
  },
  required:['unidad','modulos','conservar','obstaculos','preguntas'],
};

/** Mensaje claro según el código del proveedor (para saber qué arreglar). */
export function explicarErrorInterpretacion(estado:number,detalle:string):string{
  const d=detalle?' ('+detalle.slice(0,160)+')':'';
  if(estado===400)return 'Gemini no ha aceptado las fotos o la petición'+d+'. Prueba con otras fotos (JPEG o PNG).';
  if(estado===401||estado===403)return 'La clave de Google (GOOGLE_API_KEY) no es válida o no tiene permiso para Gemini'+d+'.';
  if(estado===404)return 'El modelo de Gemini para leer bocetos no existe o no está disponible'+d+'. Revisa GEMINI_MODELO_BOCETO.';
  if(estado===429)return 'Gemini ha recibido demasiadas peticiones o se ha agotado el saldo'+d+'. Espera un momento y vuelve a intentarlo.';
  return 'Gemini no está respondiendo ahora (error '+estado+')'+d+'. Vuelve a intentarlo en un rato.';
}
export function normalizarInterpretacion(raw:unknown,espacio:string,dibujo:string):InterpretacionBoceto|null {
  if(!raw||typeof raw!=='object')return null;
  const v=raw as Record<string,unknown>;
  const lista=Array.isArray(v.modulos)?v.modulos:Array.isArray(v.modules)?v.modules:null;
  if(!lista||lista.length<1||lista.length>30)return null;
  const unidad=unidadDe(v.unidad);
  const modulos=lista.map((m:unknown,i:number)=>{
    const x=m&&typeof m==='object'?m as Record<string,unknown>:{};
    const tipo=(TIPOS_MODULO.find(t=>t===x.tipo)||'otro') as InterpretacionBoceto['modulos'][number]['tipo'];
    const tiposPieza=TIPOS_PIEZA;
    const piezas=Array.isArray(x.piezas)?x.piezas.slice(0,60).map((p,j)=>{
      const raw=typeof p==='string'?p:(p&&typeof p==='object'?(p as Record<string,unknown>).tipo:'');
      const tipo=(tiposPieza.find(t=>t===raw)||'otra') as InterpretacionBoceto['modulos'][number]['piezas'][number]['tipo'];
      return {id:'pieza-'+i+'-'+j,tipo,catalogoVarianteId:null,acabadoId:null};
    }):[];
    const contenido=typeof x.contenido==='string'?x.contenido.trim().slice(0,300):'';
    return {id:'modulo-'+i,tipo,orden:i,ancho:cota(x.ancho,unidad),alto:cota(x.alto,unidad),fondo:cota(x.fondo,unidad),piezas,
      notas:typeof x.notas==='string'?x.notas.slice(0,500):'',...(contenido?{contenido}:{})};
  });
  const b:InterpretacionBoceto={version:1,estado:'requiere-revision',categoria:'mueble',modulos,
    obstaculos:[...new Set([...(Array.isArray(v.conservar)?v.conservar:[]),...(Array.isArray(v.obstaculos)?v.obstaculos:[])]
      .map(x=>String(x).trim().slice(0,200)).filter(Boolean))].slice(0,20).map((descripcion,i)=>({id:'obstaculo-'+i,descripcion,conservar:true})),
    preguntas:Array.isArray(v.preguntas)?v.preguntas.slice(0,12).map(x=>String(x).slice(0,200)):[],
    fotoEspacioId:espacio,fotoBocetoId:dibujo};
  return validarInterpretacion(b).length?null:b;
}
export const PROMPT_INTERPRETACION=[
  'Eres un carpintero que lee un encargo. Imagen 1: foto del espacio real (puede tener el diseño marcado encima con rotulador rojo u otro color). Imagen 2: boceto a mano con cotas.',
  'El boceto manda en la distribución; la foto, en lo que hay en el espacio.',
  'Devuelve los módulos de IZQUIERDA a DERECHA, tal como se ven de frente. Un pilar o un hueco que no se fabrica no es un módulo: va en «conservar».',
  'Cotas: copia el número escrito en el dibujo e indica la unidad en «unidad». Los carpinteros acotan en centímetros sin escribir la unidad (233 = 233 cm; 86,5 = 86.5 cm): si no hay unidad escrita, «cm». Si una cota no está escrita, null; no la calcules ni la inventes. Si hay un solo fondo para todo, ponlo en cada módulo.',
  'Si las cotas parciales no suman la total, dilo en «preguntas».',
  'En «contenido» describe qué lleva cada módulo según el dibujo y las marcas de la foto: electrodomésticos (lavadora, secadora, apiladas o no), fregadero, encimera, barra de colgar, baldas, altillo, número de puertas y cajones.',
  'En «conservar» pon lo que existe en el espacio y no se toca: pilares, termo, calentador, ventanas, tuberías, grifos, enchufes, radiadores.',
  'Tipos de módulo: armario, cajonera, balda, hueco-electrodomestico, encimera, panel u otro. No inventes módulos, materiales ni medidas.',
].join('\n');
export async function interpretarBoceto(
  espacio:ImagenBoceto,dibujo:ImagenBoceto,ids:{espacio:string;dibujo:string},
  key:string,modelo:string,pedir:typeof fetch=fetch
):Promise<{ok:boolean;interpretacion?:InterpretacionBoceto;error?:string;estado?:number}> {
  const prompt=PROMPT_INTERPRETACION;
  let respuesta:Response;
  try {
    respuesta=await pedir(URL_GEMINI+'/'+encodeURIComponent(modelo)+':generateContent',{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},{inlineData:{mimeType:espacio.mime,data:espacio.base64}},{inlineData:{mimeType:dibujo.mime,data:dibujo.base64}}]}],generationConfig:{responseMimeType:'application/json',responseSchema:ESQUEMA_RESPUESTA,temperature:0.1}})
    });
  }catch{return {ok:false,estado:503,error:'No se pudo conectar con el modelo de interpretación'};}
  if(!respuesta.ok){
    const cuerpo=await respuesta.text().catch(()=>'');
    let detalle:string;try{detalle=String((JSON.parse(cuerpo) as {error?:{message?:string}}).error?.message||'');}catch{detalle=cuerpo.slice(0,160);}
    console.warn('[Studio] Gemini',respuesta.status,detalle);
    return {ok:false,estado:respuesta.status,error:explicarErrorInterpretacion(respuesta.status,detalle)};
  }
  try{
    const j=await respuesta.json() as {candidates?:{content?:{parts?:{text?:string}[]}}[]};
    const texto=j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    const interpretacion=normalizarInterpretacion(JSON.parse(texto),ids.espacio,ids.dibujo);
    return interpretacion?{ok:true,interpretacion}:{ok:false,estado:422,error:'La IA no ha reconocido ningún módulo en el dibujo. Pon tú las medidas o prueba con una foto más clara del boceto.'};
  }catch{return {ok:false,estado:422,error:'La respuesta de la IA no se ha podido leer. Vuelve a intentarlo o pon tú las medidas.'};}
}
