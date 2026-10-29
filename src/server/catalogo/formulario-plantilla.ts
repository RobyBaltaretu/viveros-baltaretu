import type { PlantillaCatalogo } from '../data/tipos.ts';
import { numero } from '../presupuestos-cliente/formulario.ts';
import type { EntradaPlantilla } from './catalogo.ts';

/**
 * Formulario para crear o cambiar una plantilla: medidas, materiales a elegir
 * y partes en filas (`m0.nombre`, `o0.nombre`, `c0.concepto`…). Las filas
 * vacías no cuentan. La clave de cada medida (el nombre en las fórmulas) sale
 * del nombre si no se escribe.
 */

/** «Barras de colgar» → «barras_de_colgar». */
export const claveDe = (nombre: string) =>
  nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'n$1')
    .slice(0, 25);

export interface FilasPlantilla {
  medidas: number;
  opciones: number;
  partes: number;
}

type Leer = { get(nombre: string): unknown };

export function leerFormularioPlantilla(form: Leer): { entrada: EntradaPlantilla; filas: FilasPlantilla } {
  const v = (n: string) => String(form.get(n) ?? '').trim();
  const cuantas = (n: string, max: number) => Math.min(Math.max(Number(v(n)) || 0, 0), max);
  const filas = { medidas: cuantas('filasMedidas', 15), opciones: cuantas('filasOpciones', 10), partes: cuantas('filasPartes', 80) };
  const parametros: EntradaPlantilla['parametros'] = [];
  for (let i = 0; i < filas.medidas; i++) {
    const nombre = v(`m${i}.nombre`);
    if (!nombre) continue;
    const tipo = v(`m${i}.tipo`) === 'numero' ? 'numero' : 'medida';
    const n = (k: string, d: number) => numero(v(`m${i}.${k}`)) ?? d;
    parametros.push({ id: v(`m${i}.id`) || claveDe(nombre), nombre, tipo, defecto: n('defecto', 0), min: n('min', 0), max: n('max', tipo === 'medida' ? 1000 : 50) });
  }
  const opciones: EntradaPlantilla['opciones'] = [];
  for (let i = 0; i < filas.opciones; i++) {
    const nombre = v(`o${i}.nombre`);
    if (!nombre) continue;
    opciones.push({ id: v(`o${i}.id`) || claveDe(nombre), nombre, categorias: v(`o${i}.categorias`).split(',').filter(Boolean), defecto: v(`o${i}.defecto`) || null });
  }
  const componentes: EntradaPlantilla['componentes'] = [];
  for (let i = 0; i < filas.partes; i++) {
    const concepto = v(`c${i}.concepto`);
    const origen = v(`c${i}.articulo`);
    const cantidad = v(`c${i}.cantidad`);
    if (!concepto && !origen && !cantidad) continue;
    componentes.push({ concepto, articulo: origen.startsWith('opcion:') ? { opcion: origen.slice(7) } : { id: origen.replace(/^id:/, '') }, cantidad });
  }
  return {
    entrada: { id: v('id') || undefined, nombre: v('nombre'), tipoTrabajo: v('tipoTrabajo'), descripcion: v('descripcion'), parametros, opciones, componentes, orden: Number(v('orden')) || 0 },
    filas,
  };
}

/** Copia de una plantilla para empezar otra parecida. */
export const copiaDe = (p: PlantillaCatalogo): EntradaPlantilla => ({ nombre: `${p.nombre} (copia)`.slice(0, 120), tipoTrabajo: p.tipoTrabajo, descripcion: p.descripcion, parametros: p.parametros, opciones: p.opciones, componentes: p.componentes, orden: p.orden + 1 });
