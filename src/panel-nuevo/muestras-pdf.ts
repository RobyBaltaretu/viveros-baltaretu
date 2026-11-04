/**
 * Cartas de colores con muestras encima de la referencia (melamina, HPL,
 * compacto). Los rectángulos se localizan desde las coordenadas de PDF.js,
 * no desde números fijos de página o imágenes genéricas de internet.
 */
export type TokenPDF = {str:string;transform:number[];width?:number};
export type PosicionMuestra = {codigo:string;x:number;y:number};
export type MuestraPDF = {codigo:string;pagina:number;colorHex:string;muestra:string};
const codigoValido=/^(?:[A-Z]\d{3,5}|\d{3,4})$/;

export const normalizarCodigoMuestra=(s:string):string=>{
  const t=s.trim().toUpperCase();
  return /^\d{3}$/.test(t)?t.padStart(4,'0'):t;
};

/** Exige 3 referencias alineadas, y texto descriptivo bajo cada una. Evita tablas de medidas. */
export function detectarPosicionesMuestras(items:TokenPDF[]):PosicionMuestra[] {
  const tokens=items.filter(t=>t.str?.trim() && Array.isArray(t.transform))
    .map(t=>({s:t.str.trim(),x:t.transform[4],y:t.transform[5],w:t.width||0}));
  const candidatos=tokens.filter(t=>codigoValido.test(t.s)&&t.x>=45&&t.x<=550&&t.y>60);
  const grupos=new Map<number,typeof candidatos>();
  for(const t of candidatos){
    const k=Math.round(t.y/3);
    const a=grupos.get(k)||[];a.push(t);grupos.set(k,a);
  }
  const resultado:PosicionMuestra[]=[];
  for(const grupo of grupos.values()){
    const ordenado=[...grupo].sort((a,b)=>a.x-b.x);
    if(ordenado.length<3)continue;
    const columnas=ordenado.filter((t,i)=>i===0||t.x-ordenado[i-1].x>42);
    if(columnas.length<3)continue;
    const etiquetas=columnas.map(c=>{
      const palabras=tokens.filter(n=>/[\p{L}]{3,}/u.test(n.s)&&(
        (n.y<c.y-4&&n.y>c.y-23&&Math.abs((n.x+n.w/2)-(c.x+c.w/2))<55)||
        (Math.abs(n.y-c.y)<3&&n.x>c.x+c.w&&n.x<c.x+75)
      ));
      if(!palabras.length)return null;
      const minimo=Math.min(c.x,...palabras.map(n=>n.x));
      const maximo=Math.max(c.x+c.w,...palabras.map(n=>n.x+n.w));
      return {codigo:normalizarCodigoMuestra(c.s),x:(minimo+maximo)/2,y:c.y};
    }).filter((v):v is PosicionMuestra=>v!==null);
    if(etiquetas.length<3)continue;
    for(const t of etiquetas){
      if(resultado.some(p=>p.codigo===t.codigo))continue;
      resultado.push(t);
    }
  }
  return resultado.slice(0,100);
}

/**
 * Calcula la media central del recorte. Es color digital orientativo, nunca
 * el colorimétrico oficial del fabricante. Se conserva también la textura WebP.
 */
export function construirMuestra(
  ctx:CanvasRenderingContext2D, punto:PosicionMuestra, escala:number,
  altoPagina:number, pagina:number,
):MuestraPDF|null {
  const ancho=68,alto=28;
  const sx=Math.round((punto.x-ancho/2)*escala);
  const sy=Math.round((altoPagina-punto.y-43)*escala);
  const sw=Math.round(ancho*escala),sh=Math.round(alto*escala);
  if(sx<0||sy<0||sx+sw>ctx.canvas.width||sy+sh>ctx.canvas.height)return null;
  const muestra=document.createElement('canvas');
  muestra.width=96;muestra.height=48;
  const destino=muestra.getContext('2d',{willReadFrequently:true});
  if(!destino)return null;
  destino.drawImage(ctx.canvas,sx,sy,sw,sh,0,0,muestra.width,muestra.height);
  const {data,width,height}=destino.getImageData(0,0,muestra.width,muestra.height);
  const r:number[]=[],g:number[]=[],b:number[]=[];
  for(let y=8;y<height-8;y+=2)for(let x=12;x<width-12;x+=2){
    const i=(y*width+x)*4;
    r.push(data[i]);g.push(data[i+1]);b.push(data[i+2]);
  }
  if(!r.length)return null;
  const media=(a:number[])=>Math.round(a.reduce((s,v)=>s+v,0)/a.length);
  const toHex=(v:number)=>v.toString(16).padStart(2,'0');
  const colorHex='#'+toHex(media(r))+toHex(media(g))+toHex(media(b));
  const webp=muestra.toDataURL('image/webp',.62);
  muestra.width=0;muestra.height=0;
  if(!webp.startsWith('data:image/webp;base64,')||webp.length>35000)return null;
  return {codigo:punto.codigo,pagina,colorHex,muestra:webp};
}
