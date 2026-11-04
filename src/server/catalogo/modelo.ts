import { z } from 'astro/zod';
import type {
  ConfigurableCatalogo,
  DimensionesCatalogo,
  OrigenCatalogo,
  ReglaConfigurableCatalogo,
} from '../data/tipos.ts';

const redondear = (n: number) => Math.round(n * 1000) / 1000;
const numero = (valor: string) => Number(valor.replace(',', '.'));

export function normalizarDimensiones(
  formato: string,
  espesorMm: number | null = null,
  unidadDeclarada: 'mm' | 'cm' | 'm' | '' = '',
): DimensionesCatalogo {
  const textoOriginal = formato.trim();
  const coincidencia = textoOriginal.match(/(\d+(?:[,.]\d+)?)\s*[x×]\s*(\d+(?:[,.]\d+)?)(?:\s*[x×]\s*(\d+(?:[,.]\d+)?))?\s*(mm|cm|m)?/i);
  const unidad = (coincidencia?.[4]?.toLowerCase() || unidadDeclarada || '') as DimensionesCatalogo['unidadOriginal'];
  const factor = unidad === 'cm' ? 10 : unidad === 'm' ? 1000 : 1;
  return {
    largoMm: coincidencia ? redondear(numero(coincidencia[1]!) * factor) : null,
    anchoMm: coincidencia ? redondear(numero(coincidencia[2]!) * factor) : null,
    altoMm: coincidencia?.[3] ? redondear(numero(coincidencia[3]) * factor) : null,
    fondoMm: null,
    espesorMm,
    textoOriginal,
    unidadOriginal: unidad,
  };
}

export function claveNormalizada(...partes: Array<string | number | null | undefined>): string {
  return partes.map((p) => String(p ?? '').trim().toLocaleLowerCase('es')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')).join('|');
}

export function superficieM2(d: DimensionesCatalogo): number | null {
  return d.largoMm !== null && d.anchoMm !== null ? redondear(d.largoMm * d.anchoMm / 1_000_000) : null;
}

export function paquetesNecesarios(cantidad: number, unidadesPaquete: number | null): number {
  if (!Number.isFinite(cantidad) || cantidad < 0) throw new Error('La cantidad no es válida.');
  if (unidadesPaquete === null) return cantidad === 0 ? 0 : 1;
  if (!Number.isInteger(unidadesPaquete) || unidadesPaquete <= 0) throw new Error('Las unidades por paquete no son válidas.');
  return Math.ceil(cantidad / unidadesPaquete);
}

export const origenCatalogo = z.object({
  proveedor: z.string().max(80), documento: z.string().max(120), pagina: z.number().int().positive().nullable(),
  metodo: z.enum(['manual', 'pdfjs', 'groq-texto', 'groq-vision', 'migracion']),
  confianza: z.number().min(0).max(1).nullable(), revision: z.enum(['pendiente', 'verificado', 'ambiguo', 'rechazado']),
  textoOriginal: z.string().max(1000).optional(),
}) satisfies z.ZodType<OrigenCatalogo>;

export function validarConfiguracion(
  configurable: Pick<ConfigurableCatalogo, 'parametros' | 'reglas'>,
  valores: Record<string, unknown>,
): string[] {
  const errores: string[] = [];
  for (const p of configurable.parametros) {
    const valor = valores[p.id];
    if (p.requerido && (valor === undefined || valor === null || valor === '')) errores.push(`${p.nombre} es obligatorio.`);
    if ((p.tipo === 'medida' || p.tipo === 'numero') && valor !== undefined) {
      if (typeof valor !== 'number' || !Number.isFinite(valor)) errores.push(`${p.nombre} debe ser un número.`);
      else {
        if (p.min !== undefined && valor < p.min) errores.push(`${p.nombre}: mínimo ${p.min}${p.unidad ? ` ${p.unidad}` : ''}.`);
        if (p.max !== undefined && valor > p.max) errores.push(`${p.nombre}: máximo ${p.max}${p.unidad ? ` ${p.unidad}` : ''}.`);
        if (p.paso !== undefined && p.min !== undefined && Math.abs((valor - p.min) / p.paso - Math.round((valor - p.min) / p.paso)) > 1e-8)
          errores.push(`${p.nombre} debe avanzar en pasos de ${p.paso}${p.unidad ? ` ${p.unidad}` : ''}.`);
      }
    }
    if (p.tipo === 'opcion' && valor !== undefined && !p.opciones?.includes(String(valor))) errores.push(`${p.nombre} no admite esa opción.`);
  }
  for (const regla of configurable.reglas) if (!cumpleRegla(regla, valores[regla.parametro])) errores.push(regla.mensaje);
  return [...new Set(errores)];
}

function cumpleRegla(regla: ReglaConfigurableCatalogo, valor: unknown): boolean {
  if (regla.operador === 'eq') return valor === regla.valor;
  if (regla.operador === 'neq') return valor !== regla.valor;
  if (regla.operador === 'min') return typeof valor === 'number' && valor >= Number(regla.valor);
  if (regla.operador === 'max') return typeof valor === 'number' && valor <= Number(regla.valor);
  return Array.isArray(regla.valor) && regla.valor.includes(valor as never);
}
