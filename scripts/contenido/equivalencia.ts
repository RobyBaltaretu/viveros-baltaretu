/**
 * Comprueba que el build desde D1 genera la misma web que el build desde los
 * archivos: mismas páginas, sitemap y JSON-LD (la web desde el panel es idéntica a la de los archivos).
 * Importa el contenido a una D1 local vacía, lo exporta como haría el build y compara.
 * Con WORKERS_CI_BRANCH=pruebas incluye las fichas de ejemplo.
 */
import { execSync } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportarPublicado, faltantes } from '../../src/server/contenido/exportacion.ts';
import { importarContenido, type EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { escribirContenido, leerContenido } from './archivos.mjs';
import { compararHuellas, huellaBuild } from './huella-build.mjs';
import { reposLocales } from './plataforma.ts';

const raiz = process.cwd();
const build = () => execSync('npx astro build', { stdio: 'ignore', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
const copia = await mkdtemp(join(tmpdir(), 'equivalencia-'));
await cp('src/content', join(copia, 'content'), { recursive: true });
await cp('src/assets', join(copia, 'assets'), { recursive: true });

let difs: string[] | undefined;
try {
  build();
  const antes = await huellaBuild('dist');
  const { entradas, fotos } = await leerContenido(raiz);
  const { repos, cerrar } = await reposLocales({ persistir: false });
  try {
    for (const f of fotos) await repos.fotos.guardar({ ruta: f.ruta, tipo: 'image/jpeg', bytes: f.bytes }, 'equivalencia');
    const lista = entradas.map((e) => ({ coleccion: e.coleccion, id: e.id, documento: { datos: e.datos, cuerpo: e.cuerpo } })) as EntradaImportada[];
    const informe = await importarContenido(repos, lista, new Set(fotos.map((f) => f.ruta)), 'equivalencia');
    if (!informe.importadas) throw new Error(`Importación rechazada: ${JSON.stringify(informe)}`);
    const exportacion = await exportarPublicado(repos);
    if (faltantes(exportacion).length) throw new Error(`Faltan: ${faltantes(exportacion)}`);
    const bytes = [];
    for (const ruta of exportacion.fotos) bytes.push({ ruta, bytes: (await repos.fotos.obtener(ruta))!.bytes });
    await escribirContenido(raiz, { entradas: exportacion.entradas, fotos: bytes });
  } finally {
    await cerrar();
  }
  build();
  difs = compararHuellas(antes, await huellaBuild('dist'));
  console.log(JSON.stringify({ archivos: Object.keys(antes.archivos).length, paginasConJsonLd: Object.keys(antes.jsonLd).length, diferencias: difs }));
} finally {
  await rm('src/content', { recursive: true, force: true });
  await rm('src/assets', { recursive: true, force: true });
  await cp(join(copia, 'content'), 'src/content', { recursive: true });
  await cp(join(copia, 'assets'), 'src/assets', { recursive: true });
  await rm(copia, { recursive: true, force: true });
}
if (!difs || difs.length) {
  console.error('El build desde D1 no es igual al build desde los archivos.');
  process.exit(1);
}
