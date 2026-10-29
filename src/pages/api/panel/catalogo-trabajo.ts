import type { APIRoute } from 'astro';
import { lineasDelTrabajo } from '../../../server/catalogo/al-presupuesto.ts';
import { calcularEscandallo } from '../../../server/catalogo/escandallo.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { numero } from '../../../server/presupuestos-cliente/formulario.ts';

export const prerender = false;

/**
 * Precio de un trabajo del catálogo con unas medidas y unos materiales, y las
 * líneas listas para un presupuesto o una factura (en una línea o por partes).
 * Lo usa el selector del catálogo de los editores. Nunca devuelve costes.
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const s = sesionCon(locals, 'facturas');
  if (!s) return new Response(null, { status: 403 });
  const p = await s.repos.catalogo.plantilla(url.searchParams.get('id') ?? '');
  if (!p || p.archivado) return new Response(null, { status: 404 });
  const valores: Record<string, number> = {};
  for (const x of p.parametros) {
    const t = url.searchParams.get(`m.${x.id}`);
    valores[x.id] = (t === null || t.trim() === '' ? null : numero(t)) ?? x.defecto;
  }
  const elegidos = Object.fromEntries(p.opciones.map((o) => [o.id, url.searchParams.get(`o.${o.id}`) ?? '']));
  const e = calcularEscandallo(p, await s.repos.catalogo.articulos(), valores, elegidos);
  const cuerpo = { precio: e.precio, descripcion: e.descripcion, avisos: e.avisos, lineas: { una: lineasDelTrabajo(p, e, 'una'), partes: lineasDelTrabajo(p, e, 'partes') } };
  return new Response(JSON.stringify(cuerpo), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
};
