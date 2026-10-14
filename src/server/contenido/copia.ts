import type { Exportacion } from './exportacion.ts';

/**
 * Copia de seguridad del contenido publicado (sin presupuestos: son datos
 * personales y ya llegan por email). Un único JSON con las fotos en base64.
 */
export interface Copia {
  version: 1;
  fecha: string;
  entradas: Exportacion['entradas'];
  fotos: { ruta: string; base64: string }[];
}

const aBase64 = (bytes: Uint8Array) => {
  let texto = '';
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(texto);
};
export const deBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function crearCopia(exportacion: Exportacion, foto: (ruta: string) => Promise<Uint8Array | null>): Promise<Copia> {
  const fotos = [];
  for (const ruta of exportacion.fotos) {
    const bytes = await foto(ruta);
    if (!bytes) throw new Error(`Falta la foto ${ruta}`);
    fotos.push({ ruta, base64: aBase64(bytes) });
  }
  return { version: 1, fecha: new Date().toISOString(), entradas: exportacion.entradas, fotos };
}

export function leerCopia(texto: string): Copia {
  const c = JSON.parse(texto) as Copia;
  if (c?.version !== 1 || !Array.isArray(c.entradas) || !Array.isArray(c.fotos)) throw new Error('Este archivo no es una copia del panel.');
  return c;
}
