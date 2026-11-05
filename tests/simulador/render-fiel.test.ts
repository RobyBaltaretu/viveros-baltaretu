import { describe, expect, it } from 'vitest';
import { promptRender, proporcionImagen, dimensionesImagen, type MaterialRender } from '../../src/server/simulador/render-boceto.ts';
import { materialCompatible } from '../../src/server/simulador/compatibilidad-materiales.ts';
import type { InterpretacionBoceto, CotaBoceto } from '../../src/server/simulador/boceto.ts';

const c = (mm: number | null): CotaBoceto => ({ valorMm: mm, precision: mm === null ? 'desconocida' : 'exacta', origen: 'usuario', confirmada: mm !== null });
const lavadero: InterpretacionBoceto = {
  version: 1, estado: 'validada', categoria: 'mueble', fotoEspacioId: 'e', fotoBocetoId: 'd', preguntas: [],
  obstaculos: [{ id: 'o0', descripcion: 'pilar', conservar: true }, { id: 'o1', descripcion: 'termo', conservar: true }],
  modulos: [
    { id: 'm2', tipo: 'armario', orden: 2, ancho: c(865), alto: c(2100), fondo: c(410), contenido: 'armario alto de dos puertas',
      piezas: [{ id: 'p3', tipo: 'puerta', catalogoVarianteId: 'verde', acabadoId: 'verde' }, { id: 'p4', tipo: 'costado', catalogoVarianteId: 'blanco', acabadoId: 'blanco' }] },
    { id: 'm0', tipo: 'encimera', orden: 0, ancho: c(800), alto: c(900), fondo: c(410), contenido: 'fregadero con encimera, barra de colgar encima',
      piezas: [{ id: 'p0', tipo: 'puerta', catalogoVarianteId: 'verde', acabadoId: 'verde' }, { id: 'p1', tipo: 'encimera', catalogoVarianteId: 'encimera', acabadoId: 'encimera' }] },
    { id: 'm1', tipo: 'hueco-electrodomestico', orden: 1, ancho: c(630), alto: c(2100), fondo: c(410), contenido: 'lavadora y secadora apiladas, altillo encima', piezas: [] },
  ],
};
const materiales = new Map<string, MaterialRender>([
  ['verde', { nombre: 'Melamina verde salvia', referencia: 'U626', acabado: 'mate', colorHex: '#7d8b6a', brillo: 'mate', muestra: 3 }],
  ['blanco', { nombre: 'Melamina blanca', colorHex: '#f4f4f2' }],
  ['encimera', { nombre: 'Encimera compacta blanca', colorHex: '#ffffff' }],
]);

describe('render fiel: prompt para Gemini', () => {
  const p = promptRender(lavadero, materiales);
  it('edita la foto y quita las líneas de rotulador', () => {
    expect(p).toMatch(/Edit the FIRST image/);
    expect(p).toMatch(/same camera position/);
    expect(p).toMatch(/remove every marker line/);
  });
  it('módulos de izquierda a derecha con cm, % del total y lo que llevan', () => {
    const i0 = p.indexOf('fregadero'), i1 = p.indexOf('lavadora'), i2 = p.indexOf('dos puertas');
    expect(i0).toBeGreaterThan(0);
    expect(i0).toBeLessThan(i1);
    expect(i1).toBeLessThan(i2);
    expect(p).toContain('total run 229.5 cm');
    expect(p).toContain('width 86.5 cm (38% of the total run)');
    expect(p).toContain('depth 41 cm');
  });
  it('conserva el pilar y el termo y no añade nada', () => {
    expect(p).toContain('Keep unchanged and visible, in the same place: pilar; termo.');
    expect(p).toMatch(/Do NOT add units, shelves, upper cabinets/);
  });
  it('materiales por parte con nombre, color y muestra; no manda ids internos', () => {
    expect(p).toMatch(/doors and drawer fronts: Melamina verde salvia, ref\. U626, finish: mate, mate sheen, colour #7d8b6a, see swatch image 3/);
    expect(p).toMatch(/carcass \/ sides \/ shelves: Melamina blanca, colour #f4f4f2/);
    expect(p).toMatch(/countertop: Encimera compacta blanca/);
    expect(p).toMatch(/Images 3 are material swatches/);
    expect(p).not.toContain('articulo:');
    expect(p).not.toContain('modulo-');
  });
  it('no genera sin aprobar el diseño', () => {
    expect(() => promptRender({ ...lavadero, estado: 'requiere-revision' }, materiales)).toThrow();
  });
});

describe('render fiel: misma proporción que la foto', () => {
  const png = (w: number, h: number) => {
    const b = new Uint8Array(33);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, w);
    new DataView(b.buffer).setUint32(20, h);
    return b;
  };
  const jpeg = (w: number, h: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0, 0]);
  it('lee PNG y JPEG', () => {
    expect(dimensionesImagen(png(400, 300))).toEqual({ ancho: 400, alto: 300 });
    expect(dimensionesImagen(jpeg(1500, 2000))).toEqual({ ancho: 1500, alto: 2000 });
  });
  it('elige la proporción admitida más cercana', () => {
    expect(proporcionImagen(png(400, 300))).toBe('4:3');
    expect(proporcionImagen(jpeg(1500, 2000))).toBe('3:4');
    expect(proporcionImagen(jpeg(1080, 1920))).toBe('9:16');
    expect(proporcionImagen(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('selector de materiales: solo lo que vale para cada pieza', () => {
  const tablero = { categoria: 'tableros', nombre: 'Melamina blanca' };
  const canto = { categoria: 'cantos', nombre: 'Canto melamina blanca' };
  const encimera = { categoria: 'encimeras', nombre: 'Encimera compacta' };
  const herraje = { categoria: 'herrajes', nombre: 'Bisagra cazoleta' };
  it('puertas, costados, baldas y cajones: tableros, madera y chapas', () => {
    for (const t of ['puerta', 'costado', 'interior', 'balda', 'cajon', 'trasera'] as const) {
      expect(materialCompatible(t, tablero)).toBe(true);
      expect(materialCompatible(t, { categoria: 'macizos', nombre: 'Roble' })).toBe(true);
      expect(materialCompatible(t, { categoria: 'chapas', nombre: 'Laminado HPL' })).toBe(true);
      expect(materialCompatible(t, canto)).toBe(false);
      expect(materialCompatible(t, encimera)).toBe(false);
      expect(materialCompatible(t, herraje)).toBe(false);
    }
  });
  it('canto solo cantos y encimera solo encimeras', () => {
    expect(materialCompatible('canto', canto)).toBe(true);
    expect(materialCompatible('canto', tablero)).toBe(false);
    expect(materialCompatible('encimera', encimera)).toBe(true);
    expect(materialCompatible('encimera', tablero)).toBe(false);
  });
});
