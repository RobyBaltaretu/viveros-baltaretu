import { expect, it } from 'vitest';
import { reconstruirFilas, sugerirMaterialesLocales } from '../../src/panel-nuevo/filas-pdf';

it('conserva texto posterior a 4000 caracteres y reconoce varios decorativos por fila', () => {
  const token = (str:string,x:number,y:number) => ({str,width:20,transform:[1,0,0,1,x,y]});
  const texto = reconstruirFilas([token('CATÁLOGO DE TABLERO | MELAMINA',0,800),token('a'.repeat(4200),0,700),
    token('0101 PE Stone Grey',20,300),token('K519 SU Mouse Grey',200,300)]);
  expect(sugerirMaterialesLocales([{pagina:18,texto}]).map(p=>p.referencia)).toEqual(['0101','K519']);
});
it('asocia códigos y nombres por posición y omite tablas de clasificación de calidad', () => {
  const token = (str:string,x:number,y:number,width:number) => ({str,width,transform:[1,0,0,1,x,y]});
  const texto=reconstruirFilas([token('CATÁLOGO DE TABLERO | COMPACTO',0,800,190),
    token('6300',82,700,20),token('Corten',76,690,32),token('6152',162,700,20),token('Lasa Pure',152,690,40)]);
  expect(sugerirMaterialesLocales([{pagina:26,texto}])).toMatchObject([{nombre:'Corten',referencia:'6300'},{nombre:'Lasa Pure',referencia:'6152'}]);
  expect(sugerirMaterialesLocales([{pagina:62,texto:'DESCRIPCIÓN DE CALIDADES\nMadera pre aserrada F-D1'}])).toEqual([]);
});

it('distingue soporte y tratamiento aunque dos tableros compartan decor y acabado', async()=>{
  const {identidadProveedor}=await import('../../src/server/catalogo/identidad-proveedor');
  const ficha={nombre:'Aglomerado melamina blanca',categoria:'tableros',referencia:'B3002',codigoDecor:'',acabado:'MA/SC',formato:'',espesorMm:null};
  const claves=[ficha,{...ficha,nombre:'Aglomerado melamina blanca hidrófuga'},{...ficha,nombre:'MDF melamina blanca'}].map(f=>identidadProveedor(f,'Ejemplo'));
  expect(new Set(claves).size).toBe(3);
});
