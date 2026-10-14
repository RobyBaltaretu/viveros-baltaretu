/**
 * Importa el contenido de `src/content` y las fotos de `src/assets` a D1.
 *   npm run contenido:importar                 → D1 local (desarrollo)
 *   npm run contenido:importar -- --url <web>  → base real, a través del Worker (necesita CONTENIDO_TOKEN)
 */
import type { EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { leerContenido } from './archivos.mjs';
import { cargar } from './cargar.ts';
import { argumento } from './plataforma.ts';

const { entradas, fotos } = await leerContenido(process.cwd());
const lista = entradas.map((e) => ({ coleccion: e.coleccion, id: e.id, documento: { datos: e.datos, cuerpo: e.cuerpo } })) as EntradaImportada[];
const informe = await cargar(lista, fotos, argumento('url'));
console.log(JSON.stringify({ ...informe, fotos: fotos.length }, null, 1));
if (!informe.importadas) process.exitCode = 1;
