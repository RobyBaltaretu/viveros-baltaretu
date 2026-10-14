/**
 * Copia de seguridad del contenido publicado de la web real (la usa la acción diaria).
 *   npm run contenido:copia -- --url <web> --salida copia.json   (necesita CONTENIDO_TOKEN)
 */
import { writeFile } from 'node:fs/promises';
import { crearCopia } from '../../src/server/contenido/copia.ts';
import type { Exportacion } from '../../src/server/contenido/exportacion.ts';
import { argumento } from './plataforma.ts';

const url = argumento('url');
const salida = argumento('salida') ?? 'copia-contenido.json';
const token = process.env.CONTENIDO_TOKEN;
if (!url || !token) {
  console.log('::notice::Copia no hecha: faltan la dirección de la web o el secreto CONTENIDO_TOKEN.');
  process.exit(0);
}
const cabeceras = { Authorization: `Bearer ${token}` };
const r = await fetch(new URL('/api/contenido/exportacion', url), { headers: cabeceras });
if (!r.ok) throw new Error(`La exportación respondió ${r.status}`);
const copia = await crearCopia((await r.json()) as Exportacion, async (ruta) => {
  const f = await fetch(new URL(`/api/contenido/foto?ruta=${encodeURIComponent(ruta)}`, url), { headers: cabeceras });
  return f.ok ? new Uint8Array(await f.arrayBuffer()) : null;
});
await writeFile(salida, JSON.stringify(copia));
console.log(`Copia: ${copia.entradas.length} entradas y ${copia.fotos.length} fotos → ${salida}`);
