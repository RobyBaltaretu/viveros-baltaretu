/* eslint-disable @typescript-eslint/no-explicit-any -- datos de prueba a propósito incompletos o inválidos */
import { describe,it,expect } from 'vitest';
import { validarInterpretacion } from '../../src/server/simulador/boceto.ts';
describe('Studio: validation against malformed piece cuts',()=>{
 const c={valorMm:500,precision:'exacta',origen:'medicion',confirmada:true};
 const sketch=()=>({version:1,estado:'requiere-revision',categoria:'armario',fotoEspacioId:'a',fotoBocetoId:'b',
  obstaculos:[],preguntas:[],modulos:[{id:'m',tipo:'armario',orden:0,ancho:c,alto:c,fondo:c,
   piezas:[{id:'p',tipo:'puerta',catalogoVarianteId:'v',acabadoId:'v',corte:{ancho:c,alto:c,cantidad:2}}]}]});
 it('accepts measured pieces',()=>expect(validarInterpretacion(sketch() as any)).toEqual([]));
 it('rejects invalid quantity',()=>{
  const s=sketch();s.modulos[0].piezas[0].corte.cantidad=0;
  expect(validarInterpretacion(s as any).join(' ')).toContain('Cantidad de corte inválida');
 });
 it('rejects malformed piece object',()=>{
  const s=sketch() as any;s.modulos[0].piezas=[null];
  expect(validarInterpretacion(s).join(' ')).toContain('Pieza inválida');
 });
});
