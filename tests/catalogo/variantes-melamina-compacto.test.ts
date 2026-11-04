import {expect,it} from 'vitest';
import {extraerVariantesTablero} from '../../src/panel-nuevo/filas-pdf';

const token=(str:string,x:number,y:number,width=14)=>({str,width,transform:[1,0,0,1,x,y]});

it('mapea códigos y acabados en melamina diseño: solo celdas marcadas',()=>{
 const xs=[203.5,222.1,242.3,262.1,281.8,301.6,321.5,340.8,360.6,380.2,400.4,419.6,440.4,460.4,480.2,499.3];
 const thick=[8,10,12,15,16,18,19,22,25,30,35,40,10,16,19,30];
 const tokens=[
  token('MELAMINA DISEÑO SOBRE AGLOMERADO',70,780,230),
  token('FORMATO (mm)',102,755,70),token('2800x2070',296,755,60),token('2440x1220',456,755,60),
  token('ESPESOR (mm)',103,743,70),...thick.map((n,i)=>token(String(n),xs[i],743)),
  token('B3002',89,731,20),token('MA',112,731,10),token('Special White',124,731,73),
  ...[0,1,4,6,7,8,9,10,11,12,13,14,15].map(i=>token('x',xs[i],731,7)),
 ];
 const fichas=extraerVariantesTablero(tokens,12);
 expect(fichas).toHaveLength(13);
 expect(fichas).toEqual(expect.arrayContaining([
  expect.objectContaining({referencia:'B3002',codigoDecor:'B3002',acabado:'MA',soporte:'AGLOMERADO MELAMINA',formato:'2800 x 2070 mm',espesorMm:8}),
  expect.objectContaining({formato:'2440 x 1220 mm',espesorMm:16}),
 ]));
 expect(fichas.some(f=>f.formato==='2800 x 2070 mm'&&f.espesorMm===12)).toBe(false);
});

it('mapea núcleo y acabado de compacto especial cocina y baño',()=>{
 const tokens=[
  token('COMPACTO - ESPECIAL COCINAS Y BAÑOS',62,810,250),
  ...[['DISEÑO',100],['ACABADO',260],['NÚCLEO',330],['FORMATO',400],['ESPESOR',486]].map(([s,x])=>token(String(s),Number(x),785,45)),
  token('2409',100,770),token('Frost White',166,770,65),token('MM',265,770),token('Ice',334,770),token('4200x1310',400,770,55),token('12',488,770),
  token('0180',100,756),token('Monument Oak',166,756,70),token('AR',265,756),token('Safari',334,756),token('4200x1310',400,756,55),token('12',488,756),
 ];
 const fichas=extraerVariantesTablero(tokens,21);
 expect(fichas).toHaveLength(2);
 expect(fichas[0]).toMatchObject({referencia:'2409',codigoDecor:'2409',acabado:'MM',soporte:'COMPACTO · Núcleo Ice',espesorMm:12,formato:'4200 x 1310 mm'});
 expect(fichas[1]).toMatchObject({referencia:'0180',acabado:'AR',soporte:'COMPACTO · Núcleo Safari'});
});
