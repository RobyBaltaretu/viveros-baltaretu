import type { PiezaBoceto } from './boceto.ts';
import type { ArticuloCatalogo, VarianteCatalogo } from '../data/tipos.ts';
export function compatibilidadPieza(pieza:PiezaBoceto,articulo:ArticuloCatalogo,variante:VarianteCatalogo){
  const errores:string[]=[],avisos:string[]=[];
  if(articulo.archivado||variante.estado!=='activo')errores.push('Variante no activa');
  const categoria=(articulo.categoria+' '+articulo.nombre+' '+variante.soporte).toLowerCase();
  if(pieza.tipo==='canto'&&!categoria.includes('canto'))errores.push('El canto requiere material de canto');
  if(['puerta','costado','interior','balda','cajon','trasera'].includes(pieza.tipo)&&
    !['tabler','panel','madera','melamin','mdf','aglomerad','contrachap'].some(s=>categoria.includes(s)))
    errores.push('La pieza requiere un tablero o panel');
  if(variante.disponibilidad==='sin-stock')avisos.push('Sin stock');
  if(!(variante.dimensiones.espesorMm??articulo.espesor))avisos.push('Espesor por confirmar');
  return {compatible:errores.length===0,errores,avisos};
}
