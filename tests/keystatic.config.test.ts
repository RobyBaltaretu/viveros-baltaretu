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
