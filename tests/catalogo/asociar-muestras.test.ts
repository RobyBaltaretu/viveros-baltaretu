import { describe, it, expect } from 'vitest';
import { asociarMuestraMaterial } from '../../src/panel-nuevo/asociar-muestras';
import type { MuestraPDF } from '../../src/panel-nuevo/muestras-pdf';

const textura=(codigo:string,acabado:string,pagina:number,colorHex:string):MuestraPDF=>({
  codigo,acabado,pagina,colorHex,muestra:'data:image/webp;base64,UklGRg=='
});

describe('Regresión real de Turia: B3002 MA/SC sin color',()=>{
  const muestras=[
    textura('B3002','MA',13,'#eceae5'),
    textura('B3002','SC',13,'#eae8e2'),
    textura('B3002','WRP',13,'#eeeae5'),
    textura('B4402','SMA',13,'#ffffff'),
    textura('B3002','MA',40,'#654321'),
  ];
  it('asocia una ficha de la página 10 con la carta de la página 13',()=>{
    expect(asociarMuestraMaterial({
      codigoDecor:'B3002',referencia:'B3002',acabado:'MA/SC',pagina:10,
    },muestras)).toMatchObject({codigo:'B3002',acabado:'MA',pagina:13,colorHex:'#eceae5'});
  });
  it('distingue SC y WRP cuando los productos los especifican',()=>{
    expect(asociarMuestraMaterial({codigoDecor:'B3002',acabado:'SC',pagina:10},muestras)?.colorHex).toBe('#eae8e2');
    expect(asociarMuestraMaterial({codigoDecor:'B3002',acabado:'WRP',pagina:10},muestras)?.colorHex).toBe('#eeeae5');
  });
  it('no cruza referencias ni acepta muestras de otra sección distante',()=>{
    expect(asociarMuestraMaterial({codigoDecor:'B3002',acabado:'SMA',pagina:10},muestras)).toBeNull();
    expect(asociarMuestraMaterial({codigoDecor:'B4402',acabado:'MA',pagina:10},muestras)).toBeNull();
    expect(asociarMuestraMaterial({codigoDecor:'B3002',acabado:'MA',pagina:60},muestras)).toBeNull();
  });
  it('no adivina el acabado cuando varias texturas comparten código',()=>{
    expect(asociarMuestraMaterial({codigoDecor:'B3002',acabado:'',pagina:10},muestras)).toBeNull();
  });
  it('admite códigos de 3 dígitos y conserva 4 dígitos',()=>{
    const carta=[textura('0164','MA',13,'#cccccc')];
    expect(asociarMuestraMaterial({referencia:'164',acabado:'MA',pagina:10},carta)?.codigo).toBe('0164');
  });
});
