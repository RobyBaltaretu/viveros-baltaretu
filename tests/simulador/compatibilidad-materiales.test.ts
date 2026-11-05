import { describe,it,expect } from 'vitest';
import { compatibilidadPieza } from '../../src/server/simulador/compatibilidad-materiales.ts';
import { instruccionesRender } from '../../src/server/simulador/render-boceto.ts';
describe('materiales y render de bocetos',()=>{
  const pieza={id:'p',tipo:'puerta',catalogoVarianteId:'v',acabadoId:'v'};
  const articulo={categoria:'tableros',nombre:'Tablero roble',archivado:false,espesor:19};
  const variante={estado:'activo',soporte:'MDF',disponibilidad:'disponible',dimensiones:{espesorMm:19}};
  it('acepta tablero activo para puerta',()=>expect(compatibilidadPieza(pieza as never,articulo as never,variante as never).compatible).toBe(true));
  it('rechaza canto usado como puerta',()=>expect(compatibilidadPieza(pieza as never,{...articulo,categoria:'cantos',nombre:'Canto PVC'} as never,{...variante,soporte:'PVC'} as never).compatible).toBe(false));
  it('rechaza material descatalogado',()=>expect(compatibilidadPieza(pieza as never,articulo as never,{...variante,estado:'descatalogado'} as never).compatible).toBe(false));
  it('impide generar sin validación',()=>expect(()=>instruccionesRender({estado:'pendiente',modulos:[]} as never)).toThrow());
});
