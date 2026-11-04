import { URL_GEMINI } from '../../services/renovationAiService.ts';
import { validarInterpretacion, type InterpretacionBoceto, type CotaBoceto } from './boceto.ts';
export type ImagenBoceto = { mime: string; base64: string };
const desconocida = (): CotaBoceto => ({valorMm:null,precision:'desconocida',origen:'boceto',confirmada:false});
function cota(v:unknown):CotaBoceto {
  if(!v||typeof v!=='object')return desconocida();
  const x=v as Record<string,unknown>;
  if(typeof x.valorMm!=='number'||!Number.isFinite(x.valorMm)||x.valorMm<=0||x.valorMm>100000)return desconocida();
  return {valorMm:x.valorMm,precision:'aproximada',origen:'boceto',confirmada:false};
}
export function normalizarInterpretacion(raw:unknown,espacio:string,dibujo:string):InterpretacionBoceto|null {
  if(!raw||typeof raw!=='object')return null;
  const v=raw as Record<string,unknown>;
  if(!Array.isArray(v.modulos)||v.modulos.length<1||v.modulos.length>30)return null;
  const modulos=v.modulos.map((m,i)=>{
    const x=m&&typeof m==='object'?m as Record<string,unknown>:{};
    const tipos=['armario','cajonera','balda','hueco-electrodomestico','encimera','panel','otro'] as const;
    const tipo=tipos.find(t=>t===x.tipo)||'otro';
    const piezas=Array.isArray(x.piezas)?x.piezas.slice(0,60).map((p,j)=>({
      id:'pieza-'+i+'-'+j,tipo:'otra' as const,catalogoVarianteId:null,acabadoId:null,
      notas:typeof p==='string'?p.slice(0,100):''
    })):[];
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
      body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},{inlineData:{mimeType:espacio.mime,data:espacio.base64}},{inlineData:{mimeType:dibujo.mime,data:dibujo.base64}}]}],generationConfig:{responseMimeType:'application/json',temperature:0.1}})
    });
  }catch{return {ok:false,estado:503,error:'No se pudo conectar con el modelo de interpretación'};}
  if(!respuesta.ok)return {ok:false,estado:respuesta.status,error:'Error del proveedor de interpretación'};
  try{
    const j=await respuesta.json() as {candidates?:{content?:{parts?:{text?:string}[]}}[]};
    const texto=j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    const interpretacion=normalizarInterpretacion(JSON.parse(texto),ids.espacio,ids.dibujo);
    return interpretacion?{ok:true,interpretacion}:{ok:false,estado:422,error:'La interpretación requiere revisión manual'};
  }catch{return {ok:false,estado:422,error:'Respuesta de interpretación inválida'};}
}
