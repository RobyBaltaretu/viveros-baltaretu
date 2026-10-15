/**
 * Lista de presupuesto del visitante. Vive en localStorage (puede fallar en modo
 * privado o con el almacenamiento bloqueado: entonces dura solo en la página).
 * Las funciones puras se prueban en tests; `almacen` envuelve el navegador.
 */
import { MAX_CANTIDAD, MAX_LINEAS } from './limites';
import { SLUG_REGEX } from '../catalogo/constantes';

export interface LineaLista {
  slug: string;
  cantidad: number;
}

export const CLAVE_ALMACEN = 'vivero:lista-presupuesto';
export const EVENTO_CAMBIO = 'lista-presupuesto';

const limitar = (n: number) => Math.min(MAX_CANTIDAD, Math.max(1, Math.round(n) || 1));

/** Interpreta lo guardado, descartando lo que no sea válido. */
export function leerLista(crudo: string | null): LineaLista[] {
  let datos: unknown;
  try {
    datos = JSON.parse(crudo ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(datos)) return [];
  const lista: LineaLista[] = [];
  for (const l of datos) {
    const valida = typeof l?.slug === 'string' && SLUG_REGEX.test(l.slug) && typeof l?.cantidad === 'number';
    if (valida && !lista.some((x) => x.slug === l.slug)) lista.push({ slug: l.slug, cantidad: limitar(l.cantidad) });
  }
  return lista.slice(0, MAX_LINEAS);
}

export function agregar(lista: LineaLista[], slug: string, cantidad = 1): LineaLista[] {
  const existente = lista.find((l) => l.slug === slug);
  if (existente) return lista.map((l) => (l.slug === slug ? { ...l, cantidad: limitar(l.cantidad + cantidad) } : l));
  if (lista.length >= MAX_LINEAS) return lista;
  return [...lista, { slug, cantidad: limitar(cantidad) }];
}

export function cambiarCantidad(lista: LineaLista[], slug: string, cantidad: number): LineaLista[] {
  return lista.map((l) => (l.slug === slug ? { ...l, cantidad: limitar(cantidad) } : l));
}

export function quitar(lista: LineaLista[], slug: string): LineaLista[] {
  return lista.filter((l) => l.slug !== slug);
}

/** Total de unidades (lo que muestra el contador). */
export const totalUnidades = (lista: LineaLista[]) => lista.reduce((suma, l) => suma + l.cantidad, 0);

/** Acceso al navegador: lee, guarda y avisa a la página (y a otras pestañas, vía `storage`). */
export const almacen = {
  leer(): LineaLista[] {
    try {
      return leerLista(localStorage.getItem(CLAVE_ALMACEN));
    } catch {
      return memoria;
    }
  },
  guardar(lista: LineaLista[]) {
    memoria = lista;
    try {
      localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(lista));
    } catch {
      // Sin almacenamiento: la lista se mantiene mientras la página esté abierta.
    }
    window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO, { detail: lista }));
  },
  alCambiar(funcion: (lista: LineaLista[]) => void) {
    window.addEventListener(EVENTO_CAMBIO, (e) => funcion((e as CustomEvent<LineaLista[]>).detail));
    window.addEventListener('storage', (e) => {
      if (e.key === CLAVE_ALMACEN) funcion(leerLista(e.newValue));
    });
  },
};
let memoria: LineaLista[] = [];
