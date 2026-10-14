import type { SolicitudPresupuesto } from '../../lib/presupuesto/esquema';
import type { Presupuesto } from '../data/tipos.ts';

/** Petición de la web → presupuesto guardado para la bandeja del panel. */
export function presupuestoDesde(
  s: SolicitudPresupuesto,
  especies: ReadonlyMap<string, { nombre: string }>,
  ahora = new Date(),
  id: string = crypto.randomUUID(),
): Presupuesto {
  return {
    id,
    fecha: ahora.toISOString(),
    estado: 'nuevo',
    idioma: s.idioma,
    tipoPedido: s.tipoPedido,
    nombre: s.nombre,
    email: s.email,
    telefono: s.telefono ?? '',
    empresa: s.empresa ?? '',
    provincia: s.provincia ?? '',
    mensaje: s.mensaje ?? '',
    lineas: s.lineas.map((l) => ({ especie: l.slug, nombre: especies.get(l.slug)?.nombre ?? l.slug, cantidad: l.cantidad })),
  };
}

export const NOMBRES_ESTADO = { nuevo: 'Nuevos', respondido: 'Respondidos', archivado: 'Archivados' } as const;

/** Celda de CSV segura: entre comillas y sin fórmulas (evita la inyección en hojas de cálculo). */
export function celdaCsv(valor: unknown): string {
  let texto = String(valor ?? '');
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

export function presupuestosCsv(lista: Presupuesto[]): string {
  const cabecera = ['Fecha', 'Estado', 'Tipo de pedido', 'Nombre', 'Empresa', 'Correo', 'Teléfono', 'Provincia', 'Plantas', 'Mensaje'];
  const filas = lista.map((p) => [
    p.fecha,
    p.estado,
    p.tipoPedido === 'unidad' ? 'por unidad' : 'al por mayor',
    p.nombre,
    p.empresa,
    p.email,
    p.telefono,
    p.provincia,
    p.lineas.map((l) => `${l.cantidad} × ${l.nombre}`).join('; '),
    p.mensaje,
  ]);
  // BOM para que Excel abra bien las tildes.
  return '﻿' + [cabecera, ...filas].map((f) => f.map(celdaCsv).join(';')).join('\r\n') + '\r\n';
}
