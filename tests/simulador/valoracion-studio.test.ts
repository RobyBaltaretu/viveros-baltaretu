import {describe,it,expect} from 'vitest';
import {valorarDespiece} from '../../src/server/simulador/valoracion-studio.ts';
describe('Valoración parcial Studio',()=>{
 const d={partidas:[{moduloId:'m',piezaId:'p',tipo:'puerta',varianteId:'v',anchoMm:500,altoMm:1000,fondoMm:null,cantidad:2,metrosCuadrados:1,requiereMedicion:false}],bloqueos:[],despieceCompleto:true,presupuestable:false};
 const a={id:'a',unidad:'m²',coste:20,merma:10,margen:25,precioFijo:null,archivado:false,referencia:'A'};
 const v={id:'v',articuloId:'a',referencia:'V',estado:'activo',disponibilidad:'disponible',unidadConsumo:'m²',unidadPresupuesto:'m²'};
 it('calculates an indicative subtotal but never claims a complete quote',()=>{
  const r=valorarDespiece(d as never,[a] as never,[v] as never);
  expect(r.lineas).toHaveLength(1);
  expect(r.subtotalSinIva).toBeCloseTo(27.5);
  expect(r.listaParaPresupuesto).toBe(false);
  expect(r.bloqueos.length).toBeGreaterThan(0);
 });
 it('does not add waste a second time to a fixed sale price',()=>{
  const r=valorarDespiece(d as never,[{...a,precioFijo:40}] as never,[v] as never);
  expect(r.subtotalSinIva).toBeCloseTo(40);
 });
 it('requires stock verification for made-to-order variants',()=>{
  const r=valorarDespiece(d as never,[a] as never,[{...v,disponibilidad:'bajo-pedido'}] as never);
  expect(r.bloqueos.join(' ')).toContain('confirmar disponibilidad');
 });
 it('rejects unsupported units',()=>{
  const r=valorarDespiece(d as never,[{...a,unidad:'ud'}] as never,[v] as never);
  expect(r.lineas).toHaveLength(0);
  expect(r.subtotalSinIva).toBeNull();
 });
 it('rejects unpriced catalogue articles',()=>{
  const r=valorarDespiece(d as never,[{...a,coste:0}] as never,[v] as never);
  expect(r.lineas).toHaveLength(0);
 });
});
