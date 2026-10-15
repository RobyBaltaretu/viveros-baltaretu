import type { Repositorios } from '../data/tipos.ts';
import { PREFIJO_FOTO, type ErrorCampo } from '../contenido/validacion.ts';
import { guardarPlanta, type DatosPlanta } from './plantas.ts';
import { guardarTextos } from './textos.ts';

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

/** Colecciones con fotos: las plantas del catálogo y los proyectos. */
export type ColeccionConFotos = 'catalogo' | 'proyectos';

/** Texto alternativo propuesto para revisar (el gerente puede cambiarlo). */
export function altPropuesto(d: DatosPlanta, coleccion: ColeccionConFotos = 'catalogo') {
  if (coleccion === 'proyectos') {
    const t = (d as { titulo?: { es?: string; en?: string } }).titulo;
    return { es: `Proyecto: ${t?.es ?? ''}`.trim(), en: `Project: ${t?.en ?? t?.es ?? ''}`.trim() };
  }
  return { es: `${d.nombre?.es ?? 'Planta'} en el vivero`, en: `${d.nombre?.en ?? d.nombre?.es ?? 'Plant'} at the nursery` };
}

/** Guarda con la validación de la colección (catálogo o proyectos). */
function guardar(repos: Repositorios, coleccion: ColeccionConFotos, id: string, datos: DatosPlanta, email: string): Promise<Resultado> {
  return coleccion === 'catalogo' ? guardarPlanta(repos, id, datos, { email }) : guardarTextos(repos, coleccion, id, datos, '', { email });
}

/** Ruta relativa a `src/assets` a partir de la referencia de la ficha. */
export const rutaDeImagen = (imagen: string) => (imagen.startsWith(PREFIJO_FOTO) ? imagen.slice(PREFIJO_FOTO.length) : imagen);

type Resultado = { ok: true } | { ok: false; errores: ErrorCampo[] };
const error = (mensaje: string): Resultado => ({ ok: false, errores: [{ campo: 'foto', mensaje }] });

export async function subirFoto(repos: Repositorios, id: string, d: DatosPlanta, bytes: Uint8Array, email: string, coleccion: ColeccionConFotos = 'catalogo'): Promise<Resultado> {
  if (bytes.byteLength === 0) return error('Elige una foto.');
  if (bytes.byteLength > MAXIMO_FOTO) return error('La foto es demasiado grande. Prueba con otra o hazla de nuevo con el móvil.');
  const tipo = tipoDeImagen(bytes);
  if (!tipo) return error('Ese archivo no es una foto. Usa una foto JPG, PNG o WebP.');
  const ruta = `${coleccion}/${id}/foto-${Date.now().toString(36)}.${tipo.ext}`;
  await repos.fotos.guardar({ ruta, tipo: tipo.tipo, bytes }, email);
  const datos = { ...d, fotos: [...fotosDeFicha(d), { imagen: PREFIJO_FOTO + ruta, alt: altPropuesto(d, coleccion) }] };
  return guardar(repos, coleccion, id, datos, email);
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
  coleccion: ColeccionConFotos = 'catalogo',
): Promise<Resultado> {
  const fotos = [...fotosDeFicha(d)];
  if (!Number.isInteger(indice) || indice < 0 || indice >= fotos.length) return error('Esa foto ya no está.');
  if (accion === 'quitar') fotos.splice(indice, 1);
  if (accion === 'primera') fotos.unshift(...fotos.splice(indice, 1));
  if (accion === 'texto') {
    if (!texto?.es.trim() || !texto.en.trim()) return error('Escribe qué se ve en la foto, en español y en inglés.');
    fotos[indice] = { ...fotos[indice], alt: { es: texto.es.trim().slice(0, 200), en: texto.en.trim().slice(0, 200) } };
  }
  return guardar(repos, coleccion, id, { ...d, fotos }, email);
}

/** Acción del formulario de fotos (subir, quitar, poner primera o cambiar texto). */
export async function formularioFotos(repos: Repositorios, coleccion: ColeccionConFotos, id: string, d: DatosPlanta, form: FormData, email: string) {
  const accion = String(form.get('accion') ?? '');
  if (accion === 'subir') {
    const archivo = form.get('foto');
    const bytes = archivo instanceof File ? new Uint8Array(await archivo.arrayBuffer()) : new Uint8Array();
    return { accion, r: await subirFoto(repos, id, d, bytes, email, coleccion) };
  }
  if (accion === 'quitar' || accion === 'primera' || accion === 'texto') {
    const texto = { es: String(form.get('alt.es') ?? ''), en: String(form.get('alt.en') ?? '') };
    return { accion, r: await cambiarFoto(repos, id, d, Number(form.get('indice')), accion, email, texto, coleccion) };
  }
  return { accion, r: error('Acción desconocida.') };
}

export const MENSAJES_FOTOS: Record<string, string> = {
  subir: 'Foto subida. Revisa el texto que la describe.',
  quitar: 'Foto quitada.',
  primera: 'Ahora es la primera foto.',
  texto: 'Texto guardado.',
  nueva: 'Planta guardada. Ahora añade una foto.',
};
