/** Contrato de dominio para Turia Studio: el boceto confirmado es la fuente de verdad.
 * Nunca convertir una cota aproximada en exacta ni fabricar medidas ausentes.
 * Sin dependencias de proveedor IA: reutilizable por API, editor y presupuestos.
 */
export type PrecisionCota = 'exacta' | 'aproximada' | 'desconocida';
export type TipoModulo = 'armario' | 'cajonera' | 'balda' | 'hueco-electrodomestico' | 'encimera' | 'panel' | 'otro';
export type TipoPieza = 'puerta' | 'costado' | 'interior' | 'balda' | 'cajon' | 'encimera' | 'canto' | 'trasera' | 'otra';
export type EstadoInterpretacion = 'pendiente' | 'requiere-revision' | 'validada';

export interface CotaBoceto {
  valorMm: number | null;
  precision: PrecisionCota;
  origen: 'boceto' | 'usuario' | 'medicion';
  confirmada: boolean;
  etiqueta?: string;
}
export interface PiezaBoceto {
  id: string;
  tipo: TipoPieza;
  catalogoVarianteId: string | null;
  acabadoId: string | null;
  orientacionVeta?: 'vertical' | 'horizontal' | 'no-aplica';
}
export interface ModuloBoceto {
  id: string;
  tipo: TipoModulo;
  orden: number;
  ancho: CotaBoceto;
  alto: CotaBoceto;
  fondo: CotaBoceto;
  piezas: PiezaBoceto[];
  notas?: string;
}
export interface InterpretacionBoceto {
  version: 1;
  estado: EstadoInterpretacion;
  categoria: string;
  modulos: ModuloBoceto[];
  obstaculos: { id: string; descripcion: string; conservar: boolean }[];
  preguntas: string[];
  fotoEspacioId: string;
  fotoBocetoId: string;
  confirmadaPor?: string;
  confirmadaEn?: string;
}
export function validarCota(cota: CotaBoceto): string | null {
  if (!['exacta','aproximada','desconocida'].includes(cota.precision)) return 'Precisión inválida';
  if (!['boceto','usuario','medicion'].includes(cota.origen)) return 'Origen inválido';
  if (cota.precision === 'desconocida') return cota.valorMm === null && !cota.confirmada ? null : 'Una cota desconocida no puede confirmarse ni tener valor';
  if (cota.valorMm === null || !Number.isFinite(cota.valorMm) || cota.valorMm <= 0 || cota.valorMm > 100000) return 'La medida debe ser positiva y estar expresada en milímetros';
  return null;
}
export function validarInterpretacion(b: InterpretacionBoceto): string[] {
  const errores: string[] = [];
  if (b.version !== 1) errores.push('Versión no admitida');
  if (!b.fotoEspacioId || !b.fotoBocetoId) errores.push('Se requieren fotografía del espacio y del boceto');
  if (!b.categoria.trim()) errores.push('Falta categoría');
  if (!b.modulos.length) errores.push('Faltan módulos');
  const ids = new Set<string>();
  for (const modulo of b.modulos) {
    if (!modulo.id || ids.has(modulo.id)) errores.push('ID de módulo duplicado o vacío');
    ids.add(modulo.id);
    if (!Number.isInteger(modulo.orden) || modulo.orden < 0) errores.push('Orden inválido: '+modulo.id);
    for (const [campo, cota] of [['ancho',modulo.ancho],['alto',modulo.alto],['fondo',modulo.fondo]] as const) {
      const error = validarCota(cota);
      if (error) errores.push(modulo.id+'.'+campo+': '+error);
    }
    const piezas = new Set<string>();
    for (const pieza of modulo.piezas) {
      if (!pieza.id || piezas.has(pieza.id)) errores.push('ID de pieza duplicado o vacío: '+modulo.id);
      piezas.add(pieza.id);
    }
  }
  if (b.estado === 'validada' && (!b.confirmadaPor || !b.confirmadaEn)) errores.push('La validación requiere confirmación humana registrada');
  return errores;
}
export function requiereRevision(b: InterpretacionBoceto): boolean {
  return b.estado !== 'validada' || validarInterpretacion(b).length > 0 ||
    b.modulos.some(m => [m.ancho,m.alto,m.fondo].some(c => c.precision !== 'exacta' || !c.confirmada));
}
