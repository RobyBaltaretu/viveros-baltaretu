import {describe,it,expect,vi} from 'vitest';
import {
  validarPaginas,interpretarTextoConGroq,interpretarMuestraConGroq,duracionGroqMs,GROQ_TEXTO_MODELO,GROQ_VISION_MODELO,
} from '../../src/server/catalogo/interpretacion-groq.ts';
import {ErrorImportacion} from '../../src/server/catalogo/importacion-proveedor.ts';

const candidato={
  categoria:'tableros',nombre:'Melamina roble natural',referencia:'DEC-001',codigoDecor:'DEC-001',
  acabado:'Mate',soporte:'Melamina',espesorMm:19,formato:'2800 × 2070 mm',
  unidad:'m²',colorHex:null,veta:null,brillo:'mate',pagina:2,
};
const OK=(articulos:unknown[])=>new Response(JSON.stringify({
  choices:[{message:{content:JSON.stringify({articulos})}}],
}),{status:200,headers:{'Content-Type':'application/json'}});

describe('Gubia Groq Free: importación local',()=>{
  it('interpreta las duraciones que Groq envía en las cabeceras',()=>{
    expect(duracionGroqMs('7.66s')).toBe(7660);
    expect(duracionGroqMs('2m59.56s')).toBe(179560);
    expect(duracionGroqMs('120ms')).toBe(120);
    expect(duracionGroqMs(null)).toBe(0);
  });
  it('solo acepta grupos pequeños de páginas y limita texto; nunca acepta el PDF',()=>{
    expect(validarPaginas([{pagina:1,texto:'Roble'}])).toHaveLength(1);
    expect(()=>validarPaginas([{pagina:1,texto:'a'},{pagina:1,texto:'b'}])).toThrow(ErrorImportacion);
    expect(()=>validarPaginas([{pagina:1,texto:'a'.repeat(4101)}])).toThrow(ErrorImportacion);
    expect(()=>validarPaginas([{pagina:1,texto:'a'},{pagina:2,texto:'b'},{pagina:3,texto:'c'},{pagina:4,texto:'d'}])).toThrow(ErrorImportacion);
  });
  it('envía solo texto a GPT-OSS y valida las fichas por páginas originales',async()=>{
    const fake=vi.fn(async (_url:string,opts?:RequestInit)=>{
      const body=JSON.parse(String(opts?.body));
      expect(body.model).toBe(GROQ_TEXTO_MODELO);
      expect(body.messages[1].content).toContain('DEC-001');
      expect(JSON.stringify(body)).not.toContain('application/pdf');
      return OK([candidato,{...candidato,pagina:30},{...candidato,nombre:'otro material',referencia:'DEC-002',codigoDecor:'DEC-002',pagina:2}]);
    });
    const res=await interpretarTextoConGroq('ONESTA',[{pagina:2,texto:'Melamina roble DEC-001 19 mm'}],{apiKey:'test',fetch:fake as typeof fetch});
    expect(res.articulos).toHaveLength(2);
    expect(res.paginasProcesadas).toEqual([2]);
    expect(res.limites.esperarMs).toBe(0);
    expect(fake).toHaveBeenCalledOnce();
  });
  it('manda solo un JPEG a Qwen Vision, sin reutilizar Gemini',async()=>{
    const jpeg='data:image/jpeg;base64,'+btoa(String.fromCharCode(0xff,0xd8,0xff,0xd9));
    const fake=vi.fn(async (_url:string,opts?:RequestInit)=>{
      const body=JSON.parse(String(opts?.body));
      expect(body.model).toBe(GROQ_VISION_MODELO);
      expect(body.messages[1].content[1].type).toBe('image_url');
      expect(JSON.stringify(body)).not.toContain('gemini');
      return OK([candidato]);
    });
    const res=await interpretarMuestraConGroq('ONESTA',jpeg,2,'Referencia DEC-001',{apiKey:'test',fetch:fake as typeof fetch});
    expect(res).toHaveLength(1);
    await expect(interpretarMuestraConGroq('ONESTA','data:application/pdf;base64,Zg==',2,'',{apiKey:'test',fetch:fake as typeof fetch})).rejects.toBeInstanceOf(ErrorImportacion);
  });
  it('si Groq Free llega a 429 sin Retry-After no repite ni cambia de proveedor',async()=>{
    const fake=vi.fn(async()=>new Response('quota',{status:429}));
    await expect(interpretarTextoConGroq('ONESTA',[{pagina:1,texto:'x'}],{
      apiKey:'test',fetch:fake as typeof fetch,
    })).rejects.toThrow(/Groq Free/);
    expect(fake).toHaveBeenCalledOnce();
  });
  it('respeta Retry-After y recupera un límite temporal',async()=>{
    const fake=vi.fn()
      .mockResolvedValueOnce(new Response('rate',{status:429,headers:{'retry-after':'0.01s'}}))
      .mockResolvedValueOnce(OK([candidato]));
    const res=await interpretarTextoConGroq('ONESTA',[{pagina:2,texto:'DEC-001'}],{apiKey:'test',fetch:fake as typeof fetch});
    expect(res.articulos).toHaveLength(1);
    expect(fake).toHaveBeenCalledTimes(2);
  });
  it('recomienda esperar antes del lote siguiente cuando quedan pocos tokens',async()=>{
    const fake=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({articulos:[candidato]})}}]}),{
      status:200,headers:{'Content-Type':'application/json','x-ratelimit-remaining-tokens':'1200','x-ratelimit-reset-tokens':'1.5s'},
    }));
    const res=await interpretarTextoConGroq('ONESTA',[{pagina:2,texto:'DEC-001'}],{apiKey:'test',fetch:fake as typeof fetch});
    expect(res.limites.esperarMs).toBe(1750);
  });
});
