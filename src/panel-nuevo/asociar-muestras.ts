import type { MuestraPDF } from './muestras-pdf';

/** Empareja solo referencias iguales y acabados compatibles. No adivina por nombre/color. */
export type MaterialParaMuestra = {
  codigoDecor?: string | null;
  referencia?: string | null;
  acabado?: string | null;
  pagina: number;
};

const codigo = (texto: string) => {
  const valor = texto.trim().toUpperCase();
  return /^\d{3}$/.test(valor) ? valor.padStart(4, '0') : valor;
};
const acabados = (texto: string) => texto.toUpperCase().trim()
  .split(/\s*[\/+;,]\s*/).map(x => x.trim()).filter(Boolean);

/**
 * Una muestra puede estar en la carta de colores varias páginas después de
 * la tabla dimensional. Se limita a la sección cercana (12 páginas), sin
 * exigir una distancia artificial de dos páginas.
 *
 * Acabados compuestos como MA/SC representan alternativas comerciales.
 * Preferimos la primera explícita (MA) para la previsualización, manteniendo
 * la posibilidad de sustituir la textura manualmente.
 */
export function asociarMuestraMaterial(
  articulo: MaterialParaMuestra,
  muestras: readonly MuestraPDF[],
  maxDistancia = 12,
): MuestraPDF | null {
  const clave = codigo(String(articulo.codigoDecor || articulo.referencia || ''));
  if (!clave || !Number.isInteger(articulo.pagina)) return null;
  const variantes = acabados(String(articulo.acabado || ''));
  const opciones = muestras.filter(m => codigo(m.codigo) === clave
    && Math.abs(m.pagina - articulo.pagina) <= maxDistancia
    && (!m.acabado || variantes.includes(m.acabado.toUpperCase().trim())));

  if (!opciones.length) return null;
  // No se debe escoger una muestra de acabado desconocido entre varios
  // acabados incompatibles del mismo código.
  if (!variantes.length && new Set(opciones.map(m => m.acabado || '')).size > 1) return null;

  opciones.sort((a,b) => {
    const prioridad = (m:MuestraPDF) =>
      variantes.indexOf(m.acabado?.toUpperCase().trim() || '');
    const x = prioridad(a), y = prioridad(b);
    const pa = x < 0 ? variantes.length + 1 : x;
    const pb = y < 0 ? variantes.length + 1 : y;
    return pa-pb || Math.abs(a.pagina-articulo.pagina)-Math.abs(b.pagina-articulo.pagina);
  });
  return opciones[0] ?? null;
}
