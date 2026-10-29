/**
 * Huella de un build: hash de cada archivo de `dist/client`, más el sitemap,
 * el robots.txt y los bloques JSON-LD por página. Sirve para comprobar que dos
 * builds generan la misma web y, con `resumenBaseline`, que la web de Viveros
 * Baltaretu no cambia respecto a la línea base de `tests/baseline/`.
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
  const paginas = {};
  let sitemap = '';
  let robots = '';
  for (const ruta of await listar(raiz)) {
    const rel = relative(raiz, ruta);
    const datos = await readFile(ruta);
    archivos[rel] = createHash('sha256').update(datos).digest('hex');
    if (rel === 'sitemap.xml') sitemap = datos.toString('utf8');
    if (rel === 'robots.txt') robots = datos.toString('utf8');
    if (rel.endsWith('.html')) {
      paginas[rel] = sha(normalizarHtml(datos.toString('utf8')));
      const bloques = [...datos.toString('utf8').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      if (bloques.length) jsonLd[rel] = bloques;
    }
  }
  return { archivos, sitemap, robots, jsonLd, paginas };
}

const sha = (datos) => createHash('sha256').update(datos).digest('hex');

/** El año del pie (© AAAA) cambia solo cada 1 de enero: no cuenta como cambio de la web. */
const normalizarHtml = (html) => html.replace(/© \d{4} /g, '© AAAA ');

/** Archivos de texto cuyo contenido se compara; del resto (imágenes, fuentes) solo cuenta que estén. */
const TEXTO = /\.(css|js|mjs|json|xml|txt|svg|webmanifest)$|(^|\/)(_headers|_redirects|\.assetsignore)$/;

/**
 * Lo que se guarda en `tests/baseline/web-*.json`: rutas generadas, huella del
 * HTML de cada página, de los demás archivos de texto y del JSON-LD, y el
 * sitemap y el robots.txt enteros (para ver la diferencia a simple vista).
 * Las imágenes y fuentes solo cuentan por su nombre (que ya lleva el hash de su
 * origen), porque su codificación puede variar entre máquinas.
 */
export function resumenBaseline(h) {
  const rutas = Object.keys(h.archivos).sort();
  return {
    rutas,
    paginas: h.paginas,
    textos: Object.fromEntries(rutas.filter((r) => !r.endsWith('.html') && TEXTO.test(r)).map((r) => [r, h.archivos[r]])),
    jsonLd: Object.fromEntries(Object.entries(h.jsonLd).map(([r, b]) => [r, sha(JSON.stringify(b))])),
    sitemap: h.sitemap.split(/(?=<url>)/),
    robots: h.robots.split('\n'),
  };
}

/** Diferencias con la línea base (vacío = la web es la misma). */
export function compararBaseline(base, actual) {
  const difs = [];
  for (const r of [...new Set([...base.rutas, ...actual.rutas])].sort()) {
    if (!base.rutas.includes(r)) difs.push(`ruta nueva ${r}`);
    else if (!actual.rutas.includes(r)) difs.push(`falta la ruta ${r}`);
  }
  for (const campo of ['paginas', 'textos']) {
    for (const r of Object.keys(base[campo])) if (r in actual[campo] && base[campo][r] !== actual[campo][r]) difs.push(`cambia ${r}`);
  }
  for (const r of Object.keys({ ...base.jsonLd, ...actual.jsonLd }).sort()) if (base.jsonLd[r] !== actual.jsonLd[r]) difs.push(`JSON-LD distinto en ${r}`);
  if (JSON.stringify(base.sitemap) !== JSON.stringify(actual.sitemap)) difs.push('sitemap.xml distinto');
  if (JSON.stringify(base.robots) !== JSON.stringify(actual.robots)) difs.push('robots.txt distinto');
  return difs;
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
  if (a.robots !== b.robots) difs.push('robots.txt distinto');
  if (JSON.stringify(a.jsonLd) !== JSON.stringify(b.jsonLd)) difs.push('JSON-LD distinto');
  return difs;
}
