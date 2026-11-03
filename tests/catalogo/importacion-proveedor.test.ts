import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { Repositorios } from '../../src/server/data/tipos.ts';
import {
  analizarLotePDF, depurarCandidatos, ErrorImportacion, importarCandidatos,
} from '../../src/server/catalogo/importacion-proveedor.ts';

const candidato = {
  categoria:'tableros',nombre:'Roble natural',referencia:'DEC-01',codigoDecor:'DEC-01',
  acabado:'Mate',soporte:'Melamina',espesorMm:19,formato:'2800 × 2070 mm',
  unidad:'m²',colorHex:'#b69a72',veta:'direccional',brillo:'mate',pagina:2,
};
const reposMock = () => {
  const guardados: unknown[] = [];
  const guardar = vi.fn(async (x: unknown) => {guardados.push(x);});
  const auditar = vi.fn(async () => {});
  const repos = {
    catalogo: { articulos: vi.fn(async () => guardados), guardarArticulo: guardar },
    auditoria: { registrar: auditar },
  } as unknown as Repositorios;
  return {repos, guardados, guardar, auditar};
};
describe('Gubia · PDF no fiable',()=>{
  it('rechaza entradas que no son PDF y rangos imposibles',async()=>{
    await expect(analizarLotePDF(new TextEncoder().encode('<html>'), 'ONESTA', 1,{apiKey:'test'})).rejects.toBeInstanceOf(ErrorImportacion);
    const doc=await PDFDocument.create();doc.addPage();const pdf=new Uint8Array(await doc.save());
    await expect(analizarLotePDF(pdf,'ONESTA',0,{apiKey:'test'})).rejects.toBeInstanceOf(ErrorImportacion);
  });
  it('recorta el PDF por páginas y no permite datos fuera de ellas',async()=>{
    const doc=await PDFDocument.create();for(let i=0;i<9;i++)doc.addPage();
    const pdf=new Uint8Array(await doc.save());
    const mocked = vi.fn(async (_url:string,init?:RequestInit)=>{
      const body=JSON.parse(String(init?.body)) as {contents:Array<{parts:Array<{inlineData?:{data:string}}>} >};
      const encoded=body.contents[0]!.parts.find(p=>p.inlineData)?.inlineData?.data;
      expect(encoded).toBeTruthy();
      const partial=await PDFDocument.load(Uint8Array.from(atob(encoded ?? ''),c=>c.charCodeAt(0)));
      expect(partial.getPageCount()).toBe(6);
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({articulos:[candidato,{...candidato,pagina:9}]})}]}}]}),{status:200});
    });
    const result=await analizarLotePDF(pdf,'ONESTA',1,{apiKey:'test',fetch:mocked as typeof fetch});
    expect(result).toMatchObject({paginas:9,inicio:1,fin:6});
    expect(result.articulos).toHaveLength(1);
  });
  it('descarta registros malformados, duplicados o sin página verificable',()=>{
    expect(depurarCandidatos([candidato,{...candidato},{...candidato,pagina:55},{...candidato,nombre:'x'}],1,6)).toHaveLength(1);
  });
  it('crea solo artículos nuevos sin precio y con procedencia verificable',async()=>{
    const {repos,guardados,guardar}=reposMock();
    const r=await importarCandidatos(repos,'ONESTA','catalogo.pdf',[candidato,candidato,{...candidato,espesorMm:-2}],'propietario@example.test');
    expect(r).toEqual({creados:1,duplicados:1,rechazados:1});
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardados[0]).toMatchObject({
      referencia:'DEC-01',coste:0,precioFijo:null,espesor:19,
      visual:{codigoDecor:'DEC-01',colorHex:'#b69a72'},
    });
    expect(JSON.stringify(guardados[0])).toContain('Página: 2');
    const second=await importarCandidatos(repos,'ONESTA','catalogo.pdf',[candidato],'propietario@example.test');
    expect(second.creados).toBe(0);
    expect(second.duplicados).toBe(1);
  });
});
