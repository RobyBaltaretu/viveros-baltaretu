import type { InterpretacionBoceto } from './boceto.ts';
export interface PartidaStudio {
 moduloId:string;piezaId:string;tipo:string;varianteId:string;
 anchoMm:number|null;altoMm:number|null;fondoMm:number|null;
 cantidad:number;metrosCuadrados:number|null;requiereMedicion:boolean;
}
export interface DespieceStudio {partidas:PartidaStudio[];bloqueos:string[];despieceCompleto:boolean;presupuestable:boolean}
/**
 * Prepara partidas para revisión, nunca calcula cortes ni costes desde una imagen.
 * Una pieza no tiene dimensiones propias en el esquema v1; por ello NO se le
 * asigna automáticamente el área del módulo ni se inventan cantidades.
 */
export function prepararDespiece(b:InterpretacionBoceto):DespieceStudio {
 const bloqueos:string[]=[],partidas:PartidaStudio[]=[];
 if(b.estado!=='validada'||!b.confirmadaPor)bloqueos.push('Confirma el diseño antes de presupuestar');
 for(const m of b.modulos){
  const cotas=[m.ancho,m.alto,m.fondo];
  if(cotas.some(c=>c.valorMm===null||!c.confirmada||c.precision!=='exacta'))
    bloqueos.push('Módulo '+m.id+': cotas incompletas o no exactas');
  for(const p of m.piezas){
   if(!p.catalogoVarianteId)bloqueos.push('Pieza '+p.id+': falta material');
   const corte=p.corte;
   const medidaValida=(c:typeof m.ancho|undefined)=>!!c&&c.precision==='exacta'&&c.confirmada&&c.valorMm!==null&&Number.isFinite(c.valorMm)&&c.valorMm>0;
   const medidas=medidaValida(corte?.ancho)&&medidaValida(corte?.alto);
   if(!medidas)bloqueos.push('Pieza '+p.id+': faltan medidas exactas y confirmadas de corte');
   if(!corte||!Number.isSafeInteger(corte.cantidad)||corte.cantidad<1)bloqueos.push('Pieza '+p.id+': cantidad no confirmada');
   const ancho=medidas?corte!.ancho.valorMm:null,alto=medidas?corte!.alto.valorMm:null;
   const cantidad=corte?.cantidad??0;
   partidas.push({moduloId:m.id,piezaId:p.id,tipo:p.tipo,varianteId:p.catalogoVarianteId||'',
    anchoMm:ancho,altoMm:alto,fondoMm:null,cantidad,
    metrosCuadrados:medidas&&cantidad>0?(ancho!*alto!*cantidad)/1_000_000:null,requiereMedicion:!medidas});
  }
 }
 const despieceCompleto=bloqueos.length===0&&partidas.length>0;
 return {partidas,bloqueos,despieceCompleto,presupuestable:false}; // pendiente de costes, mermas y unidades comerciales
}
