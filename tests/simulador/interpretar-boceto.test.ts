import { describe, expect, it } from 'vitest';
import { normalizarInterpretacion, interpretarBoceto, PROMPT_INTERPRETACION } from '../../src/server/simulador/interpretar-boceto.ts';
describe('interpretación multimodal Turia',()=>{
  it('nunca confirma medidas sugeridas por IA',()=>{
    const b=normalizarInterpretacion({modulos:[{tipo:'armario',ancho:{valorMm:800,precision:'exacta'},piezas:['puerta']}],obstaculos:['termo']},'foto1','dibujo1');
    expect(b?.modulos[0].ancho).toEqual({valorMm:800,precision:'aproximada',origen:'boceto',confirmada:false});
    expect(b?.obstaculos[0].conservar).toBe(true);
  });
  it('no inventa valores para cotas ausentes',()=>{
    const b=normalizarInterpretacion({modulos:[{tipo:'armario'}]},'foto1','dibujo1');
    expect(b?.modulos[0].fondo.valorMm).toBeNull();
    expect(b?.estado).toBe('requiere-revision');
  });
  it('rechaza interpretaciones vacías o demasiado extensas',()=>{
    expect(normalizarInterpretacion({modulos:[]},'a','b')).toBeNull();
    expect(normalizarInterpretacion({modulos:Array(31).fill({})},'a','b')).toBeNull();
  });
  it('maneja fallo de cuota del proveedor sin inventar resultado',async()=>{
    const r=await interpretarBoceto({mime:'image/jpeg',base64:'a'},{mime:'image/jpeg',base64:'b'},
      {espacio:'a',dibujo:'b'},'test-key','test-model',async()=>new Response('',{status:429}));
    expect(r.ok).toBe(false);expect(r.estado).toBe(429);
  });
  it('normaliza respuesta JSON de proveedor',async()=>{
    const fake=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({modulos:[{tipo:'armario',ancho:{valorMm:2330},piezas:['puerta']}],preguntas:['Confirmar altura']})}]}}]}));
    const r=await interpretarBoceto({mime:'image/jpeg',base64:'a'},{mime:'image/jpeg',base64:'b'},
      {espacio:'a',dibujo:'b'},'test-key','test-model',fake);
    expect(r.ok).toBe(true);expect(r.interpretacion?.modulos[0].ancho.confirmada).toBe(false);
  });
});

describe('interpretación: respuesta real de Gemini y errores claros', () => {
  it('acepta cotas como número (salida estructurada) y las deja aproximadas', () => {
    const b = normalizarInterpretacion({ unidad: 'mm', modulos: [{ tipo: 'cajonera', ancho: 600, alto: 850, fondo: null, piezas: ['cajon', 'cajon'] }], obstaculos: [], preguntas: ['¿Altura del zócalo?'] }, 'e', 'd');
    expect(b?.modulos[0]).toMatchObject({ tipo: 'cajonera', ancho: { valorMm: 600, precision: 'aproximada', confirmada: false }, fondo: { valorMm: null, precision: 'desconocida' } });
    expect(b?.modulos[0]?.piezas).toHaveLength(2);
  });
  it('pide salida con esquema y explica cada error del proveedor', async () => {
    let cuerpo: { generationConfig?: { responseSchema?: unknown } } = {};
    const pedir = (async (_u: string, init: RequestInit) => {
      cuerpo = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ error: { message: 'models/x is not found' } }), { status: 404 });
    }) as unknown as typeof fetch;
    const r = await interpretarBoceto({ mime: 'image/png', base64: 'AA' }, { mime: 'image/png', base64: 'AA' }, { espacio: 'e', dibujo: 'd' }, 'k', 'x', pedir);
    expect(cuerpo.generationConfig?.responseSchema).toBeTruthy();
    expect(r).toMatchObject({ ok: false, estado: 404 });
    expect(r.error).toContain('no existe');
    expect(r.error).toContain('models/x is not found');
  });
});

describe('interpretación: boceto del carpintero en centímetros', () => {
  // Caso real del lavadero: 233 total, 80 fregadero, 63 columna, 86,5 armario, 20 pilar, fondo 41, sin unidad escrita.
  const respuesta = {
    modulos: [
      { tipo: 'encimera', ancho: 80, alto: 90, fondo: 41, contenido: 'fregadero con encimera, barra de colgar encima', piezas: ['puerta', 'encimera'] },
      { tipo: 'hueco-electrodomestico', ancho: 63, alto: null, fondo: 41, contenido: 'lavadora y secadora apiladas, altillo encima', piezas: ['puerta'] },
      { tipo: 'armario', ancho: 86.5, alto: null, fondo: 41, contenido: 'armario alto de dos puertas', piezas: ['puerta', 'puerta'] },
    ],
    conservar: ['pilar de 20 cm a la derecha', 'termo'],
    obstaculos: ['termo'],
    preguntas: [],
  };
  it('sin unidad escrita lee centímetros y los pasa a mm, en orden de izquierda a derecha', () => {
    const b = normalizarInterpretacion(respuesta, 'e', 'd')!;
    expect(b.modulos.map((m) => m.ancho.valorMm)).toEqual([800, 630, 865]);
    expect(b.modulos[0]!.fondo.valorMm).toBe(410);
    expect(b.modulos.map((m) => m.orden)).toEqual([0, 1, 2]);
    expect(b.modulos.every((m) => m.ancho.precision === 'aproximada' && !m.ancho.confirmada)).toBe(true);
  });
  it('guarda qué lleva cada módulo y lo que se conserva, sin repetir', () => {
    const b = normalizarInterpretacion(respuesta, 'e', 'd')!;
    expect(b.modulos[1]!.contenido).toBe('lavadora y secadora apiladas, altillo encima');
    expect(b.obstaculos.map((o) => o.descripcion)).toEqual(['pilar de 20 cm a la derecha', 'termo']);
    expect(b.obstaculos.every((o) => o.conservar)).toBe(true);
  });
  it('respeta mm y m cuando el dibujo los escribe', () => {
    expect(normalizarInterpretacion({ ...respuesta, unidad: 'mm' }, 'e', 'd')!.modulos[0]!.ancho.valorMm).toBe(80);
    expect(normalizarInterpretacion({ ...respuesta, unidad: 'm', modulos: [{ tipo: 'armario', ancho: 0.8, piezas: [] }] }, 'e', 'd')!.modulos[0]!.ancho.valorMm).toBe(800);
  });
  it('el prompt explica cm por defecto, orden de izquierda a derecha y elementos a conservar', () => {
    expect(PROMPT_INTERPRETACION).toMatch(/centímetros/);
    expect(PROMPT_INTERPRETACION).toMatch(/IZQUIERDA a DERECHA/);
    expect(PROMPT_INTERPRETACION).toMatch(/conservar/);
  });
});
