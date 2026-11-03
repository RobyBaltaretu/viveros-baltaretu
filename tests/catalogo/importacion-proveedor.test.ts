import { describe, expect, it, vi } from 'vitest';
import type { Repositorios } from '../../src/server/data/tipos.ts';
import {
  depurarCandidatos, importarCandidatos, muestraWebp,
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
  const guardarFoto = vi.fn(async () => {});
  const repos = {
    catalogo: { articulos: vi.fn(async () => guardados), articulo: vi.fn(async (id: string) => guardados.find(a => (a as { id?: string }).id === id) ?? null), guardarArticulo: guardar },
    auditoria: { registrar: auditar },
    fotos: { guardar: guardarFoto },
  } as unknown as Repositorios;
  return {repos, guardados, guardar, auditar, guardarFoto};
};
describe('Muestras reales almacenadas en D1',()=>{
  it('acepta solo imágenes WebP pequeñas y asocia URL privada a la ficha',async()=>{
    const bytes=Uint8Array.from([...new TextEncoder().encode('RIFF'),0,0,0,0,...new TextEncoder().encode('WEBP'),1]);
    const imagen='data:image/webp;base64,'+btoa(String.fromCharCode(...bytes));
    expect(muestraWebp(imagen)).toEqual(bytes);
    expect(()=>muestraWebp('data:text/html;base64,PGRpdj4=')).toThrow();
    const {repos,guardarFoto,guardados}=reposMock();
    const resultado=await importarCandidatos(repos,'ONESTA','catalogo.pdf',[candidato],'propietario@example.test',[imagen]);
    expect(resultado.creados).toBe(1);
    expect(guardarFoto).toHaveBeenCalledTimes(1);
    const ficha=guardados[0] as {visual:{textura:string}};
    expect(ficha.visual.textura).toMatch(/^\/api\/panel\/catalogo-muestra\?ruta=catalogo-materiales%2Fprov-[a-z0-9]+%2Fmuestra\.webp$/);
    const nuevo=await importarCandidatos(repos,'ONESTA','catalogo.pdf',[candidato],'propietario@example.test',[imagen]);
    expect(nuevo).toMatchObject({creados:0,duplicados:1});
    expect(guardarFoto).toHaveBeenCalledTimes(1); // el duplicado nunca reescribe la textura
  });
});

describe('Gubia · PDF no fiable',()=>{
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

