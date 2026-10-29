import type { ArticuloCatalogo, PlantillaCatalogo } from '../data/tipos.ts';
import { categoria, precioVenta, sinPrecio } from './catalogo.ts';
import { ErrorFormula, evaluar } from './formulas.ts';

/**
 * Escandallo de una plantilla con unas medidas y unos materiales: cuánto de
 * cada artículo hace falta (con su merma), lo que cuesta, lo que se cobra y el
 * margen. Todo en céntimos para que las sumas cuadren al céntimo.
 */

export interface LineaEscandallo {
  concepto: string;
  articuloId: string | null;
  articulo: string;
  grupo: string;
  unidad: string;
  /** Lo que queda en el trabajo, según la fórmula. */
  cantidadNeta: number;
  merma: number;
  /** Lo que hay que comprar o dedicar: la neta más la merma. */
  cantidad: number;
  costeUnidad: number;
  coste: number;
  precioUnidad: number;
  precio: number;
}

export interface ResultadoEscandallo {
  lineas: LineaEscandallo[];
  coste: number;
  precio: number;
  margen: number;
  /** Margen sobre el precio (%), o null si el precio es 0. */
  margenPct: number | null;
  /** Por grupos (Materiales, Herrajes y accesorios, Mano de obra…), para el resumen. */
  grupos: { grupo: string; coste: number; precio: number }[];
  /** Avisos: artículos sin precio, materiales sin elegir, fórmulas que no dan. */
  avisos: string[];
  /** Descripción para el presupuesto: «200 × 240 × 60 cm · Cuerpo: Melamina blanca 19 mm…». */
  descripcion: string;
}

const cent = (n: number) => Math.round(n * 100);
const euros = (c: number) => Math.round(c) / 100;
const tres = (n: number) => Math.round(n * 1000) / 1000;
const numero = (n: number) => String(tres(n)).replace('.', ',');

/** Valores para las fórmulas: las medidas en cm pasan a metros. */
export function valoresFormula(p: PlantillaCatalogo, valores: Record<string, number>): Record<string, number> {
  return Object.fromEntries(p.parametros.map((x) => [x.id, (valores[x.id] ?? x.defecto) / (x.tipo === 'medida' ? 100 : 1)]));
}

/** Medidas fuera de rango o no numéricas: un mensaje por cada una. */
export function revisarMedidas(p: PlantillaCatalogo, valores: Record<string, number>): string[] {
  return p.parametros.flatMap((x) => {
    const v = valores[x.id] ?? x.defecto;
    if (!Number.isFinite(v)) return [`Escribe ${x.nombre.toLowerCase()} con números.`];
    if (v < x.min || v > x.max) return [`${x.nombre}: entre ${numero(x.min)} y ${numero(x.max)}${x.tipo === 'medida' ? ' cm' : ''}.`];
    return [];
  });
}

export function calcularEscandallo(p: PlantillaCatalogo, articulos: ArticuloCatalogo[], valores: Record<string, number>, elegidos: Record<string, string> = {}): ResultadoEscandallo {
  const porId = new Map(articulos.map((a) => [a.id, a]));
  const vars = valoresFormula(p, valores);
  const avisos: string[] = revisarMedidas(p, valores);
  const eleccion = (opcion: string) => {
    const o = p.opciones.find((x) => x.id === opcion);
    const id = elegidos[opcion] || o?.defecto || null;
    return { o, a: id ? (porId.get(id) ?? null) : null };
  };
  const lineas: LineaEscandallo[] = [];
  for (const c of p.componentes) {
    const { o, a } = 'id' in c.articulo ? { o: null, a: porId.get(c.articulo.id) ?? null } : eleccion(c.articulo.opcion);
    let neta = 0;
    try {
      neta = Math.max(0, evaluar(c.cantidad, vars));
    } catch (e) {
      if (!(e instanceof ErrorFormula)) throw e;
      avisos.push(`«${c.concepto}»: ${e.message}`);
    }
    if (neta === 0) continue;
    if (!a) {
      avisos.push(o ? `Elige ${o.nombre.toLowerCase()}.` : `«${c.concepto}»: su artículo ya no está en el catálogo.`);
      continue;
    }
    if (sinPrecio(a)) avisos.push(`«${a.nombre}» no tiene precio: rellénalo en el catálogo.`);
    const cantidad = tres(neta * (1 + a.merma / 100));
    const precioUnidad = precioVenta(a);
    lineas.push({
      concepto: c.concepto,
      articuloId: a.id,
      articulo: a.nombre,
      grupo: categoria(a.categoria)?.grupo ?? 'Materiales',
      unidad: a.unidad,
      cantidadNeta: tres(neta),
      merma: a.merma,
      cantidad,
      costeUnidad: a.coste,
      coste: euros(cent(cantidad * a.coste)),
      precioUnidad,
      precio: euros(cent(cantidad * precioUnidad)),
    });
  }
  const coste = euros(lineas.reduce((t, l) => t + cent(l.coste), 0));
  const precio = euros(lineas.reduce((t, l) => t + cent(l.precio), 0));
  const grupos = [...new Set(lineas.map((l) => l.grupo))].map((grupo) => {
    const del = lineas.filter((l) => l.grupo === grupo);
    return { grupo, coste: euros(del.reduce((t, l) => t + cent(l.coste), 0)), precio: euros(del.reduce((t, l) => t + cent(l.precio), 0)) };
  });
  return { lineas, coste, precio, margen: euros(cent(precio) - cent(coste)), margenPct: precio > 0 ? Math.round(((precio - coste) / precio) * 1000) / 10 : null, grupos, avisos: [...new Set(avisos)], descripcion: describir(p, valores, (o) => eleccion(o).a) };
}

/** «200 × 240 × 60 cm · 2 puertas · Cuerpo: Melamina blanca 19 mm». */
export function describir(p: PlantillaCatalogo, valores: Record<string, number>, elegido: (opcion: string) => ArticuloCatalogo | null): string {
  const medidas = p.parametros.filter((x) => x.tipo === 'medida').map((x) => numero(valores[x.id] ?? x.defecto));
  const numeros = p.parametros.filter((x) => x.tipo === 'numero' && (valores[x.id] ?? x.defecto) > 0).map((x) => `${numero(valores[x.id] ?? x.defecto)} ${x.nombre.toLowerCase()}`);
  const materiales = p.opciones.flatMap((o) => {
    const a = elegido(o.id);
    return a ? [`${o.nombre}: ${a.nombre}`] : [];
  });
  return [medidas.length ? `${medidas.join(' × ')} cm` : '', ...numeros, ...materiales].filter(Boolean).join(' · ');
}
