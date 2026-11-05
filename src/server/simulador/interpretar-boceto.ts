import { URL_GEMINI } from '../../services/renovationAiService.ts';
import { validarInterpretacion, type InterpretacionBoceto, type CotaBoceto } from './boceto.ts';
export type ImagenBoceto = { mime: string; base64: string };
const desconocida = (): CotaBoceto => ({valorMm:null,precision:'desconocida',origen:'boceto',confirmada:false});
/** Cota leída del dibujo: siempre «aproximada» (la confirma la persona). Acepta un número o {valorMm}. */
function cota(v:unknown):CotaBoceto {
  const n=typeof v==='number'?v:v&&typeof v==='object'?(v as Record<string,unknown>).valorMm:null;
  if(typeof n!=='number'||!Number.isFinite(n)||n<=0||n>100000)return desconocida();
  return {valorMm:Math.round(n),precision:'aproximada',origen:'boceto',confirmada:false};
}

/** Modelo de Gemini para leer los bocetos (texto, barato). Se puede cambiar con GEMINI_MODELO_BOCETO. */
export const MODELO_INTERPRETACION='gemini-2.5-flash';

const TIPOS_MODULO=['armario','cajonera','balda','hueco-electrodomestico','encimera','panel','otro'];
const TIPOS_PIEZA=['puerta','costado','interior','balda','cajon','encimera','canto','trasera','otra'];
/** Forma exacta de la respuesta (salida estructurada de Gemini): así no hay que adivinar sus claves. */
export const ESQUEMA_RESPUESTA={
  type:'OBJECT',
  properties:{
    modulos:{type:'ARRAY',items:{type:'OBJECT',properties:{
      tipo:{type:'STRING',enum:TIPOS_MODULO},
      ancho:{type:'NUMBER',nullable:true,description:'Milímetros, solo si la cota está escrita en el dibujo'},
      alto:{type:'NUMBER',nullable:true,description:'Milímetros, solo si la cota está escrita en el dibujo'},
      fondo:{type:'NUMBER',nullable:true,description:'Milímetros, solo si la cota está escrita en el dibujo'},
      piezas:{type:'ARRAY',items:{type:'STRING',enum:TIPOS_PIEZA}},
      notas:{type:'STRING'},
    },required:['tipo','ancho','alto','fondo','piezas']}},
    obstaculos:{type:'ARRAY',items:{type:'STRING'}},
    preguntas:{type:'ARRAY',items:{type:'STRING'}},
  },
  required:['modulos','obstaculos','preguntas'],
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
  const modulos=lista.map((m:unknown,i:number)=>{
    const x=m&&typeof m==='object'?m as Record<string,unknown>:{};
    const tipo=(TIPOS_MODULO.find(t=>t===x.tipo)||'otro') as InterpretacionBoceto['modulos'][number]['tipo'];
    const tiposPieza=TIPOS_PIEZA;
    const piezas=Array.isArray(x.piezas)?x.piezas.slice(0,60).map((p,j)=>{
      const raw=typeof p==='string'?p:(p&&typeof p==='object'?(p as Record<string,unknown>).tipo:'');
      const tipo=(tiposPieza.find(t=>t===raw)||'otra') as InterpretacionBoceto['modulos'][number]['piezas'][number]['tipo'];
      return {id:'pieza-'+i+'-'+j,tipo,catalogoVarianteId:null,acabadoId:null};
    }):[];
    return {id:'modulo-'+i,tipo,orden:i,ancho:cota(x.ancho),alto:cota(x.alto),fondo:cota(x.fondo),piezas,
      notas:typeof x.notas==='string'?x.notas.slice(0,500):''};
  });
  const b:InterpretacionBoceto={version:1,estado:'requiere-revision',categoria:'mueble',modulos,
    obstaculos:Array.isArray(v.obstaculos)?v.obstaculos.slice(0,20).map((x,i)=>({id:'obstaculo-'+i,descripcion:String(x).slice(0,200),conservar:true})):[],
    preguntas:Array.isArray(v.preguntas)?v.preguntas.slice(0,12).map(x=>String(x).slice(0,200)):[],
    fotoEspacioId:espacio,fotoBocetoId:dibujo};
  return validarInterpretacion(b).length?null:b;
}
export async function interpretarBoceto(
  espacio:ImagenBoceto,dibujo:ImagenBoceto,ids:{espacio:string;dibujo:string},
  key:string,modelo:string,pedir:typeof fetch=fetch
):Promise<{ok:boolean;interpretacion?:InterpretacionBoceto;error?:string;estado?:number}> {
  const prompt='Analiza estas dos imágenes para un carpintero. Primera: espacio vacío, segunda: dibujo en papel. El dibujo manda en la distribución. Devuelve solo JSON con modulos (tipo, ancho, alto, fondo, piezas, notas), obstaculos y preguntas. Medidas solo en milímetros cuando la unidad esté explícita. Para cotas sin unidad inequívoca usa null. No inventes módulos, materiales ni medidas. Los módulos pueden ser armario, cajonera, balda, hueco-electrodomestico, encimera, panel u otro. Mantén los elementos existentes del espacio.';
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
