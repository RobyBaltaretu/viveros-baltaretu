import { describe,it,expect } from 'vitest';
import { calcularPlano,svgPlano } from '../../src/server/simulador/geometria-boceto.ts';
describe('alzado 2D',()=>{
  it('preserva el orden y advierte medidas desconocidas',()=>{
    const c=(n:number|null)=>({valorMm:n,precision:n===null?'desconocida':'exacta',origen:'usuario',confirmada:n!==null});
    const b={version:1,estado:'pendiente',categoria:'lavadero',fotoEspacioId:'a',fotoBocetoId:'b',obstaculos:[],preguntas:[],
      modulos:[{id:'derecha',tipo:'armario',orden:1,ancho:c(null),alto:c(2000),fondo:c(null),piezas:[]},
        {id:'izquierda',tipo:'armario',orden:0,ancho:c(800),alto:c(2000),fondo:c(600),piezas:[]}]};
    const plano=calcularPlano(b as never);
    expect(plano.modulos.map(x=>x.id)).toEqual(['izquierda','derecha']);
    expect(plano.advertencias.some(x=>x.includes('Anchura desconocida'))).toBe(true);
    expect(svgPlano(plano)).toContain('stroke-dasharray');
  });
});
