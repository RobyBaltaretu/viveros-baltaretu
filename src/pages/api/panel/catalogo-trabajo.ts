import type { APIRoute } from 'astro';
import { lineasDelTrabajo, llevaDelTrabajo } from '../../../server/catalogo/al-presupuesto.ts';
import { avisoSinPrecio, calcularEscandallo } from '../../../server/catalogo/escandallo.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { numero } from '../../../server/presupuestos-cliente/formulario.ts';
import { costeDe, lineasDeTrabajo } from '../../../server/pedidos/pedidos.ts';

export const prerender = false;

/**
 * Precio de un trabajo del catálogo con unas medidas y unos materiales, y las
 * líneas listas para un presupuesto o una factura (en una línea o por partes).
 * Lo usa el selector del catálogo de los editores. Para presupuestos y facturas nunca devuelve costes:
 * «lleva» son los artículos con su cantidad, para que se vea qué incluye.
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
  const articulos = await s.repos.catalogo.articulos();
  const e = calcularEscandallo(p, articulos, valores, elegidos);
  // Para un pedido a proveedor (`compra=1`): los materiales con su cantidad y coste (interno; solo quien ve el catálogo).
  if (url.searchParams.get('compra') === '1') {
    const compra = lineasDeTrabajo(e, articulos, p.nombre);
    const cuerpo = { precio: costeDe(compra), avisos: e.avisos.filter((a) => !a.includes('no tiene precio')), faltanPrecios: compra.filter((l) => !(l.coste > 0)).length, lleva: compra.map((l) => ({ articulo: l.concepto, cantidad: l.cantidad, unidad: l.unidad, sinPrecio: !(l.coste > 0) })), lineas: { compra } };
    return new Response(JSON.stringify(cuerpo), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  }
  const lleva = llevaDelTrabajo(e);
  // Los artículos sin precio no van uno a uno en los avisos: se cuentan («faltan precios de 7 materiales»).
  const sinPrecio = new Set(lleva.filter((x) => !(x.precioUnidad > 0)).map((x) => avisoSinPrecio(x.articulo)));
  const cuerpo = {
    precio: e.precio,
    descripcion: e.descripcion,
    avisos: e.avisos.filter((a) => !sinPrecio.has(a)),
    faltanPrecios: sinPrecio.size,
    lleva: lleva.map(({ articulo, cantidad, unidad, precioUnidad }) => ({ articulo, cantidad, unidad, sinPrecio: !(precioUnidad > 0) })),
    lineas: { una: lineasDelTrabajo(p, e, 'una'), partes: lineasDelTrabajo(p, e, 'partes'), detalle: lineasDelTrabajo(p, e, 'detalle') },
  };
  return new Response(JSON.stringify(cuerpo), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
};
