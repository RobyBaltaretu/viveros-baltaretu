import type { Existencias, Factura, Repositorios, TipoMovimiento } from '../data/tipos.ts';
import { TIPOS_MOVIMIENTO } from '../data/tipos.ts';
import type { DatosPlanta } from './plantas.ts';

/**
 * Inventario del vivero: unidades disponibles de cada planta y lo que se ha
 * perdido (desperdicio). Todo cambio es un movimiento con su motivo; no se
 * borran: un error se corrige con otro movimiento. Al emitir una factura, sus
 * líneas con planta restan solas (y una rectificativa las devuelve).
 */
export const NOMBRE_TIPO: Record<TipoMovimiento, string> = { entrada: 'Entrada', salida: 'Salida', baja: 'Baja (desperdicio)' };

export const MOTIVOS: Record<TipoMovimiento, string[]> = {
  entrada: ['Producción propia', 'Compra a proveedor', 'Devolución de un cliente', 'Recuento: había más', 'Otro motivo'],
  salida: ['Venta sin factura', 'Regalo o muestra', 'Traslado a otro vivero', 'Recuento: había menos', 'Otro motivo'],
  baja: ['Se ha muerto', 'Dañada, no se puede vender', 'Plaga o enfermedad', 'Helada o golpe de calor', 'Otro motivo'],
};

export const MAXIMO_MOVIMIENTO = 100_000;

export interface FilaInventario {
  id: string;
  nombre: string;
  disponibilidad: string;
  existencias: Existencias;
}

const vacio: Existencias = { disponible: 0, desperdicio: 0, ultimo: '' };

/** Todas las plantas del catálogo con sus existencias (las que nunca tuvieron movimientos, a 0). */
export async function inventarioCompleto(repos: Repositorios): Promise<FilaInventario[]> {
  const [entradas, existencias] = await Promise.all([repos.contenido.listar('catalogo'), repos.inventario.existencias()]);
  return entradas
    .map((e) => {
      const d = e.borrador.datos as DatosPlanta;
      return { id: e.id, nombre: String(d.nombre?.es ?? e.id), disponibilidad: String(d.disponibilidad ?? ''), existencias: existencias[e.id] ?? vacio };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export interface PeticionMovimiento {
  tipo: TipoMovimiento;
  cantidad: number;
  motivo: string;
  nota?: string;
}
type Resultado = { ok: true; texto: string; disponible: number } | { ok: false; error: string };

export function validarMovimiento(m: Partial<PeticionMovimiento>): string | null {
  if (!m.tipo || !TIPOS_MOVIMIENTO.includes(m.tipo)) return 'Elige si entra, sale o se da de baja.';
  if (!Number.isInteger(m.cantidad) || (m.cantidad ?? 0) <= 0 || (m.cantidad ?? 0) > MAXIMO_MOVIMIENTO) return 'Escribe cuántas plantas: un número entero mayor que 0.';
  if (!m.motivo || !MOTIVOS[m.tipo].includes(m.motivo)) return 'Elige el motivo.';
  if (m.motivo === 'Otro motivo' && !m.nota?.trim()) return 'Con «Otro motivo», escribe cuál en la nota.';
  if ((m.nota ?? '').length > 300) return 'La nota es demasiado larga (300 letras como mucho).';
  return null;
}

/** Movimiento manual. No deja sacar ni dar de baja más plantas de las que hay. */
export async function moverInventario(repos: Repositorios, planta: string, m: PeticionMovimiento, email: string): Promise<Resultado> {
  const error = validarMovimiento(m);
  if (error) return { ok: false, error };
  const e = await repos.contenido.obtener('catalogo', planta);
  if (!e) return { ok: false, error: 'Esa planta no está en el catálogo.' };
  const nombre = String((e.borrador.datos as DatosPlanta).nombre?.es ?? planta);
  const antes = (await repos.inventario.existencias())[planta]?.disponible ?? 0;
  if (m.tipo !== 'entrada' && m.cantidad > antes) return { ok: false, error: `Solo hay ${antes} ${antes === 1 ? 'unidad' : 'unidades'} de ${nombre}: no se pueden quitar ${m.cantidad}.` };
  const cantidad = m.tipo === 'entrada' ? m.cantidad : -m.cantidad;
  await repos.inventario.registrar([{ planta, tipo: m.tipo, cantidad, motivo: m.motivo, nota: m.nota?.trim() ?? '' }], email);
  await repos.auditoria.registrar(email, 'inventario', `${nombre}: ${cantidad > 0 ? '+' : ''}${cantidad} (${m.motivo})`);
  const disponible = antes + cantidad;
  const que = { entrada: `Entran ${m.cantidad}`, salida: `Salen ${m.cantidad}`, baja: `${m.cantidad} a desperdicio` }[m.tipo];
  return { ok: true, texto: `${nombre}: ${que}. Ahora hay ${disponible}.`, disponible };
}

/**
 * Al emitir una factura: cada línea con planta resta su cantidad (una
 * rectificativa, con cantidades negativas, las devuelve). Las facturas de
 * prueba no tocan el inventario. Se puede llamar varias veces sin repetir.
 */
export async function descontarFactura(repos: Repositorios, f: Factura, email: string): Promise<number> {
  if (f.prueba || f.serie?.startsWith('PRUEBA-') || f.estado === 'borrador') return 0;
  const movimientos = f.lineas
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.planta && l.concepto && Math.round(l.cantidad) !== 0)
    .map(({ l, i }) => {
      const cantidad = -Math.round(l.cantidad);
      return {
        planta: l.planta!,
        tipo: (cantidad > 0 ? 'entrada' : 'salida') as TipoMovimiento,
        cantidad,
        motivo: cantidad > 0 ? `Rectificativa ${f.codigo ?? ''}`.trim() : `Factura ${f.codigo ?? ''}`.trim(),
        nota: f.cliente.nombre,
        referencia: `factura:${f.id}:${i}`,
      };
    });
  return repos.inventario.registrar(movimientos, email);
}
