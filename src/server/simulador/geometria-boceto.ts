import type { InterpretacionBoceto, ModuloBoceto } from './boceto.ts';
export interface RectanguloModulo { id:string; tipo:ModuloBoceto['tipo']; x:number; y:number; ancho:number; alto:number; provisional:boolean; etiqueta:string }
export interface PlanoBoceto { ancho:number; alto:number; modulos:RectanguloModulo[]; advertencias:string[]; escalaMmPorUnidad:number|null }
const seguro=(n:number)=>Number.isFinite(n)&&n>0?n:0;
export function calcularPlano(b:InterpretacionBoceto):PlanoBoceto {
  const ordenados=[...b.modulos].sort((a,z)=>a.orden-z.orden);
  const advertencias:string[]=[];
  const anchos=ordenados.map(m=>seguro(m.ancho.valorMm??0));
  const conocidos=anchos.filter(Boolean);
  const sustituto=conocidos.length?conocidos.reduce((a,z)=>a+z,0)/conocidos.length:600;
  const pesos=anchos.map((w,i)=>{if(w)return w;advertencias.push('Anchura desconocida: '+ordenados[i].id);return sustituto;});
  const alturas=ordenados.map(m=>seguro(m.alto.valorMm??0));
  const alturasConocidas=alturas.filter(Boolean);
  const alturaReferencia=alturasConocidas.length?Math.max(...alturasConocidas):2100;
  const anchoTotal=pesos.reduce((a,z)=>a+z,0)||1;
  const escala=920/anchoTotal;
  let x=40;
  const modulos=ordenados.map((m,i)=>{
    const ancho=pesos[i]*escala,alto=(alturas[i]||alturaReferencia)*escala;
    const provisional=!m.ancho.confirmada||!m.alto.confirmada||!m.fondo.confirmada;
    if(!alturas[i])advertencias.push('Altura desconocida: '+m.id);
    if(m.fondo.valorMm===null)advertencias.push('Profundidad desconocida: '+m.id);
    const rect={id:m.id,tipo:m.tipo,x,y:40+alturaReferencia*escala-alto,ancho,alto,provisional,
      etiqueta:m.tipo+' · '+(m.ancho.valorMm??'?')+' × '+(m.alto.valorMm??'?')+' mm'};
    x+=ancho;return rect;
  });
  return {ancho:1000,alto:Math.max(300,80+alturaReferencia*escala),modulos,advertencias,
    escalaMmPorUnidad:conocidos.length?1/escala:null};
}
export function svgPlano(plano:PlanoBoceto):string {
  const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const formas=plano.modulos.map(m=>{
    const lineas=m.provisional?'stroke-dasharray="7 5"':'';
    return '<g><rect x="'+m.x.toFixed(2)+'" y="'+m.y.toFixed(2)+'" width="'+m.ancho.toFixed(2)+'" height="'+m.alto.toFixed(2)+'" fill="#e8e0d4" stroke="#665747" stroke-width="2" '+lineas+'/>'+
      '<text x="'+(m.x+6).toFixed(2)+'" y="'+(m.y+20).toFixed(2)+'" font-size="12" fill="#3d352e">'+esc(m.tipo)+'</text>'+
      '<text x="'+(m.x+6).toFixed(2)+'" y="'+(m.y+36).toFixed(2)+'" font-size="10" fill="#3d352e">'+esc(m.etiqueta.split(' · ')[1]||'')+'</text></g>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Alzado frontal provisional del boceto" viewBox="0 0 '+plano.ancho+' '+plano.alto.toFixed(2)+'">'+formas+'</svg>';
}
