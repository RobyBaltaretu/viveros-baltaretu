import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';
import keystaticConfig from '../keystatic.config';
import { DISPONIBILIDADES, FAMILIAS, FORMATOS, UNIDADES_PRECIO, crearEsquemaEspecie } from '../src/lib/catalogo/schema';

// El panel (Keystatic) y el esquema que valida el build (Zod) deben describir los mismos campos.
const coleccion = keystaticConfig.collections!.catalogo!;
const campos = coleccion.schema as Record<string, { options?: readonly { value: string }[] }>;
const opciones = (campo: string) => campos[campo]!.options!.map((o) => o.value);

describe('configuración de Keystatic', () => {
  it('edita los archivos del catálogo existentes', () => {
    expect(coleccion.path).toBe('src/content/catalogo/*');
    expect(coleccion.slugField).toBe('slug');
  });

  it('tiene todos los campos del esquema del catálogo', () => {
    const esquema = crearEsquemaEspecie(z.string());
    const camposEsquema = Object.keys(esquema.shape);
    const camposPanel = Object.keys(campos).filter((c) => c !== 'contenido');
    expect(camposPanel.sort()).toEqual(camposEsquema.sort());
  });

  it('ofrece los mismos valores que el esquema', () => {
    expect(opciones('familia')).toEqual([...FAMILIAS]);
    expect(opciones('disponibilidad')).toEqual([...DISPONIBILIDADES]);
    expect(opciones('formatos').sort()).toEqual([...FORMATOS].sort());
    expect(opciones('unidadPrecio')).toEqual([...UNIDADES_PRECIO]);
  });
});

describe('singleton Empresa', () => {
  it('escribe en src/content/ajustes/empresa.yaml con los campos del esquema', async () => {
    const { esquemaEmpresa } = await import('../src/lib/empresa/schema');
    const empresa = keystaticConfig.singletons!.empresa!;
    expect(empresa.path).toBe('src/content/ajustes/empresa');
    expect(Object.keys(empresa.schema).sort()).toEqual(Object.keys(esquemaEmpresa.shape).sort());
  });

  it('el archivo actual cumple el esquema', async () => {
    const { readFileSync } = await import('node:fs');
    const { parse } = await import('yaml');
    const { esquemaEmpresa } = await import('../src/lib/empresa/schema');
    const datos = parse(readFileSync(new URL('../src/content/ajustes/empresa.yaml', import.meta.url), 'utf8'));
    expect(esquemaEmpresa.safeParse(datos).success).toBe(true);
  });
});

describe('singleton Condiciones de venta', () => {
  it('escribe en src/content/ajustes/condiciones.yaml con los campos del esquema y el archivo es válido', async () => {
    const { readFileSync } = await import('node:fs');
    const { parse } = await import('yaml');
    const { esquemaCondiciones } = await import('../src/lib/condiciones/schema');
    const condiciones = keystaticConfig.singletons!.condiciones!;
    expect(condiciones.path).toBe('src/content/ajustes/condiciones');
    expect(Object.keys(condiciones.schema).sort()).toEqual(Object.keys(esquemaCondiciones.shape).sort());
    const datos = parse(readFileSync(new URL('../src/content/ajustes/condiciones.yaml', import.meta.url), 'utf8'));
    expect(esquemaCondiciones.safeParse(datos).error?.issues ?? []).toEqual([]);
  });
});

describe('singleton Portada', () => {
  it('escribe en src/content/ajustes/portada.yaml con los campos del esquema', async () => {
    const { esquemaPortada } = await import('../src/lib/portada/schema');
    const portada = keystaticConfig.singletons!.portada!;
    expect(portada.path).toBe('src/content/ajustes/portada');
    expect(Object.keys(portada.schema).sort()).toEqual(Object.keys(esquemaPortada.shape).sort());
  });

  it('el archivo actual cumple el esquema', async () => {
    const { readFileSync } = await import('node:fs');
    const { parse } = await import('yaml');
    const { esquemaPortada } = await import('../src/lib/portada/schema');
    const datos = parse(readFileSync(new URL('../src/content/ajustes/portada.yaml', import.meta.url), 'utf8'));
    const resultado = esquemaPortada.safeParse(datos);
    expect(resultado.error?.issues ?? []).toEqual([]);
  });
});

describe('singleton Textos del catálogo', () => {
  it('cubre el catálogo y todas las familias, y el archivo cumple el esquema', async () => {
    const { readFileSync } = await import('node:fs');
    const { parse } = await import('yaml');
    const { FAMILIAS } = await import('../src/lib/catalogo/schema');
    const singleton = keystaticConfig.singletons!.textosCatalogo!;
    expect(singleton.path).toBe('src/content/ajustes/catalogo');
    expect(Object.keys(singleton.schema).sort()).toEqual(['catalogo', ...FAMILIAS].sort());
    const datos = parse(readFileSync(new URL('../src/content/ajustes/catalogo.yaml', import.meta.url), 'utf8'));
    expect(Object.keys(datos).sort()).toEqual(['catalogo', ...FAMILIAS].sort());
  });
});

describe('páginas, proyectos y guías', () => {
  it('cada página fija tiene su singleton y su archivo válido', async () => {
    const { readFileSync } = await import('node:fs');
    const { parse } = await import('yaml');
    const { PAGINAS, esquemaPagina } = await import('../src/lib/paginas/schema');
    const rutas = Object.values(keystaticConfig.singletons!).map((s) => s.path);
    for (const clave of PAGINAS) {
      expect(rutas).toContain(`src/content/paginas/${clave}`);
      const datos = parse(readFileSync(new URL(`../src/content/paginas/${clave}.yaml`, import.meta.url), 'utf8'));
      expect(esquemaPagina.safeParse(datos).error?.issues ?? []).toEqual([]);
    }
  });

  it('proyectos y guías: mismos campos en el panel y en el esquema, y ejemplos válidos', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { parse } = await import('yaml');
    const { crearEsquemaProyecto, esquemaGuia } = await import('../src/lib/paginas/schema');
    const esquemas = { proyectos: crearEsquemaProyecto(z.string()), guias: esquemaGuia };
    for (const [nombre, esquema] of Object.entries(esquemas)) {
      const coleccion = keystaticConfig.collections![nombre as 'proyectos' | 'guias']!;
      expect(Object.keys(coleccion.schema).sort()).toEqual(Object.keys(esquema.shape).sort());
      const dir = new URL(`../src/content/${nombre}/`, import.meta.url);
      for (const archivo of readdirSync(dir)) {
        const datos = parse(readFileSync(new URL(archivo, dir), 'utf8'));
        expect(esquema.safeParse(datos).error?.issues ?? []).toEqual([]);
        expect(archivo).toBe(`${datos.slug}.yaml`);
      }
    }
  });
});
