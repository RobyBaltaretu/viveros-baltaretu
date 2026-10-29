/**
 * Comprueba que el build desde D1 genera la misma web que el build desde los
 * archivos: mismas páginas, sitemap y JSON-LD (la web desde el panel es idéntica a la de los archivos).
 * Importa el contenido a una D1 local vacía, lo exporta como haría el build y compara.
 * Con WORKERS_CI_BRANCH=pruebas incluye las fichas de ejemplo.
 *
 * Red de seguridad: el primer build se compara además con la línea base de
 * Viveros Baltaretu (`tests/baseline/web-produccion.json` o `web-pruebas.json`).
 * Solo se actualiza a propósito, en un PR que explique el cambio:
 * `npm run baseline:actualizar`.
 */
import { execSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportarPublicado, faltantes } from '../../src/server/contenido/exportacion.ts';
import { importarContenido, type EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { escribirContenido, leerContenido } from './archivos.mjs';
import { compararBaseline, compararHuellas, huellaBuild, resumenBaseline } from './huella-build.mjs';
import { reposLocales } from './plataforma.ts';

const raiz = process.cwd();
const build = () => execSync('npx astro build', { stdio: 'ignore', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
const copia = await mkdtemp(join(tmpdir(), 'equivalencia-'));
await cp('src/content', join(copia, 'content'), { recursive: true });
await cp('src/assets', join(copia, 'assets'), { recursive: true });

const modo = process.env.WORKERS_CI_BRANCH ? 'pruebas' : 'produccion';
const rutaBaseline = `tests/baseline/web-${modo}.json`;
let difs: string[] | undefined;
let difsBaseline: string[] = [];
try {
  build();
  const antes = await huellaBuild('dist');
  const resumen = resumenBaseline(antes);
  if (process.env.BASELINE_ACTUALIZAR) await writeFile(rutaBaseline, `${JSON.stringify(resumen, null, 1)}\n`);
  else difsBaseline = compararBaseline(JSON.parse(await readFile(rutaBaseline, 'utf8')), resumen);
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
  console.log(JSON.stringify({ modo, archivos: Object.keys(antes.archivos).length, paginasConJsonLd: Object.keys(antes.jsonLd).length, diferencias: difs, cambiosFrenteALaBase: difsBaseline }));
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
if (difsBaseline.length) {
  console.error(`La web de Viveros Baltaretu ha cambiado frente a ${rutaBaseline}:\n- ${difsBaseline.join('\n- ')}\nSi el cambio es a propósito y lo ha aprobado el propietario, ejecuta npm run baseline:actualizar y explícalo en el PR.`);
  process.exit(1);
}
