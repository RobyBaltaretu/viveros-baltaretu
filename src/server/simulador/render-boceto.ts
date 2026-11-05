import type { InterpretacionBoceto, ModuloBoceto, TipoPieza } from './boceto.ts';
import { calcularPlano } from './geometria-boceto.ts';
export function instruccionesRender(b:InterpretacionBoceto){
  if(b.estado!=='validada')throw Error('Boceto no validado');
  const plano=calcularPlano(b);
  const modulos=b.modulos.slice().sort((a,z)=>a.orden-z.orden).map(m=>({
    id:m.id,tipo:m.tipo,ancho:m.ancho.valorMm,alto:m.alto.valorMm,fondo:m.fondo.valorMm,contenido:m.contenido,
    piezas:m.piezas.map(p=>({tipo:p.tipo,referencia:p.catalogoVarianteId,acabado:p.acabadoId}))
  }));
  return {plano,modulos,obstaculos:b.obstaculos.filter(x=>x.conservar).map(x=>x.descripcion),
    reglas:['La primera foto es el espacio real; la segunda es el boceto fuente de verdad',
      'Mantener encuadre, iluminación y elementos ajenos a la obra',
      'No añadir ni quitar módulos, puertas ni electrodomésticos',
      'Respetar materiales por pieza; no inventar cotas desconocidas',
      'El resultado es visual y no es un plano de fabricación']};
}

/** Material elegido para una pieza, tal como se describe al modelo de imagen. */
export interface MaterialRender {
  nombre:string;referencia?:string;acabado?:string;colorHex?:string|null;
  brillo?:string|null;veta?:string|null;
  /** Número de la imagen de muestra adjunta (3, 4…), si la hay. */
  muestra?:number|null;
}
type Parte='carcass'|'fronts'|'countertop'|'edges'|'other';
const PARTE:Record<TipoPieza,Parte>={costado:'carcass',interior:'carcass',balda:'carcass',trasera:'carcass',
  puerta:'fronts',cajon:'fronts',encimera:'countertop',canto:'edges',otra:'other'};
const NOMBRE_PARTE:Record<Parte,string>={carcass:'carcass / sides / shelves',fronts:'doors and drawer fronts',
  countertop:'countertop',edges:'edge banding',other:'other parts'};
const TIPO_EN:Record<ModuloBoceto['tipo'],string>={armario:'cabinet','cajonera':'drawer unit',balda:'shelf',
  'hueco-electrodomestico':'appliance housing',encimera:'countertop unit',panel:'panel',otro:'unit'};
const cm=(mm:number|null)=>mm===null?'unknown':String(Math.round(mm)/10).replace(/\.0$/,'')+' cm';

function describirMaterial(m:MaterialRender){
  const partes=[m.nombre,m.referencia&&'ref. '+m.referencia,m.acabado&&'finish: '+m.acabado,
    m.brillo&&m.brillo+' sheen',m.colorHex&&'colour '+m.colorHex,m.veta&&m.veta!=='sin-veta'&&m.veta+' grain',
    m.muestra?'see swatch image '+m.muestra:''].filter(Boolean);
  return partes.join(', ');
}

/** Instrucciones (en inglés, las sigue mejor el modelo de imagen) a partir del diseño validado.
 * Imagen 1: foto del espacio (se edita). Imagen 2: boceto. Imágenes 3…: muestras de material. */
export function promptRender(b:InterpretacionBoceto,materiales:Map<string,MaterialRender>):string{
  if(b.estado!=='validada')throw Error('Boceto no validado');
  const modulos=b.modulos.slice().sort((a,z)=>a.orden-z.orden);
  const total=modulos.reduce((s,m)=>s+(m.ancho.valorMm??0),0);
  const conservar=b.obstaculos.filter(o=>o.conservar).map(o=>o.descripcion);
  const usados=new Map<Parte,Set<string>>();
  const lineasModulo=modulos.map((m,i)=>{
    const ancho=m.ancho.valorMm;
    const pct=ancho&&total?' ('+Math.round(ancho/total*100)+'% of the total run)':'';
    const porParte=new Map<Parte,Set<string>>();
    for(const p of m.piezas){
      const mat=p.catalogoVarianteId?materiales.get(p.catalogoVarianteId):undefined;if(!mat)continue;
      const parte=PARTE[p.tipo];
      (porParte.get(parte)??porParte.set(parte,new Set()).get(parte)!).add(mat.nombre);
      (usados.get(parte)??usados.set(parte,new Set()).get(parte)!).add(p.catalogoVarianteId!);
    }
    const mats=[...porParte].map(([parte,n])=>NOMBRE_PARTE[parte]+' in '+[...n].join(' / ')).join('; ');
    return (i+1)+'. '+TIPO_EN[m.tipo]+': width '+cm(ancho)+pct+', height '+cm(m.alto.valorMm)+', depth '+cm(m.fondo.valorMm)+'.'
      +(m.contenido?' Contains: '+m.contenido+'.':'')
      +(m.notas?' Note: '+m.notas+'.':'')
      +(mats?' Materials: '+mats+'.':'');
  });
  const lineasMaterial=[...usados].map(([parte,ids])=>'- '+NOMBRE_PARTE[parte]+': '
    +[...ids].map(id=>describirMaterial(materiales.get(id)!)).join(' | '));
  const muestras=[...new Set([...materiales.values()].map(m=>m.muestra).filter((n):n is number=>!!n))];
  return [
    'Edit the FIRST image (a real photo of the room) to show the custom carpentry installed in it, as a photorealistic photo. Do not create a new scene.',
    'Keep exactly the same camera position, framing, perspective, lens, lighting, walls, floor, ceiling, windows and installations of the first image. Same aspect ratio.',
    'Lines, arrows, numbers or sketches drawn on the first photo with a marker (usually red) are the carpenter\'s placement guide: build the furniture exactly where they are drawn and remove every marker line and annotation from the final image.',
    'The SECOND image is the carpenter\'s hand-drawn sketch with measurements: it is the source of truth for the layout.',
    muestras.length?'Images '+muestras.join(', ')+' are material swatches: reproduce their colour and texture faithfully on the parts listed below.':'',
    '',
    'Furniture, from LEFT to RIGHT'+(total?' (total run '+cm(total)+')':'')+':',
    ...lineasModulo,
    '',
    lineasMaterial.length?'Materials:\n'+lineasMaterial.join('\n'):'',
    conservar.length?'Keep unchanged and visible, in the same place: '+conservar.join('; ')+'.':'',
    'Keep everything that is not part of this furniture exactly as it is in the first photo.',
    'Respect the proportions: each unit takes its share of the total width shown above, at its real height and depth relative to the room.',
    'Do NOT add units, shelves, upper cabinets, doors, drawers, handles, appliances or decoration that are not listed. Do not remove existing pillars, pipes, water heaters or windows.',
    'Realistic materials and joinery, clean straight edges, natural shadows consistent with the room light. No text, labels or watermarks.',
  ].join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

/** Proporciones que admite Gemini para imágenes. */
export const PROPORCIONES=['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'] as const;
/** Ancho y alto de una imagen JPEG, PNG o WebP leyendo su cabecera; null si no se reconoce. */
export function dimensionesImagen(b:Uint8Array):{ancho:number;alto:number}|null{
  const u16=(i:number)=>(b[i]!<<8)|b[i+1]!,le16=(i:number)=>b[i]!|(b[i+1]!<<8);
  if(b.length>24&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47)
    return {ancho:(u16(16)<<16)|u16(18),alto:(u16(20)<<16)|u16(22)};
  if(b.length>4&&b[0]===0xff&&b[1]===0xd8){
    let i=2;
    while(i+9<b.length){
      if(b[i]!==0xff){i++;continue;}
      const marca=b[i+1]!;
      if(marca===0xd8||marca===0x01||(marca>=0xd0&&marca<=0xd7)){i+=2;continue;}
      if(marca>=0xc0&&marca<=0xcf&&![0xc4,0xc8,0xcc].includes(marca))return {alto:u16(i+5),ancho:u16(i+7)};
      i+=2+u16(i+2);
    }
    return null;
  }
  if(b.length>30&&String.fromCharCode(...b.subarray(0,4))==='RIFF'&&String.fromCharCode(...b.subarray(8,12))==='WEBP'){
    const tipo=String.fromCharCode(...b.subarray(12,16));
    if(tipo==='VP8 ')return {ancho:le16(26)&0x3fff,alto:le16(28)&0x3fff};
    if(tipo==='VP8L'){const x=b[21]!|(b[22]!<<8)|(b[23]!<<16)|(b[24]!<<24);return {ancho:(x&0x3fff)+1,alto:((x>>>14)&0x3fff)+1};}
    if(tipo==='VP8X')return {ancho:1+(b[24]!|(b[25]!<<8)|(b[26]!<<16)),alto:1+(b[27]!|(b[28]!<<8)|(b[29]!<<16))};
  }
  return null;
}
/** La proporción admitida más cercana a la de la foto, para que el encuadre no cambie. */
export function proporcionImagen(bytes:Uint8Array):(typeof PROPORCIONES)[number]|null{
  const d=dimensionesImagen(bytes);if(!d||!d.ancho||!d.alto)return null;
  const r=Math.log(d.ancho/d.alto);
  return PROPORCIONES.reduce((mejor,p)=>{
    const [a,h]=p.split(':').map(Number) as [number,number],[ma,mh]=mejor.split(':').map(Number) as [number,number];
    return Math.abs(Math.log(a/h)-r)<Math.abs(Math.log(ma/mh)-r)?p:mejor;
  });
}
