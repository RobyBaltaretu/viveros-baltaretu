import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { importarCandidatos } from '../../src/server/catalogo/importacion-proveedor.ts';
import { d1DePrueba } from '../panel/d1.ts';

let repos: Repositorios;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  const prueba = await d1DePrueba();
  cerrar = prueba.cerrar;
  await aplicarMigraciones(prueba.db);
  repos = crearRepositoriosD1(prueba.db);
}, 30_000);
afterAll(async () => { await cerrar?.(); });

describe('Turia: muestras de catalogo aisladas de fotos publicables', () => {
  it('guarda ficha y muestra en adjuntos privados, no en fotos del contenido web', async () => {
    const bytes = Uint8Array.from([...new TextEncoder().encode('RIFF'),0,0,0,0,...new TextEncoder().encode('WEBP'),1]);
    const muestra = 'data:image/webp;base64,' + btoa(String.fromCharCode(...bytes));
    const candidato = {
      categoria:'tableros', nombre:'Tablero roble seguridad', referencia:'SEC-0001',
      codigoDecor:'SEC-0001', acabado:'Mate', soporte:'Melamina',
      espesorMm:19, formato:'2800 x 2070 mm', unidad:'m²',
      colorHex:null, veta:null, brillo:'mate', pagina:1,
    };
    const resultado = await importarCandidatos(repos,'PROVEEDOR SEGURIDAD','prueba.pdf',[candidato],'auditor@example.test',[muestra]);
    expect(resultado).toMatchObject({creados:1,rechazados:0});
    const articulo = (await repos.catalogo.articulos()).find(a => a.referencia === 'SEC-0001');
    expect(articulo).toBeDefined();
    const ruta = new URL(articulo!.visual!.textura!, 'https://turia.example.test').searchParams.get('ruta');
    expect(ruta).toMatch(/^catalogo-materiales\/prov-[a-z0-9]+\/muestra\.webp$/);
    const adjunto = await repos.adjuntos.obtener(ruta!);
    expect(adjunto?.ambito).toBe('catalogo');
    expect(adjunto?.bytes).toEqual(bytes);
    expect(await repos.fotos.obtener(ruta!)).toBeNull();
  });
});
