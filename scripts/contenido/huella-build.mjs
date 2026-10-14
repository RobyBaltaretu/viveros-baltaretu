/**
 * Huella de un build: hash de cada archivo de `dist/client`, más el sitemap y
 * los bloques JSON-LD por página. Sirve para comprobar que dos builds generan
 * la misma web.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

async function listar(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const r = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listar(r)));
    else out.push(r);
  }
  return out.sort();
}

export async function huellaBuild(dist) {
  const raiz = join(dist, 'client');
  const archivos = {};
  const jsonLd = {};
  let sitemap = '';
  for (const ruta of await listar(raiz)) {
    const rel = relative(raiz, ruta);
    const datos = await readFile(ruta);
    archivos[rel] = createHash('sha256').update(datos).digest('hex');
    if (rel === 'sitemap.xml') sitemap = datos.toString('utf8');
    if (rel.endsWith('.html')) {
      const bloques = [...datos.toString('utf8').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      if (bloques.length) jsonLd[rel] = bloques;
    }
  }
  return { archivos, sitemap, jsonLd };
}

/** Diferencias legibles entre dos huellas (vacío = mismas páginas, sitemap y JSON-LD). */
export function compararHuellas(a, b) {
  const difs = [];
  const rutas = new Set([...Object.keys(a.archivos), ...Object.keys(b.archivos)]);
  for (const r of [...rutas].sort()) {
    if (!(r in a.archivos)) difs.push(`sobra ${r}`);
    else if (!(r in b.archivos)) difs.push(`falta ${r}`);
    else if (a.archivos[r] !== b.archivos[r]) difs.push(`distinto ${r}`);
  }
  if (a.sitemap !== b.sitemap) difs.push('sitemap distinto');
  if (JSON.stringify(a.jsonLd) !== JSON.stringify(b.jsonLd)) difs.push('JSON-LD distinto');
  return difs;
}
