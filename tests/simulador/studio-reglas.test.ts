import { describe,expect,it } from 'vitest';
import { compatibilidadPieza } from '../../src/server/simulador/compatibilidad-materiales.ts';
import { instruccionesRender } from '../../src/server/simulador/render-boceto.ts';
describe('Turia Studio: reglas de seguridad del diseño',()=>{
 const pieza={id:'pieza-1',tipo:'puerta',catalogoVarianteId:'var-1',acabadoId:'var-1'};
 const articulo={categoria:'tableros',nombre:'Tablero melaminado',archivado:false,espesor:19};
 const variante={estado:'activo',soporte:'MDF',disponibilidad:'disponible',dimensiones:{espesorMm:19}};
 it('permite un tablero activo para una puerta',()=>{
  expect(compatibilidadPieza(pieza as any,articulo as any,variante as any).compatible).toBe(true);
 });
 it('rechaza una variante descatalogada',()=>{
  expect(compatibilidadPieza(pieza as any,articulo as any,{...variante,estado:'descatalogado'} as any).compatible).toBe(false);
 });
 it('rechaza un canto usado como tablero',()=>{
  expect(compatibilidadPieza(pieza as any,{...articulo,categoria:'cantos',nombre:'Canto PVC'} as any,{...variante,soporte:'PVC'} as any).compatible).toBe(false);
 });
 it('impide generar un render sin aprobación humana',()=>{
  expect(()=>instruccionesRender({estado:'pendiente',modulos:[]} as any)).toThrow();
 });
});
