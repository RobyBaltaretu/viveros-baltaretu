/**
 * Encontrar la planta de la que habla el gerente aunque escriba con faltas o
 * sin tildes ("washintonia", "palmera canaria", "la cica").
 */
export const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const VACIAS = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'un', 'una', 'y', 'a', 'en', 'al']);
const palabras = (t: string) => normalizar(t).split(' ').filter((p) => p.length > 1 && !VACIAS.has(p));

function distancia(a: string, b: string): number {
  if (a === b) return 0;
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previa = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previa + (a[i - 1] === b[j - 1] ? 0 : 1));
      previa = temp;
    }
  }
  return fila[b.length];
}

/** Parecido de dos palabras entre 0 y 1 (tolera una o dos letras mal). */
function parecido(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length >= 4 && (b.startsWith(a) || a.startsWith(b))) return 0.9;
  const d = distancia(a, b);
  const max = Math.max(a.length, b.length);
  return d <= Math.max(1, Math.floor(max / 4)) ? 1 - d / max : 0;
}

export interface Candidato {
  id: string;
  nombres: string[];
}

/** Puntuación de un texto frente a los nombres de una planta (0 = nada que ver). */
export function puntuar(texto: string, c: Candidato): number {
  const buscadas = palabras(texto);
  if (!buscadas.length) return 0;
  let mejor = 0;
  for (const nombre of c.nombres) {
    const propias = palabras(nombre);
    if (!propias.length) continue;
    const suma = buscadas.reduce((s, b) => s + Math.max(0, ...propias.map((p) => parecido(b, p))), 0);
    // Se premia cubrir todas las palabras buscadas y casi todas las del nombre.
    const cobertura = suma / buscadas.length;
    const ajuste = Math.min(1, suma / propias.length);
    mejor = Math.max(mejor, cobertura * 0.75 + ajuste * 0.25);
  }
  return mejor;
}

export type Resolucion<T extends Candidato> = { tipo: 'una'; elegida: T } | { tipo: 'varias'; opciones: T[] } | { tipo: 'ninguna' };

/** La planta más probable, varias si hay empate, o ninguna. */
export function buscarPlanta<T extends Candidato>(texto: string, candidatos: T[]): Resolucion<T> {
  const exacta = candidatos.find((c) => c.id === texto);
  if (exacta) return { tipo: 'una', elegida: exacta };
  const puntuados = candidatos.map((c) => ({ c, p: puntuar(texto, c) })).filter((x) => x.p >= 0.6).sort((a, b) => b.p - a.p);
  if (!puntuados.length) return { tipo: 'ninguna' };
  const empatadas = puntuados.filter((x) => puntuados[0].p - x.p < 0.08);
  return empatadas.length === 1 ? { tipo: 'una', elegida: empatadas[0].c } : { tipo: 'varias', opciones: empatadas.slice(0, 5).map((x) => x.c) };
}
