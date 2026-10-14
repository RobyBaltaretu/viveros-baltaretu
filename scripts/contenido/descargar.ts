/**
 * Antes de cada build: si están `CONTENIDO_TOKEN` y la URL de la web, descarga
 * el contenido publicado desde el panel (D1) y lo escribe en `src/content` y
 * `src/assets`. Sin token, el build usa los archivos del repositorio
 * (desarrollo, CI y hasta que se active el panel). Si hay token y algo falla,
 * el build se detiene: nunca se construye una web vacía o a medias.
 */
import { faltantes, type Exportacion } from '../../src/server/contenido/exportacion.ts';
import { esRutaFotoValida } from '../../src/server/contenido/validacion.ts';
import { escribirContenido } from './archivos.mjs';

const token = process.env.CONTENIDO_TOKEN;
const url = process.env.CONTENIDO_URL || process.env.SITE_URL;

if (!token) {
  console.log('[contenido] Sin CONTENIDO_TOKEN: se construye con los archivos del repositorio.');
} else {
  if (!url) throw new Error('[contenido] Falta CONTENIDO_URL o SITE_URL para descargar el contenido.');
  const cabeceras = { Authorization: `Bearer ${token}` };
  const r = await fetch(new URL('/api/contenido/exportacion', url), { headers: cabeceras });
  if (!r.ok) throw new Error(`[contenido] La exportación respondió ${r.status}: ${await r.text()}`);
  const exportacion = (await r.json()) as Exportacion;
  const falta = faltantes(exportacion);
  if (falta.length) throw new Error(`[contenido] Faltan entradas obligatorias: ${falta.join(', ')}. ¿Se importó el contenido?`);
  const fotos = [];
  for (const ruta of exportacion.fotos) {
    if (!esRutaFotoValida(ruta)) throw new Error(`[contenido] Ruta de foto no válida: ${ruta}`);
    const f = await fetch(new URL(`/api/contenido/foto?ruta=${encodeURIComponent(ruta)}`, url), { headers: cabeceras });
    if (!f.ok) throw new Error(`[contenido] No se pudo descargar ${ruta}: ${f.status}`);
    fotos.push({ ruta, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  await escribirContenido(process.cwd(), { entradas: exportacion.entradas, fotos });
  console.log(`[contenido] Descargadas ${exportacion.entradas.length} entradas y ${fotos.length} fotos del panel.`);
}
