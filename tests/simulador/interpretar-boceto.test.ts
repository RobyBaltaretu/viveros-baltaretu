import { describe, expect, it } from 'vitest';
import { normalizarInterpretacion, interpretarBoceto } from '../../src/server/simulador/interpretar-boceto.ts';
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
    const b = normalizarInterpretacion({ modulos: [{ tipo: 'cajonera', ancho: 600, alto: 850, fondo: null, piezas: ['cajon', 'cajon'] }], obstaculos: [], preguntas: ['¿Altura del zócalo?'] }, 'e', 'd');
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
