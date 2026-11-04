import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {aplicarMigraciones,crearRepositoriosD1,type Repositorios} from '../../src/server/data/index.ts';
import {d1DePrueba} from '../panel/d1.ts';
import {limiteNeuronasCliente,NEURONAS_RESERVA_TICKET} from '../../src/server/asistente/cuotas.ts';

let repos:Repositorios; let cerrar:()=>Promise<void>;
beforeAll(async()=>{
 const test=await d1DePrueba();cerrar=test.cerrar;
 await aplicarMigraciones(test.db);repos=crearRepositoriosD1(test.db);
},30000);
afterAll(async()=>{await cerrar?.();});

describe('Cupos Workers AI 40/60 y lector de tickets',()=>{
 it('asigna 40% a Baltaretu y 60% a Turia',()=>{
   expect(limiteNeuronasCliente('baltaretu')).toBe(4000);
   expect(limiteNeuronasCliente('turia')).toBe(6000);
   expect(limiteNeuronasCliente('turia')+limiteNeuronasCliente('baltaretu')).toBe(10000);
 });
 it('reserva OCR dentro de la bolsa de neuronas mediante operación atómica',async()=>{
   const dia='2026-11-11';
   const resultados=await Promise.all(Array.from({length:12},()=>
     repos.usoAsistente.reservarCantidad('__neuronas__',dia,NEURONAS_RESERVA_TICKET,200)));
   expect(resultados.filter(Boolean)).toHaveLength(2);
   expect(await repos.usoAsistente.obtener('__neuronas__',dia)).toBe(140);
 });
 it('rechaza reservas fuera de presupuesto sin alterar el contador',async()=>{
   const dia='2026-11-12';
   expect(await repos.usoAsistente.reservarCantidad('__neuronas__',dia,4001,4000)).toBe(false);
   expect(await repos.usoAsistente.reservarCantidad('__neuronas__',dia,-1,4000)).toBe(false);
   expect(await repos.usoAsistente.reservarCantidad('__neuronas__',dia,4000,4000)).toBe(true);
   expect(await repos.usoAsistente.reservarCantidad('__neuronas__',dia,1,4000)).toBe(false);
 });
});
