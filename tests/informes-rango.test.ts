import {campoCsv} from '../src/server/informes/csv';
import {expect,it} from 'vitest';
import {evolucionPeriodo} from '../src/server/informes/informes';
import type {Factura} from '../src/server/data/tipos';
it('recorta meses parciales, conserva rectificativas y muestra cada año solicitado',()=>{
 const fs=[{estado:'emitida',tipo:'ordinaria',fecha:'2025-01-10',totales:{base:100,total:121,cuotaIva:21,cuotaRecargo:0}},{estado:'emitida',tipo:'rectificativa',fecha:'2025-01-20',totales:{base:-20,total:-24.2,cuotaIva:-4.2,cuotaRecargo:0}}] as Factura[];
 const r=evolucionPeriodo(fs,[],'2025-01-15','2026-02-01');expect(r).toHaveLength(14);expect(r[0]!.ingresos).toBe(-20);expect(r.at(-1)!.mes).toBe('2026-02');
});

it('protege texto del CSV frente a fórmulas sin alterar números negativos',()=>{expect(campoCsv('  =SUM(A1)')).toBe("\"'  =SUM(A1)\"");expect(campoCsv(-20)).toBe('"-20"');expect(campoCsv('Mueble "Norte"')).toBe('"Mueble ""Norte"""');});

it('el rol editor no puede consultar informes ni el detalle financiero',async()=>{const {sesionCon}=await import('../src/server/panel/pagina');const editor={panel:{estado:'ok',usuario:{rol:'editor'}}} as unknown as App.Locals;expect(sesionCon(editor,'informes')).toBeNull();expect(sesionCon(editor,'facturas')).toBeNull();expect(sesionCon(editor,'gastos')).toBeNull();});

it('distingue una factura antigua de su cobro en el periodo',async()=>{
 const {cifras}=await import('../src/server/informes/informes');
 const f={estado:'cobrada',tipo:'ordinaria',fecha:'2020-01-01',cobradaEl:'2026-03-10',clienteId:'c',totales:{base:100,total:121,cuotaIva:21,cuotaRecargo:0}} as Factura;
 expect(cifras([f],[],[],{desde:'2026-03-01',hasta:'2026-03-31'})).toMatchObject({ingresos:0,facturado:0,cobrado:121});
});
