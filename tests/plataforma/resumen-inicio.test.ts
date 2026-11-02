import { describe, expect, it } from 'vitest';
import type { Factura, Gasto, PresupuestoCliente } from '../../src/server/data/tipos';
import { resumenNegocio, proyectosDe, trazado } from '../../src/panel-nuevo/resumen';
import { periodoDe } from '../../src/server/informes/informes';

const factura = (extra: Partial<Factura>) => ({ estado:'emitida', tipo:'ordinaria', fecha:'2026-11-01', clienteId:'c', totales:{base:100,total:121,cuotaIva:21,cuotaRecargo:0}, ...extra }) as Factura;
const proyecto = (extra: Partial<PresupuestoCliente> = {}) => ({id:'p',estado:'aceptado',actualizado:'2026-11-01',totales:{anticipo:40}, ...extra}) as PresupuestoCliente;

describe('resumen del inicio de Turia', () => {
  it('compara meses, ignora borradores, resta rectificativas y cuenta cobros por su fecha', () => {
    const fs = [factura({fecha:'2026-10-01'}),factura({totales:{base:200,total:242,cuotaIva:42,cuotaRecargo:0,desglose:[]} as Factura['totales']}),factura({estado:'borrador'}),factura({tipo:'rectificativa',totales:{base:-20,total:-24.2,cuotaIva:-4.2,cuotaRecargo:0} as Factura['totales']}),factura({fecha:'2025-01-01',estado:'cobrada',cobradaEl:'2026-11-02'})];
    const gs = [{fecha:'2026-11-01',estado:'confirmado',base:30,total:36.3},{fecha:'2026-10-01',estado:'confirmado',base:60,total:72.6},{fecha:'2026-11-01',estado:'revisar',total:900}] as Gasto[];
    const ks = resumenNegocio(fs,gs,[],periodoDe('mes','2026-11-02'));
    expect(ks.find(k=>k.nombre==='Facturado')).toMatchObject({valor:180,cambio:80});
    expect(ks.find(k=>k.nombre==='Gastos')).toMatchObject({valor:30,cambio:-50});
    expect(ks.find(k=>k.nombre==='Cobros')).toMatchObject({valor:121,cambio:null});
    expect(ks.find(k=>k.nombre==='Presupuestos')).toMatchObject({valor:0,cambio:null});
  });
  it('los proyectos solo son aceptados y avanzan con sus hitos reales', () => {
    const ps = proyectosDe([proyecto({id:'a'}),proyecto({id:'b',cobroAnticipo:'2026-11-01'}),proyecto({id:'c',facturaId:'f'}),proyecto({id:'d',cobroAnticipo:'2026-11-01',cobroResto:'2026-11-02'}),proyecto({id:'e',estado:'enviado'}),proyecto({id:'f',cobroResto:'2026-11-02'})]);
    expect(ps.map(p=>[p.id,p.avance,p.terminado])).toEqual([['a',25,false],['b',50,false],['c',75,false],['d',100,true],['f',25,false]]);
  });
  it('una gráfica vacía o con negativos nunca genera coordenadas inválidas', () => {
    expect(trazado([])).toBe('');
    expect(trazado([0,0,0])).toBe('0,100 300,100 600,100');
    expect(trazado([-100,0,100])).toBe('0,100 300,57.5 600,15');
  });
});
