import type { ArticuloCatalogo, VarianteCatalogo } from '../data/tipos.ts';
import type { DespieceStudio } from './despiece-studio.ts';

export interface LineaValoracionStudio {
 piezaId:string;referencia:string;cantidad:number;superficieM2:number;
 costeBase:number;mermaPorcentaje:number;costeConMerma:number;precioSinIva:number;
}
export interface ValoracionStudio {lineas:LineaValoracionStudio[];bloqueos:string[];subtotalSinIva:number|null;listaParaPresupuesto:boolean}

/** Estimación limitada a artículos comercializados por m². No añade IVA, mano de obra ni herrajes. */
export function valorarDespiece(
 despiece:DespieceStudio,articulos:ArticuloCatalogo[],variantes:VarianteCatalogo[]
):ValoracionStudio {
 const bloqueos=[...despiece.bloqueos],lineas:LineaValoracionStudio[]=[];
 const aPorId=new Map(articulos.map(a=>[a.id,a]));
 const vPorId=new Map(variantes.map(v=>[v.id,v]));
 for(const p of despiece.partidas){
  const v=vPorId.get(p.varianteId),a=v?aPorId.get(v.articuloId):undefined;
  if(!v||!a||a.archivado||v.estado!=='activo'){bloqueos.push('Pieza '+p.piezaId+': referencia no disponible');continue;}
  if(p.metrosCuadrados===null||!Number.isFinite(p.metrosCuadrados)||p.metrosCuadrados<=0){
   bloqueos.push('Pieza '+p.piezaId+': superficie no confirmada');continue;
  }
  if(a.unidad!=='m²'||v.unidadPresupuesto!=='m²'||v.unidadConsumo!=='m²'){
   bloqueos.push('Pieza '+p.piezaId+': conversión de unidades no verificada');continue;
  }
  if(v.disponibilidad==='sin-stock'){bloqueos.push('Pieza '+p.piezaId+': sin stock');continue;}
  if(v.disponibilidad==='desconocida'||v.disponibilidad==='bajo-pedido')bloqueos.push('Pieza '+p.piezaId+': confirmar disponibilidad y plazo');
  if(!Number.isFinite(a.coste)||a.coste<=0||!Number.isFinite(a.merma)||a.merma<0||a.merma>100||
     !Number.isFinite(a.margen)||a.margen<0||a.margen>1000||
     (a.precioFijo!==null&&(!Number.isFinite(a.precioFijo)||a.precioFijo<=0))){
   bloqueos.push('Pieza '+p.piezaId+': coste, merma o margen sin validar');continue;
  }
  const costeBase=p.metrosCuadrados*a.coste;
  const costeConMerma=costeBase*(1+a.merma/100);
  // Precio fijo es precio de venta por unidad, no coste: no añadir merma ni margen dos veces.
  const precioSinIva=a.precioFijo!==null
    ?p.metrosCuadrados*a.precioFijo
    :costeConMerma*(1+a.margen/100);
  lineas.push({piezaId:p.piezaId,referencia:v.referencia||a.referencia,cantidad:p.cantidad,
   superficieM2:p.metrosCuadrados,costeBase,mermaPorcentaje:a.merma,costeConMerma,precioSinIva});
 }
 // El desglose es orientativo: faltan cantos, herrajes, mecanizados, mano de obra y compras por paquete.
 bloqueos.push('Faltan cantos, herrajes, mecanizados, mano de obra y reglas de compra por paquete');
 return {lineas,bloqueos,subtotalSinIva:lineas.length?lineas.reduce((s,l)=>s+l.precioSinIva,0):null,listaParaPresupuesto:false};
}
