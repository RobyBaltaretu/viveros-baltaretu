import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { crearEsquemaEspecie } from './lib/catalogo/schema';
import { esquemaEmpresa } from './lib/empresa/schema';
import { esquemaPortada } from './lib/portada/schema';

const catalogo = defineCollection({
  // El id de cada entrada es el campo `slug` del frontmatter.
  loader: glob({ pattern: '*.md', base: './src/content/catalogo' }),
  schema: ({ image }) => crearEsquemaEspecie(image()),
});

// Singletons editados desde el panel: un archivo YAML por colección (id = nombre del archivo).
const empresa = defineCollection({
  loader: glob({ pattern: 'empresa.yaml', base: './src/content/ajustes' }),
  schema: esquemaEmpresa,
});

const portada = defineCollection({
  loader: glob({ pattern: 'portada.yaml', base: './src/content/ajustes' }),
  schema: esquemaPortada,
});

export const collections = { catalogo, empresa, portada };
