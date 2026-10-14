import type { Repositorios } from '../data/tipos.ts';
import { PREFIJO_FOTO, type ErrorCampo } from '../contenido/validacion.ts';
import { guardarPlanta, type DatosPlanta } from './plantas.ts';

/**
 * Fotos de las plantas. Se guardan en D1 (ver decisiones.md, punto 1) con una
 * ruta bajo `catalogo/<planta>/`, la misma que tendrán en `src/assets` al construir la web.
 */
export const MAXIMO_FOTO = 1_900_000;

const FIRMAS: { tipo: string; ext: string; es: (b: Uint8Array) => boolean }[] = [
  { tipo: 'image/jpeg', ext: 'jpg', es: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { tipo: 'image/png', ext: 'png', es: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { tipo: 'image/webp', ext: 'webp', es: (b) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP' },
];

/** Tipo de imagen por su contenido (no por el nombre del archivo). */
export const tipoDeImagen = (bytes: Uint8Array) => FIRMAS.find((f) => bytes.length > 12 && f.es(bytes)) ?? null;

export interface FotoFicha {
  imagen: string;
  alt: { es: string; en: string };
}

export const fotosDeFicha = (d: DatosPlanta): FotoFicha[] => (Array.isArray(d.fotos) ? (d.fotos as FotoFicha[]) : []);

/** Texto alternativo propuesto para revisar (el gerente puede cambiarlo). */
export function altPropuesto(d: DatosPlanta) {
  return { es: `${d.nombre?.es ?? 'Planta'} en el vivero`, en: `${d.nombre?.en ?? d.nombre?.es ?? 'Plant'} at the nursery` };
}

/** Ruta relativa a `src/assets` a partir de la referencia de la ficha. */
export const rutaDeImagen = (imagen: string) => (imagen.startsWith(PREFIJO_FOTO) ? imagen.slice(PREFIJO_FOTO.length) : imagen);

type Resultado = { ok: true } | { ok: false; errores: ErrorCampo[] };
const error = (mensaje: string): Resultado => ({ ok: false, errores: [{ campo: 'foto', mensaje }] });

export async function subirFoto(repos: Repositorios, id: string, d: DatosPlanta, bytes: Uint8Array, email: string): Promise<Resultado> {
  if (bytes.byteLength === 0) return error('Elige una foto.');
  if (bytes.byteLength > MAXIMO_FOTO) return error('La foto es demasiado grande. Prueba con otra o hazla de nuevo con el móvil.');
  const tipo = tipoDeImagen(bytes);
  if (!tipo) return error('Ese archivo no es una foto. Usa una foto JPG, PNG o WebP.');
  const ruta = `catalogo/${id}/foto-${Date.now().toString(36)}.${tipo.ext}`;
  await repos.fotos.guardar({ ruta, tipo: tipo.tipo, bytes }, email);
  const datos = { ...d, fotos: [...fotosDeFicha(d), { imagen: PREFIJO_FOTO + ruta, alt: altPropuesto(d) }] };
  return guardarPlanta(repos, id, datos, { email });
}

/** Quitar, poner primera o cambiar el texto de una foto. Las fotos quitadas siguen en la base (se puede deshacer). */
export async function cambiarFoto(
  repos: Repositorios,
  id: string,
  d: DatosPlanta,
  indice: number,
  accion: 'quitar' | 'primera' | 'texto',
  email: string,
  texto?: { es: string; en: string },
): Promise<Resultado> {
  const fotos = [...fotosDeFicha(d)];
  if (!Number.isInteger(indice) || indice < 0 || indice >= fotos.length) return error('Esa foto ya no está.');
  if (accion === 'quitar') fotos.splice(indice, 1);
  if (accion === 'primera') fotos.unshift(...fotos.splice(indice, 1));
  if (accion === 'texto') {
    if (!texto?.es.trim() || !texto.en.trim()) return error('Escribe qué se ve en la foto, en español y en inglés.');
    fotos[indice] = { ...fotos[indice], alt: { es: texto.es.trim().slice(0, 200), en: texto.en.trim().slice(0, 200) } };
  }
  return guardarPlanta(repos, id, { ...d, fotos }, { email });
}
