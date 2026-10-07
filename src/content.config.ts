import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { crearEsquemaEspecie } from './lib/catalogo/schema';
import { esquemaTextosCatalogo } from './lib/catalogo/textos-schema';
import { esquemaEmpresa } from './lib/empresa/schema';
import { esquemaPortada } from './lib/portada/schema';
import { crearEsquemaProyecto, esquemaGuia, esquemaPagina } from './lib/paginas/schema';

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

const textosCatalogo = defineCollection({
  loader: glob({ pattern: 'catalogo.yaml', base: './src/content/ajustes' }),
  schema: esquemaTextosCatalogo,
});

const paginas = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/paginas' }),
  schema: esquemaPagina,
});

const proyectos = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/proyectos' }),
  schema: ({ image }) => crearEsquemaProyecto(image()),
});

const guias = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/guias' }),
  schema: esquemaGuia,
});

export const collections = { catalogo, empresa, portada, textosCatalogo, paginas, proyectos, guias };
