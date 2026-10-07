import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { crearEsquemaEspecie } from './lib/catalogo/schema';

const catalogo = defineCollection({
  // El id de cada entrada es el campo `slug` del frontmatter.
  loader: glob({ pattern: '*.md', base: './src/content/catalogo' }),
  schema: ({ image }) => crearEsquemaEspecie(image()),
});

export const collections = { catalogo };
