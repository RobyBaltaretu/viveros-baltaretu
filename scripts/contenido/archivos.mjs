/**
 * Lectura y escritura del contenido en archivos (`src/content` y las fotos de
 * `src/assets`). Es el formato que lee Astro en el build: el contenido que
 * guarda el panel se vuelca aquí antes de construir la web.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
import YAML from 'yaml';

/** Colección del panel → carpeta y extensión en `src/content`. */
export const COLECCIONES = {
  catalogo: { carpeta: 'catalogo', ext: '.md' },
  ajustes: { carpeta: 'ajustes', ext: '.yaml' },
  paginas: { carpeta: 'paginas', ext: '.yaml' },
  proyectos: { carpeta: 'proyectos', ext: '.yaml' },
  guias: { carpeta: 'guias', ext: '.yaml' },
};

async function listar(dir) {
  const salida = [];
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return salida;
  }
  for (const e of entradas) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) salida.push(...(await listar(ruta)));
    else salida.push(ruta);
  }
  return salida.sort();
}

/** Separa el frontmatter de un Markdown. */
export function partirMarkdown(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(texto);
  if (!m) throw new Error('Markdown sin frontmatter');
  return { datos: YAML.parse(m[1]) ?? {}, cuerpo: m[2] };
}

export function serializarEntrada(coleccion, { datos, cuerpo }) {
  const yaml = YAML.stringify(datos, { lineWidth: 0 });
  return COLECCIONES[coleccion].ext === '.md' ? `---\n${yaml}---\n${cuerpo ?? ''}` : yaml;
}

/** Lee todo el contenido de `raiz` (la carpeta del proyecto). */
export async function leerContenido(raiz) {
  const entradas = [];
  for (const [coleccion, { carpeta, ext }] of Object.entries(COLECCIONES)) {
    for (const ruta of await listar(join(raiz, 'src/content', carpeta))) {
      if (!ruta.endsWith(ext)) continue;
      const id = relative(join(raiz, 'src/content', carpeta), ruta).slice(0, -ext.length);
      const texto = await readFile(ruta, 'utf8');
      const { datos, cuerpo } = ext === '.md' ? partirMarkdown(texto) : { datos: YAML.parse(texto) ?? {}, cuerpo: '' };
      entradas.push({ coleccion, id, datos, cuerpo });
    }
  }
  const fotos = [];
  for (const ruta of await listar(join(raiz, 'src/assets'))) {
    fotos.push({ ruta: relative(join(raiz, 'src/assets'), ruta), bytes: new Uint8Array(await readFile(ruta)) });
  }
  return { entradas, fotos };
}

/** Sustituye el contenido de `raiz` por el recibido (borra lo anterior). */
export async function escribirContenido(raiz, { entradas, fotos }) {
  for (const { carpeta } of Object.values(COLECCIONES)) await rm(join(raiz, 'src/content', carpeta), { recursive: true, force: true });
  await rm(join(raiz, 'src/assets'), { recursive: true, force: true });
  for (const e of entradas) {
    const { carpeta, ext } = COLECCIONES[e.coleccion];
    const ruta = join(raiz, 'src/content', carpeta, e.id + ext);
    await mkdir(dirname(ruta), { recursive: true });
    await writeFile(ruta, serializarEntrada(e.coleccion, e));
  }
  for (const f of fotos) {
    const ruta = join(raiz, 'src/assets', f.ruta);
    await mkdir(dirname(ruta), { recursive: true });
    await writeFile(ruta, f.bytes);
  }
}
