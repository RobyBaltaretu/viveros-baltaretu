import { describe, expect, it } from 'vitest';
import { partesDeFila, sugerirMaterialesLocales } from '../../src/panel-nuevo/filas-pdf.ts';

describe('importador sin IA: filas de tarifa', () => {
  it('separa código, nombre, formato, espesor, unidad y precio', () => {
    expect(partesDeFila('ML-1019 Melamina blanco mate 2850x2100 19 mm 12,40', 'ML-1019')).toEqual({ nombre: 'Melamina blanco mate', formato: '2850x2100', espesorMm: 19, unidad: '', precio: 12.4 });
    expect(partesDeFila('CP-23-1 Canto PVC blanco 23x1 mm 0,35', 'CP-23-1')).toMatchObject({ nombre: 'Canto PVC blanco', formato: '23x1 mm', precio: 0.35 });
    expect(partesDeFila('COR-450 Guía corredera extracción total 450 mm par 8,50', 'COR-450')).toMatchObject({ nombre: 'Guía corredera extracción total 450 mm', unidad: 'ud', precio: 8.5 });
  });
  it('las propuestas locales llevan el nombre limpio y el precio de tarifa', () => {
    const [m] = sugerirMaterialesLocales([{ pagina: 1, texto: 'Tableros melamina\nML-1019 | Melamina blanco mate | 2850x2100 | 19 mm | 12,40' }]);
    expect(m).toMatchObject({ categoria: 'tableros', nombre: 'Melamina blanco mate', referencia: 'ML-1019', espesorMm: 19, propiedades: { precioTarifa: 12.4 } });
  });
});
