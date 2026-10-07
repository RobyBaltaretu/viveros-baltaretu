import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { z } from 'astro/zod';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { crearEsquemaEspecie } from '../src/lib/catalogo/schema';

const DIRECTORIO = join(import.meta.dirname, '../src/content/catalogo');
// En los tests las fotos se validan como rutas de texto; en el build se usa image() de Astro.
const esquema = crearEsquemaEspecie(z.string());

function leerFrontmatter(ruta: string): Record<string, unknown> {
  const contenido = readFileSync(ruta, 'utf8');
  const coincidencia = contenido.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!coincidencia) throw new Error(`Sin frontmatter: ${ruta}`);
  return parse(coincidencia[1]);
}

const fichas = readdirSync(DIRECTORIO)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ archivo: f, datos: leerFrontmatter(join(DIRECTORIO, f)) }));

const valida = fichas[0]!.datos;

describe('fichas del catálogo', () => {
  it('hay al menos 10 fichas', () => {
    expect(fichas.length).toBeGreaterThanOrEqual(10);
  });

  it.each(fichas)('$archivo cumple el esquema', ({ datos }) => {
    const resultado = esquema.safeParse(datos);
    expect(resultado.error?.issues ?? []).toEqual([]);
  });

  it.each(fichas)('$archivo: el nombre del archivo coincide con el slug', ({ archivo, datos }) => {
    expect(basename(archivo, '.md')).toBe(datos.slug);
  });

  it('los slugs son únicos', () => {
    const slugs = fichas.map((f) => f.datos.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('los datos de ejemplo no están marcados como revisados', () => {
    for (const { datos } of fichas.filter((f) => f.datos.datosDeEjemplo === true)) {
      expect(datos.revisado).toBe(false);
    }
  });
});

describe('esquema de especie', () => {
  const rechaza = (cambios: Record<string, unknown>) =>
    expect(esquema.safeParse({ ...valida, ...cambios }).success).toBe(false);

  it('rechaza una familia desconocida', () => rechaza({ familia: 'cactus' }));
  it('rechaza una disponibilidad desconocida', () => rechaza({ disponibilidad: 'pronto' }));
  it('rechaza un formato desconocido', () => rechaza({ formatos: ['maceta'] }));
  it('rechaza un slug con mayúsculas o espacios', () => rechaza({ slug: 'Palmera Canaria' }));
  it('rechaza textos sin traducción', () => rechaza({ nombre: { es: 'Palmito' } }));
  it('rechaza alturaMin mayor que alturaMax', () => rechaza({ alturaMin: 5, alturaMax: 2 }));
  it('rechaza un perímetro con un solo valor', () => rechaza({ perimetroTroncoCm: [20] }));
  it('rechaza un perímetro invertido', () => rechaza({ perimetroTroncoCm: [50, 20] }));
  it('rechaza una foto sin texto alternativo', () =>
    rechaza({ fotos: [{ imagen: 'foto.jpg', alt: { es: '', en: '' } }] }));

  it('acepta una ficha sin precio ni perímetro', () => {
    const { precioDesde, perimetroTroncoCm, ...resto } = valida;
    const resultado = esquema.parse({ ...resto, perimetroTroncoCm: [] });
    expect(resultado.precioDesde).toBeUndefined();
    expect(resultado.perimetroTroncoCm).toBeUndefined();
  });

  it('por defecto una ficha no está revisada', () => {
    const { revisado, ...resto } = valida;
    expect(esquema.parse(resto).revisado).toBe(false);
  });
});

describe('campo silueta', () => {
  const esquema2 = crearEsquemaEspecie(z.string());
  const base = fichas[0]!.datos;
  it('vacío (como lo guarda el panel) equivale a "según la familia"', () => {
    expect(esquema2.parse({ ...base, silueta: '' }).silueta).toBeUndefined();
  });
  it('rechaza un dibujo desconocido', () => {
    expect(esquema2.safeParse({ ...base, silueta: 'cactus' }).success).toBe(false);
  });
});

describe('rutas del catálogo', () => {
  it('ninguna ficha usa el mismo slug que una familia (comparten /catalogo/<slug>/)', async () => {
    const { slugFamilia } = await import('../src/i18n/ui');
    const deFamilias = Object.values(slugFamilia).flatMap((s) => [s.es, s.en]);
    for (const { datos } of fichas) expect(deFamilias).not.toContain(datos.slug);
  });
});
