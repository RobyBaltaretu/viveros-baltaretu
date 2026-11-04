import {describe,it,expect} from 'vitest';
import {prepararDespiece} from '../../src/server/simulador/despiece-studio.ts';
describe('Despiece Studio',()=>{
 it('no calcula metros cuadrados ni presupuesto sin medidas de pieza',()=>{
  const c={valorMm:600,precision:'exacta',origen:'medicion',confirmada:true};
  const b={estado:'validada',confirmadaPor:'operario',modulos:[{id:'m1',ancho:c,alto:c,fondo:c,piezas:[{id:'p1',tipo:'puerta',catalogoVarianteId:'v1'}]}]};
  const r=prepararDespiece(b as any);
  expect(r.partidas[0].metrosCuadrados).toBeNull();
  expect(r.partidas[0].requiereMedicion).toBe(true);
  expect(r.presupuestable).toBe(false);
  it('calcula área solo con cortes confirmados',()=>{
  const exacta={valorMm:500,precision:'exacta',origen:'medicion',confirmada:true};
  const b={estado:'validada',confirmadaPor:'operario',modulos:[{
   id:'m1',ancho:exacta,alto:exacta,fondo:exacta,piezas:[{
    id:'p1',tipo:'puerta',catalogoVarianteId:'v1',corte:{ancho:exacta,alto:{...exacta,valorMm:800},cantidad:2}
   }]
  }]};
  const r=prepararDespiece(b as any);
  expect(r.presupuestable).toBe(true);
  expect(r.partidas[0].metrosCuadrados).toBe(0.8);
 });
});
});
