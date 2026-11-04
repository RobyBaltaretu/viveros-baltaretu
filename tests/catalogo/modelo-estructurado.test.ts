import { describe, expect, it } from 'vitest';
import { normalizarDimensiones, paquetesNecesarios, superficieM2, validarConfiguracion } from '../../src/server/catalogo/modelo';
import { candidatosConfigurablesColomba, MODELOS_CAJONERA_COLOMBA } from '../../src/server/catalogo/configurables-colomba';

describe('catálogo estructurado',()=>{
  it('normaliza centímetros sin perder la representación publicada',()=>{
    const d=normalizarDimensiones('244 × 122',19,'cm');
    expect(d).toMatchObject({largoMm:2440,anchoMm:1220,espesorMm:19,textoOriginal:'244 × 122',unidadOriginal:'cm'});
    expect(superficieM2(d)).toBe(2.977);
  });

  it('calcula paquetes comerciales sin confundir cantidad con espesor',()=>{
    expect(paquetesNecesarios(61,30)).toBe(3);
    expect(paquetesNecesarios(0,30)).toBe(0);
    expect(()=>paquetesNecesarios(2,0)).toThrow();
  });

  it('representa los quince modelos y aplica rangos, pasos y alturas declaradas',()=>{
    expect(MODELOS_CAJONERA_COLOMBA).toHaveLength(15);
    const [barco]=candidatosConfigurablesColomba('5 Cajoneras Fabricación propia a medida',6) as any[];
    expect(barco.configuracion.parametros.find((p:any)=>p.id==='ancho')).toMatchObject({min:40,max:100,paso:5});
    expect(validarConfiguracion(barco.configuracion,{ancho:43,alto:50,cajones:4,altura_cajon:12,material:'Melamina 16 mm',acabado:'Blanco mate',apertura:'Push-to-open'})).toContain('Ancho debe avanzar en pasos de 5 cm.');
    expect(validarConfiguracion(barco.configuracion,{ancho:45,alto:50,cajones:4,altura_cajon:12,material:'Melamina 16 mm',acabado:'Blanco mate',apertura:'Push-to-open'})).toContain('Barco: altura de cajón admitida 10, 16, 20, 32 cm.');
  });

  it('representa tres zapateros y nueve muebles bajo proyecto sin inventar límites',()=>{
    const candidatos=candidatosConfigurablesColomba('6 Zapateros con baldas extraíbles y muebles a medida',7) as any[];
    expect(candidatos.filter(x=>x.subcategoria==='Zapateros')).toHaveLength(3);
    expect(candidatos.filter(x=>x.tipoProducto==='a-medida')).toHaveLength(9);
    const abatible=candidatos.find(x=>x.codigoFamilia==='ZAP-ABA');
    expect(abatible.configuracion.parametros.find((p:any)=>p.id==='fondo')).toMatchObject({min:25,max:25});
  });
});
