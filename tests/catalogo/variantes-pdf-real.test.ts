import { expect, it } from 'vitest';
import { extraerVariantesTablero } from '../../src/panel-nuevo/filas-pdf';

it('interpreta la matriz real de Contrachapado Chopo B/BB C1 del PDF, página 1', () => {
  const item=(str:string,x:number,y:number,width=12)=>({str,width,transform:[1,0,0,1,x,y]});
  const mm=[6,7,8,9,10,12,15,18,20,22,25,30,40];
  const x=mm.map((_,i)=>225+i*22.6);
  const tokens=[
    item('CONTRACHAPADO CHOPO B/BB C1',62,730,180),
    item('FORMATOS (mm)',72,710,72),item('ESPESOR (mm)',152,710,59),
    ...mm.map((n,i)=>item(String(n),x[i],710)),
    item('2500 x 1220',82,697,70),
    ...[100,85,75,70,60,50,40,33,30,27,24,20,15].map((n,i)=>item(String(n),x[i],697)),
    item('2520 x 1850',82,684,70),
    ...[[2,75],[4,60],[5,50],[6,40],[7,33],[8,30],[9,27],[10,24],[11,20]].map(([i,n])=>item(String(n),x[i],684)),
    item('3100 x 1530',82,671,70),
    ...[[2,62],[3,55],[4,50],[5,42],[6,33],[7,27],[9,22],[10,20],[11,16],[12,12]].map(([i,n])=>item(String(n),x[i],671)),
  ];
  const fichas=extraerVariantesTablero(tokens,1);
  expect(fichas).toHaveLength(32);
  expect(fichas).toEqual(expect.arrayContaining([
    expect.objectContaining({pagina:1,soporte:'CONTRACHAPADO CHOPO',acabado:'B/BB C1',formato:'2500 x 1220 mm',espesorMm:6,unidadesPaquete:100,referencia:''}),
    expect.objectContaining({formato:'2520 x 1850 mm',espesorMm:8,unidadesPaquete:75}),
    expect.objectContaining({formato:'3100 x 1530 mm',espesorMm:40,unidadesPaquete:12}),
  ]));
  expect(fichas.some(f=>f.formato==='2520 x 1850 mm' && f.espesorMm===7)).toBe(false);
});

it('no inventa combinaciones a partir de descripciones sin tablas',()=>{
  const item=(str:string,x:number,y:number)=>({str,width:40,transform:[1,0,0,1,x,y]});
  expect(extraerVariantesTablero([item('CONTRACHAPADO DE CHOPO',62,730),item('Encolado clase I y III',62,680)],1)).toEqual([]);
});
