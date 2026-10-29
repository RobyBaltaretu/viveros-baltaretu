/**
 * Fórmulas de las plantillas del catálogo («2 * alto * fondo», «arriba(alto / 0,6)»).
 * Se leen con un analizador propio, nunca con `eval`: solo números, las medidas
 * de la plantilla, + - * / ( ) y unas pocas funciones. Se aceptan decimales con
 * coma o con punto.
 *
 * Funciones: arriba(x) redondea hacia arriba, abajo(x) hacia abajo,
 * redondear(x) al entero más cercano, max(a; b; …) y min(a; b; …). Los
 * valores se separan con «;» o con una coma y un espacio («max(2, alto)»):
 * «1,5» sin espacio es un número con decimales.
 */

type Nodo =
  | { t: 'num'; v: number }
  | { t: 'var'; nombre: string }
  | { t: 'neg'; a: Nodo }
  | { t: 'op'; op: '+' | '-' | '*' | '/'; a: Nodo; b: Nodo }
  | { t: 'fn'; nombre: string; args: Nodo[] };

const FUNCIONES: Record<string, { min: number; max: number; f: (xs: number[]) => number }> = {
  arriba: { min: 1, max: 1, f: ([x]) => Math.ceil(x! - 1e-9) },
  abajo: { min: 1, max: 1, f: ([x]) => Math.floor(x! + 1e-9) },
  redondear: { min: 1, max: 1, f: ([x]) => Math.round(x!) },
  max: { min: 1, max: 20, f: (xs) => Math.max(...xs) },
  min: { min: 1, max: 20, f: (xs) => Math.min(...xs) },
};

export class ErrorFormula extends Error {}

const LARGO_MAXIMO = 300;

function leer(texto: string): Nodo {
  if (texto.length > LARGO_MAXIMO) throw new ErrorFormula(`La fórmula es demasiado larga (como mucho ${LARGO_MAXIMO} letras).`);
  // Tokens: números (1, 0.6, 0,6), nombres, operadores y paréntesis. La coma entre
  // dos cifras es decimal; si no, separa argumentos.
  const tokens: string[] = [];
  const re = /\s*(\d+(?:[.,]\d+)?|[a-zA-Z_áéíóúñ][\wáéíóúñ]*|[-+*/(),;])/gy;
  let pos = 0;
  while (pos < texto.length) {
    if (/^\s*$/.test(texto.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(texto);
    if (!m) throw new ErrorFormula(`No entiendo «${texto.slice(pos).trim().slice(0, 12)}».`);
    tokens.push(m[1]!);
    pos = re.lastIndex;
  }
  let i = 0;
  const ver = () => tokens[i];
  const tomar = (esperado?: string) => {
    const t = tokens[i];
    if (esperado !== undefined && t !== esperado) throw new ErrorFormula(t === undefined ? `Falta «${esperado}» al final.` : `Esperaba «${esperado}» y hay «${t}».`);
    i++;
    return t;
  };
  const suma = (): Nodo => {
    let a = producto();
    while (ver() === '+' || ver() === '-') {
      const op = tomar() as '+' | '-';
      a = { t: 'op', op, a, b: producto() };
    }
    return a;
  };
  const producto = (): Nodo => {
    let a = unario();
    while (ver() === '*' || ver() === '/') {
      const op = tomar() as '*' | '/';
      a = { t: 'op', op, a, b: unario() };
    }
    return a;
  };
  const unario = (): Nodo => {
    if (ver() === '-') {
      tomar();
      return { t: 'neg', a: unario() };
    }
    if (ver() === '+') tomar();
    return atomo();
  };
  const atomo = (): Nodo => {
    const t = tomar();
    if (t === undefined) throw new ErrorFormula('La fórmula está incompleta.');
    if (t === '(') {
      const a = suma();
      tomar(')');
      return a;
    }
    if (/^\d/.test(t)) return { t: 'num', v: Number(t.replace(',', '.')) };
    if (/^[a-zA-Z_áéíóúñ]/.test(t)) {
      if (ver() === '(') {
        const nombre = t.toLowerCase();
        const fn = FUNCIONES[nombre];
        if (!fn) throw new ErrorFormula(`No conozco la función «${t}». Usa arriba, abajo, redondear, max o min.`);
        tomar('(');
        const args: Nodo[] = [];
        if (ver() !== ')') {
          args.push(suma());
          while (ver() === ',' || ver() === ';') {
            tomar();
            args.push(suma());
          }
        }
        tomar(')');
        if (args.length < fn.min || args.length > fn.max) throw new ErrorFormula(`«${nombre}» necesita ${fn.min === fn.max ? fn.min : `de ${fn.min} a ${fn.max}`} ${fn.max === 1 ? 'valor' : 'valores'}.`);
        return { t: 'fn', nombre, args };
      }
      return { t: 'var', nombre: t };
    }
    throw new ErrorFormula(`Sobra «${t}».`);
  };
  if (!tokens.length) throw new ErrorFormula('Escribe una fórmula (por ejemplo, «2 * alto * fondo» o «1»).');
  const arbol = suma();
  if (i < tokens.length) throw new ErrorFormula(`Sobra «${tokens[i]}».`);
  return arbol;
}

function calcular(n: Nodo, valores: Record<string, number>): number {
  switch (n.t) {
    case 'num':
      return n.v;
    case 'var': {
      if (!(n.nombre in valores)) throw new ErrorFormula(`No hay ninguna medida que se llame «${n.nombre}».`);
      return valores[n.nombre]!;
    }
    case 'neg':
      return -calcular(n.a, valores);
    case 'fn':
      return FUNCIONES[n.nombre]!.f(n.args.map((a) => calcular(a, valores)));
    case 'op': {
      const a = calcular(n.a, valores);
      const b = calcular(n.b, valores);
      if (n.op === '/' && b === 0) throw new ErrorFormula('La fórmula divide entre 0.');
      return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : a / b;
    }
  }
}

/** Nombres de medida que usa una fórmula (para comprobar que existen). */
function nombres(n: Nodo, out = new Set<string>()): Set<string> {
  if (n.t === 'var') out.add(n.nombre);
  else if (n.t === 'neg') nombres(n.a, out);
  else if (n.t === 'op') {
    nombres(n.a, out);
    nombres(n.b, out);
  }
  else if (n.t === 'fn') n.args.forEach((a) => nombres(a, out));
  return out;
}

/** Resultado de una fórmula con unos valores. Lanza ErrorFormula con un mensaje para el usuario. */
export function evaluar(formula: string, valores: Record<string, number>): number {
  const r = calcular(leer(formula), valores);
  if (!Number.isFinite(r)) throw new ErrorFormula('La fórmula no da un número.');
  return r;
}

/** Comprueba una fórmula sin calcularla: que se entiende y que solo usa medidas conocidas. */
export function comprobarFormula(formula: string, medidas: string[]): string | null {
  try {
    const desconocidas = [...nombres(leer(formula))].filter((n) => !medidas.includes(n));
    return desconocidas.length ? `No hay ninguna medida que se llame «${desconocidas[0]}». Las medidas son: ${medidas.join(', ') || '(ninguna)'}.` : null;
  } catch (e) {
    if (e instanceof ErrorFormula) return e.message;
    throw e;
  }
}
