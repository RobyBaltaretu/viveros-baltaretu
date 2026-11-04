import type { InterpretacionBoceto } from './boceto.ts';
export interface PartidaStudio {
 moduloId:string;piezaId:string;tipo:string;varianteId:string;
 anchoMm:number|null;altoMm:number|null;fondoMm:number|null;
 cantidad:number;metrosCuadrados:number|null;requiereMedicion:boolean;
}
export interface DespieceStudio {partidas:PartidaStudio[];bloqueos:string[];presupuestable:boolean}
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
   bloqueos.push('Pieza '+p.id+': falta despiece y medidas de corte por pieza');
   partidas.push({moduloId:m.id,piezaId:p.id,tipo:p.tipo,varianteId:p.catalogoVarianteId||'',
    anchoMm:null,altoMm:null,fondoMm:null,cantidad:1,metrosCuadrados:null,requiereMedicion:true});
  }
 }
 return {partidas,bloqueos,presupuestable:false};
}
