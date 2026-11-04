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
 });
});
