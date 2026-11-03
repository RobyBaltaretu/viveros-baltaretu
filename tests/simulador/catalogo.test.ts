import {expect,it} from 'vitest';
import {detallesProyecto,materialesDelTaller} from '../../src/server/simulador/catalogo';
import {resolveRenovationConfig} from '../../src/server/simulador/materiales';
import type {ArticuloCatalogo} from '../../src/server/data/tipos';
it('solo exporta materiales activos y no sus costes',()=>{
const a={id:'a',nombre:'Roble',categoria:'macizos',acabado:'Natural',referencia:'R',espesor:19,coste:500,margen:30} as ArticuloCatalogo;
const materiales=materialesDelTaller([a,{...a,id:'b',archivado:true}]);
expect(materiales.map(m=>m.id)).toEqual(['catalogo:a','catalogo:a']);
expect(JSON.stringify(materiales)).not.toContain('coste');
expect(()=>resolveRenovationConfig({zones:{cabinets:true},upperMaterialId:'inventado'} as never,materiales)).toThrow();
});
it('rechaza dimensiones y opciones manipuladas',()=>{
expect(()=>detallesProyecto({ancho:-1})).toThrow();
expect(()=>detallesProyecto({puertas:1.5})).toThrow();
expect(()=>detallesProyecto({apertura:'instrucciones arbitrarias'})).toThrow();
expect(detallesProyecto({ancho:240,apertura:'Corredera'})).toMatchObject({ancho:240,apertura:'Corredera',alto:null});
});

it('respeta las zonas visuales del catálogo y conserva texturas, sin datos comerciales',()=>{
  const articulo={id:'ejemplo',nombre:'Calacatta',categoria:'encimeras',referencia:'C-01',archivado:false,coste:120,margen:22,visual:{uso:['mueble'],textura:'https://example.com/c-01.webp',colorHex:'#eae6df'}} as unknown as ArticuloCatalogo;
  const mats=materialesDelTaller([articulo]);
  expect(mats).toHaveLength(1);
  expect(mats[0]).toMatchObject({id:'catalogo:ejemplo',categoria:'mueble',previewTexture:'https://example.com/c-01.webp'});
  expect(JSON.stringify(mats)).not.toMatch(/"coste"|"margen"/);
});
