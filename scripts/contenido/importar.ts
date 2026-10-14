/**
 * Importa el contenido de `src/content` y las fotos de `src/assets` a D1.
 *   npm run contenido:importar                 → D1 local (desarrollo)
 *   npm run contenido:importar -- --url <web>  → base real, a través del Worker (necesita CONTENIDO_TOKEN)
 */
import { importarContenido, type EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { esRutaFotoValida } from '../../src/server/contenido/validacion.ts';
import { leerContenido } from './archivos.mjs';
import { argumento, reposLocales } from './plataforma.ts';

const { entradas, fotos } = (await leerContenido(process.cwd())) as {
  entradas: { coleccion: EntradaImportada['coleccion']; id: string; datos: Record<string, unknown>; cuerpo: string }[];
  fotos: { ruta: string; bytes: Uint8Array }[];
};
const lista: EntradaImportada[] = entradas.map((e) => ({ coleccion: e.coleccion, id: e.id, documento: { datos: e.datos, cuerpo: e.cuerpo } }));
const validas = fotos.filter((f) => esRutaFotoValida(f.ruta));
const url = argumento('url');

if (url) {
  const token = process.env.CONTENIDO_TOKEN;
  if (!token) throw new Error('Falta la variable CONTENIDO_TOKEN');
  const cabeceras = { Authorization: `Bearer ${token}` };
  for (const f of validas) {
    const r = await fetch(new URL(`/api/contenido/foto?ruta=${encodeURIComponent(f.ruta)}`, url), { method: 'PUT', headers: cabeceras, body: new Blob([f.bytes as Uint8Array<ArrayBuffer>]) });
    if (!r.ok) throw new Error(`No se pudo subir ${f.ruta}: ${r.status} ${await r.text()}`);
  }
  const r = await fetch(new URL('/api/contenido/importacion', url), {
    method: 'POST',
    headers: { ...cabeceras, 'Content-Type': 'application/json' },
    body: JSON.stringify({ entradas: lista }),
  });
  console.log(r.status, await r.text());
  if (!r.ok) process.exit(1);
} else {
  const { repos, cerrar } = await reposLocales();
  try {
    for (const f of validas) await repos.fotos.guardar({ ruta: f.ruta, tipo: f.ruta.endsWith('.png') ? 'image/png' : 'image/jpeg', bytes: f.bytes }, 'importacion');
    const informe = await importarContenido(repos, lista, new Set(validas.map((f) => f.ruta)), 'importacion');
    console.log(JSON.stringify({ ...informe, fotos: validas.length }, null, 1));
    if (!informe.importadas) process.exitCode = 1;
  } finally {
    await cerrar();
  }
}
