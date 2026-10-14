/**
 * Restaura una copia de seguridad (`npm run contenido:copia` o la acción diaria).
 *   npm run contenido:restaurar -- copia.json                → D1 local, para revisarla
 *   npm run contenido:restaurar -- copia.json --url <web>    → base real (necesita CONTENIDO_TOKEN)
 * Se carga como publicado; para que salga en la web hay que lanzar un build.
 */
import { readFile } from 'node:fs/promises';
import { deBase64, leerCopia } from '../../src/server/contenido/copia.ts';
import type { EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { cargar } from './cargar.ts';
import { argumento } from './plataforma.ts';

const archivo = process.argv[2];
if (!archivo || archivo.startsWith('--')) throw new Error('Indica el archivo de la copia.');
const copia = leerCopia(await readFile(archivo, 'utf8'));
const entradas = copia.entradas.map((e) => ({ coleccion: e.coleccion, id: e.id, documento: { datos: e.datos, cuerpo: e.cuerpo } })) as EntradaImportada[];
const informe = await cargar(entradas, copia.fotos.map((f) => ({ ruta: f.ruta, bytes: deBase64(f.base64) })), argumento('url'));
console.log(JSON.stringify({ copiaDel: copia.fecha, ...informe }, null, 1));
if (!informe.importadas) process.exitCode = 1;
