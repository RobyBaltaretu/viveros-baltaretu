import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {aplicarMigraciones,crearRepositoriosD1,type Repositorios} from '../../src/server/data/index.ts';
import {d1DePrueba} from '../panel/d1.ts';

let repos:Repositorios;
let cerrar:()=>Promise<void>;
beforeAll(async()=>{
 const prueba=await d1DePrueba();
 cerrar=prueba.cerrar;
 await aplicarMigraciones(prueba.db);
 repos=crearRepositoriosD1(prueba.db);
},30_000);
afterAll(async()=>{await cerrar?.();});

describe('Groq Free: prioridad dinámica del importador',()=>{
 it('sin importaciones el asistente puede consumir hasta el 100% del presupuesto disponible',async()=>{
   const dia='2026-11-07';
   const resultados=await Promise.all(Array.from({length:12},()=>repos.usoAsistente.reservarGroq(dia,'asistente',10)));
   expect(resultados.filter(Boolean)).toHaveLength(10);
   expect(await repos.usoAsistente.usoGroq(dia)).toEqual({importador:0,asistente:10});
   expect(await repos.usoAsistente.reservarGroq(dia,'importador',10)).toBe(false);
 });
 it('si hay importaciones reserva el 70% de las llamadas para ellas y 30% para Gubia',async()=>{
   const dia='2026-11-08';
   expect(await repos.usoAsistente.reservarGroq(dia,'importador',10)).toBe(true);
   const chat=await Promise.all(Array.from({length:8},()=>repos.usoAsistente.reservarGroq(dia,'asistente',10)));
   expect(chat.filter(Boolean)).toHaveLength(3);
   const imports=await Promise.all(Array.from({length:12},()=>repos.usoAsistente.reservarGroq(dia,'importador',10)));
   expect(imports.filter(Boolean)).toHaveLength(6);
   expect(await repos.usoAsistente.usoGroq(dia)).toEqual({importador:7,asistente:3});
 });
 it('cuando comienza una carga tras hablar con Gubia, protege la capacidad restante sin reclamar cuotas consumidas',async()=>{
   const dia='2026-11-09';
   for(let i=0;i<4;i++)expect(await repos.usoAsistente.reservarGroq(dia,'asistente',10)).toBe(true);
   expect(await repos.usoAsistente.reservarGroq(dia,'importador',10)).toBe(true);
   expect(await repos.usoAsistente.reservarGroq(dia,'asistente',10)).toBe(false);
   const ok=await Promise.all(Array.from({length:10},()=>repos.usoAsistente.reservarGroq(dia,'importador',10)));
   expect(ok.filter(Boolean)).toHaveLength(5);
   expect(await repos.usoAsistente.usoGroq(dia)).toEqual({importador:6,asistente:4});
 });
 it('no permite límites negativos y aísla días',async()=>{
   expect(await repos.usoAsistente.reservarGroq('2026-11-10','importador',0)).toBe(false);
   expect(await repos.usoAsistente.reservarGroq('2026-11-10','asistente',-1)).toBe(false);
   expect(await repos.usoAsistente.usoGroq('2026-11-10')).toEqual({importador:0,asistente:0});
 });
});
