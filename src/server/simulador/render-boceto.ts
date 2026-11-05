import type { InterpretacionBoceto } from './boceto.ts';
import { calcularPlano } from './geometria-boceto.ts';
export function instruccionesRender(b:InterpretacionBoceto){
  if(b.estado!=='validada')throw Error('Boceto no validado');
  const plano=calcularPlano(b);
  const modulos=b.modulos.slice().sort((a,z)=>a.orden-z.orden).map(m=>({
    id:m.id,tipo:m.tipo,ancho:m.ancho.valorMm,alto:m.alto.valorMm,fondo:m.fondo.valorMm,
    piezas:m.piezas.map(p=>({tipo:p.tipo,referencia:p.catalogoVarianteId,acabado:p.acabadoId}))
  }));
  return {plano,modulos,obstaculos:b.obstaculos.filter(x=>x.conservar).map(x=>x.descripcion),
    reglas:['La primera foto es el espacio real; la segunda es el boceto fuente de verdad',
      'Mantener encuadre, iluminación y elementos ajenos a la obra',
      'No añadir ni quitar módulos, puertas ni electrodomésticos',
      'Respetar materiales por pieza; no inventar cotas desconocidas',
      'El resultado es visual y no es un plano de fabricación']};
}
