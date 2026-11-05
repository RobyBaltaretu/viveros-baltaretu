import type { PiezaBoceto, TipoPieza } from './boceto.ts';
import type { ArticuloCatalogo, VarianteCatalogo } from '../data/tipos.ts';

/** Piezas que se hacen de tablero, madera o chapa (cuerpos y frentes). */
const PIEZAS_TABLERO: TipoPieza[] = ['puerta', 'costado', 'interior', 'balda', 'cajon', 'trasera'];
const CATEGORIAS_TABLERO = ['tableros', 'macizos', 'chapas'];
const PALABRAS_TABLERO = ['tabler', 'panel', 'madera', 'melamin', 'mdf', 'aglomerad', 'contrachap', 'laminad', 'chapa'];
/** Categorías que nunca son el cuerpo o el frente de un mueble. */
const NO_TABLERO = ['cantos', 'encimeras', 'herrajes', 'tiradores', 'accesorios', 'iluminacion', 'consumibles', 'cristal', 'suelos', 'mobiliario', 'acabados'];

/** Error que se mostraría si el material no vale para esa pieza; null si vale. Sin efectos: lo usan el selector y la validación. */
export function motivoIncompatible(tipo: TipoPieza, articulo: Pick<ArticuloCatalogo, 'categoria' | 'nombre'>, variante?: Pick<VarianteCatalogo, 'soporte'>): string | null {
  const cat = articulo.categoria;
  const texto = (cat + ' ' + articulo.nombre + ' ' + (variante?.soporte || '')).toLowerCase();
  if (tipo === 'canto') return cat === 'cantos' || (!cat && texto.includes('canto')) ? null : 'El canto requiere material de canto';
  if (tipo === 'encimera') return cat === 'encimeras' || (!cat && texto.includes('encimera')) ? null : 'La encimera requiere un material de encimera';
  if (PIEZAS_TABLERO.includes(tipo)) {
    if (CATEGORIAS_TABLERO.includes(cat)) return null;
    if (!NO_TABLERO.includes(cat) && PALABRAS_TABLERO.some((s) => texto.includes(s))) return null;
    return 'La pieza requiere un tablero o panel';
  }
  return null;
}
export const materialCompatible = (tipo: TipoPieza, articulo: Pick<ArticuloCatalogo, 'categoria' | 'nombre'>, variante?: Pick<VarianteCatalogo, 'soporte'>) =>
  motivoIncompatible(tipo, articulo, variante) === null;

export function compatibilidadPieza(pieza: PiezaBoceto, articulo: ArticuloCatalogo, variante: VarianteCatalogo) {
  const errores: string[] = [], avisos: string[] = [];
  if (articulo.archivado || variante.estado !== 'activo') errores.push('Variante no activa');
  const motivo = motivoIncompatible(pieza.tipo, articulo, variante);
  if (motivo) errores.push(motivo);
  if (variante.disponibilidad === 'sin-stock') avisos.push('Sin stock');
  if (!(variante.dimensiones.espesorMm ?? articulo.espesor)) avisos.push('Espesor por confirmar');
  return { compatible: errores.length === 0, errores, avisos };
}
