import type { LineaPresupuestoCliente, PlantillaCatalogo, PresupuestoCliente, Repositorios } from '../data/tipos.ts';
import { cambiarPresupuesto } from '../presupuestos-cliente/presupuestos.ts';
import type { ResultadoEscandallo } from './escandallo.ts';

/**
 * Del escandallo de un trabajo a las líneas de un presupuesto para el
 * cliente. El cliente ve el trabajo y su precio, nunca los costes ni los
 * márgenes:
 * - «una»: una línea con el trabajo, sus medidas y materiales.
 * - «partes»: una línea por grupo (materiales, herrajes, acabados, mano de obra, servicios).
 */
export type ModoPresupuesto = 'una' | 'partes';

const corta = (t: string, max: number) => (t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`);

export function lineasDelTrabajo(p: Pick<PlantillaCatalogo, 'nombre'>, e: ResultadoEscandallo, modo: ModoPresupuesto): LineaPresupuestoCliente[] {
  const partes = e.descripcion.split(' · ');
  const medidas = partes.filter((x) => !x.includes(': ')).join(', ');
  const materiales = partes
    .filter((x) => x.includes(': '))
    .map((x) => x.split(': ')[1])
    .join(', ');
  const concepto = corta(medidas ? `${p.nombre} (${medidas})` : p.nombre, 200);
  if (modo === 'una') return [{ concepto, cantidad: 1, precio: e.precio, material: corta(materiales, 120), extra: false }];
  return e.grupos.map((g, i) => ({ concepto: corta(`${g.grupo}: ${i === 0 ? concepto : p.nombre}`, 200), cantidad: 1, precio: g.precio, material: i === 0 ? corta(materiales, 120) : '', extra: false }));
}

/** Añade las líneas a un presupuesto en borrador (lo enviado no se toca). */
export async function anadirAPresupuesto(repos: Repositorios, id: string, lineas: LineaPresupuestoCliente[], email: string, ivaFijo: number | null): Promise<{ ok: true; presupuesto: PresupuestoCliente } | { ok: false; error: string }> {
  const p = await repos.presupuestosCliente.obtener(id);
  if (!p) return { ok: false, error: 'Ese presupuesto no existe.' };
  if (p.estado !== 'borrador') return { ok: false, error: 'Solo se añade a un presupuesto en borrador.' };
  return cambiarPresupuesto(repos, id, { clienteId: p.clienteId, obraId: p.obraId, concepto: p.concepto, fecha: p.fecha, validez: p.validez, lineas: [...p.lineas, ...lineas], iva: p.iva, anticipoPct: p.anticipoPct, formaPago: p.formaPago, notas: p.notas }, email, ivaFijo);
}

/** Enlace a un presupuesto nuevo con las líneas ya escritas (el formulario las lee de la dirección). */
export function enlaceNuevoPresupuesto(lineas: LineaPresupuestoCliente[], concepto: string): string {
  const q = new URLSearchParams({ concepto: corta(concepto, 200) });
  lineas.forEach((l, i) => {
    q.set(`l${i}.concepto`, l.concepto);
    q.set(`l${i}.cantidad`, String(l.cantidad).replace('.', ','));
    q.set(`l${i}.precio`, String(l.precio).replace('.', ','));
    if (l.material) q.set(`l${i}.material`, l.material);
  });
  q.set('filas', String(lineas.length));
  return `/panel/presupuestos-cliente/nuevo?${q}`;
}
