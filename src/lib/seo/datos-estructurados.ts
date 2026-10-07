/**
 * Datos estructurados (JSON-LD, schema.org). Funciones puras: no inventan nada.
 * Lo que es [PLACEHOLDER] o falta no se publica (sin datos de empresa falsos,
 * sin precios que no estén en la ficha).
 */
import { esPlaceholder, type Empresa } from '../empresa/schema';
import type { Disponibilidad } from '../catalogo/tipos';

type Objeto = Record<string, unknown>;

const DISPONIBILIDAD: Record<Disponibilidad, string> = {
  disponible: 'https://schema.org/InStock',
  'bajo-pedido': 'https://schema.org/BackOrder',
  agotado: 'https://schema.org/OutOfStock',
};

/** Organización (LocalBusiness) solo si hay nombre real; cada dato, solo si está confirmado. */
export function organizacion(empresa: Empresa, url: string): Objeto | null {
  if (esPlaceholder(empresa.nombre)) return null;
  const datos: Objeto = { '@type': 'LocalBusiness', '@id': `${url}#empresa`, name: empresa.nombre, url };
  if (!esPlaceholder(empresa.telefono)) datos.telephone = empresa.telefono;
  if (!esPlaceholder(empresa.email)) datos.email = empresa.email;
  if (!esPlaceholder(empresa.direccion)) datos.address = empresa.direccion;
  datos.areaServed = { '@type': 'Country', name: 'España' };
  return datos;
}

export function sitioWeb(nombre: string | null, url: string, idioma: string): Objeto {
  return { '@type': 'WebSite', url, inLanguage: idioma, ...(nombre ? { name: nombre } : {}) };
}

export interface DatosProducto {
  nombre: string;
  nombreCientifico: string;
  descripcion: string;
  url: string;
  categoria: string;
  precioDesde?: number | null | undefined;
  disponibilidad: Disponibilidad;
  imagen?: string | undefined;
}

/** Producto con oferta "desde" (AggregateOffer.lowPrice) solo si la ficha tiene precio. */
export function producto(p: DatosProducto): Objeto {
  const datos: Objeto = {
    '@type': 'Product',
    name: p.nombre,
    alternateName: p.nombreCientifico,
    description: p.descripcion,
    url: p.url,
    category: p.categoria,
  };
  if (p.imagen) datos.image = p.imagen;
  if (p.precioDesde != null) {
    datos.offers = {
      '@type': 'AggregateOffer',
      lowPrice: p.precioDesde,
      priceCurrency: 'EUR',
      availability: DISPONIBILIDAD[p.disponibilidad],
      url: p.url,
    };
  }
  return datos;
}

export function migas(elementos: { nombre: string; url: string }[]): Objeto {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: elementos.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.nombre, item: e.url })),
  };
}

export function listaElementos(urls: { nombre: string; url: string }[]): Objeto {
  return {
    '@type': 'ItemList',
    itemListElement: urls.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.nombre, url: e.url })),
  };
}

export function articulo(a: { titulo: string; descripcion: string; url: string; idioma: string }): Objeto {
  return { '@type': 'Article', headline: a.titulo, description: a.descripcion, url: a.url, inLanguage: a.idioma };
}

/** Documento JSON-LD listo para incrustar (escapa "</" para no cerrar el <script>). */
export function aJsonLd(grafo: (Objeto | null)[]): string {
  const limpio = grafo.filter((g): g is Objeto => g !== null);
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': limpio }).replace(/</g, '\\u003c');
}
