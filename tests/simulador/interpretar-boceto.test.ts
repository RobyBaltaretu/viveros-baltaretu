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
