import { describe, expect, it } from 'vitest';
import { claveDe, leerFormularioPlantilla } from '../../src/server/catalogo/formulario-plantilla.ts';

describe('formulario de plantillas', () => {
  it('clave de una medida a partir de su nombre', () => {
    expect(claveDe('Barras de colgar')).toBe('barras_de_colgar');
    expect(claveDe('Alto de las puertas (cm)')).toBe('alto_de_las_puertas_cm');
    expect(claveDe('2 cajones')).toBe('n2_cajones');
  });

  it('lee las filas, salta las vacías y entiende de dónde sale cada parte', () => {
    const f = new URLSearchParams({
      nombre: 'Estantería',
      tipoTrabajo: 'Mobiliario',
      filasMedidas: '3',
      'm0.nombre': 'Ancho',
      'm0.tipo': 'medida',
      'm0.defecto': '120',
      'm0.min': '30',
      'm0.max': '300',
      'm1.nombre': '',
      'm2.nombre': 'Baldas',
      'm2.tipo': 'numero',
      'm2.defecto': '4',
      'm2.min': '0',
      'm2.max': '20',
      filasOpciones: '1',
      'o0.nombre': 'Material',
      'o0.categorias': 'tableros,macizos',
      'o0.defecto': 'tablero-melamina-blanca-19',
      filasPartes: '3',
      'c0.concepto': 'Baldas',
      'c0.articulo': 'opcion:material',
      'c0.cantidad': 'baldas * ancho * 0,3',
      'c1.concepto': 'Soportes',
      'c1.articulo': 'id:herraje-soporte-balda',
      'c1.cantidad': 'baldas * 4',
    });
    const { entrada, filas } = leerFormularioPlantilla(f);
    expect(filas).toEqual({ medidas: 3, opciones: 1, partes: 3 });
    expect(entrada.parametros).toEqual([
      { id: 'ancho', nombre: 'Ancho', tipo: 'medida', defecto: 120, min: 30, max: 300 },
      { id: 'baldas', nombre: 'Baldas', tipo: 'numero', defecto: 4, min: 0, max: 20 },
    ]);
    expect(entrada.opciones).toEqual([{ id: 'material', nombre: 'Material', categorias: ['tableros', 'macizos'], defecto: 'tablero-melamina-blanca-19' }]);
    expect(entrada.componentes).toEqual([
      { concepto: 'Baldas', articulo: { opcion: 'material' }, cantidad: 'baldas * ancho * 0,3' },
      { concepto: 'Soportes', articulo: { id: 'herraje-soporte-balda' }, cantidad: 'baldas * 4' },
    ]);
  });
});
