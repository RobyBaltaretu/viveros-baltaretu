import {expect,it} from 'vitest';
import {detectarPosicionesMuestras,normalizarCodigoMuestra} from '../../src/panel-nuevo/muestras-pdf';

const t=(str:string,x:number,y:number,width=14)=>({str,width,transform:[1,0,0,1,x,y]});

it('detecta cinco muestras de melamina por código y acabado en la misma fila del PDF',()=>{
  const pagina=[
    t('B3002',63.6,706.5,18.6),t('MA',83.7,706.5,9.7),t('Special',94.9,706.5,20.7),t('White',117.2,706.5,17.7),
    t('B3002',162.7,706.5,18.6),t('SC',182.8,706.5,8),t('Special',192,706.5,21),t('White',214.4,706.5,17.7),
    t('B3002',261.2,706.5,18.6),t('WRP',281,706.5,14),t('Special',297,706.5,20),t('White',319,706.5,17),
    t('B4402',360.2,706.5,18),t('SMA',380,706.5,14),t('Pure',395,706.5,19),t('White',417,706.5,18),
    t('0112',465,706.5,16),t('PE',483,706.5,9),t('Stone',494,706.5,20),t('Grey',515,706.5,17),
  ];
  const muestras=detectarPosicionesMuestras(pagina);
  expect(muestras).toHaveLength(5);
  expect(muestras.filter(m=>m.codigo==='B3002').map(m=>m.acabado)).toEqual(['MA','SC','WRP']);
  expect(muestras[0].x).toBeGreaterThan(90);
  expect(muestras[0].x).toBeLessThan(110);
});

it('detecta seis texturas de compacto con códigos numericos sin cero inicial',()=>{
  const items=[
    ...[2409,164,180,218,982,983].map((code,i)=>t(String(code),83+i*81,733,15)),
    ...['Frost White','Cachemire','Monument Oak','Sahara','Brown Work','Black Work'].map((name,i)=>t(name,70+i*81,720,45)),
  ];
  const muestras=detectarPosicionesMuestras(items);
  expect(muestras).toHaveLength(6);
  expect(muestras.map(m=>m.codigo)).toEqual(['2409','0164','0180','0218','0982','0983']);
  expect(normalizarCodigoMuestra('0164')).toBe('0164');
});

it('no trata cabeceras de espesor sin etiquetas como muestras',()=>{
  const items=[t('FORMATOS (mm)',60,750,90),t('ESPESOR (mm)',150,750,60),
    ...[6,7,8,9,10,12].map((n,i)=>t(String(n),220+i*45,750,12)),
    ...[100,85,75,70,60,50].map((n,i)=>t(String(n),220+i*45,730,12))];
  expect(detectarPosicionesMuestras(items)).toEqual([]);
});
