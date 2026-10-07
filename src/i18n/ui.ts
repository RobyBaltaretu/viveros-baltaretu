import type { Disponibilidad, Familia, Formato } from '../lib/catalogo/tipos';

export const IDIOMAS = ['es', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];
export const IDIOMA_POR_DEFECTO: Idioma = 'es';

/** Rutas de cada página en los dos idiomas. Español en la raíz, inglés bajo /en/. */
export const rutas = {
  inicio: { es: '/', en: '/en/' },
  catalogo: { es: '/catalogo/', en: '/en/catalogue/' },
  presupuesto: { es: '/presupuesto/', en: '/en/quote/' },
  presupuestoEnviado: { es: '/presupuesto/enviado/', en: '/en/quote/sent/' },
} as const satisfies Record<string, Record<Idioma, string>>;

export function rutaFicha(idioma: Idioma, slug: string): string {
  return `${rutas.catalogo[idioma]}${slug}/`;
}

export const textos = {
  es: {
    saltarAlContenido: 'Saltar al contenido',
    navegacionPrincipal: 'Navegación principal',
    inicio: 'Inicio',
    catalogo: 'Catálogo',
    cambiarIdioma: 'English',
    cambiarIdiomaEtiqueta: 'Ver esta página en inglés',
    tituloCatalogo: 'Catálogo de plantas',
    descripcionCatalogo: 'Catálogo mayorista de plantas ornamentales con reparto a toda España.',
    catalogoVacio: 'Todavía no hay especies publicadas.',
    altura: 'Altura',
    perimetroTronco: 'Perímetro de tronco',
    formatos: 'Formatos',
    disponibilidad: 'Disponibilidad',
    origen: 'Origen',
    familia: 'Familia',
    volverAlCatalogo: 'Volver al catálogo',
    avisoNoRevisado: 'Ficha pendiente de revisión: no se publicará en producción.',
    presupuestoEnviadoTitulo: 'Petición enviada',
    presupuestoEnviadoTexto: 'Hemos recibido tu petición de presupuesto. Te responderemos por email.',
    presupuestoErrorTitulo: 'No se ha podido enviar',
    presupuestoErrorTexto: 'Revisa los datos e inténtalo de nuevo. Si el problema continúa, escríbenos por WhatsApp o por email.',
  },
  en: {
    saltarAlContenido: 'Skip to content',
    navegacionPrincipal: 'Main navigation',
    inicio: 'Home',
    catalogo: 'Catalogue',
    cambiarIdioma: 'Español',
    cambiarIdiomaEtiqueta: 'View this page in Spanish',
    tituloCatalogo: 'Plant catalogue',
    descripcionCatalogo: 'Wholesale catalogue of ornamental plants with delivery across Spain.',
    catalogoVacio: 'No species have been published yet.',
    altura: 'Height',
    perimetroTronco: 'Trunk girth',
    formatos: 'Formats',
    disponibilidad: 'Availability',
    origen: 'Origin',
    familia: 'Family',
    volverAlCatalogo: 'Back to the catalogue',
    avisoNoRevisado: 'Entry pending review: it will not be published in production.',
    presupuestoEnviadoTitulo: 'Request sent',
    presupuestoEnviadoTexto: 'We have received your quote request and will reply by email.',
    presupuestoErrorTitulo: 'Your request could not be sent',
    presupuestoErrorTexto: 'Please check your details and try again. If the problem persists, contact us on WhatsApp or by email.',
  },
} as const satisfies Record<Idioma, Record<string, string>>;

export const familias: Record<Familia, Record<Idioma, string>> = {
  palmeras: { es: 'Palmeras', en: 'Palm trees' },
  olivos: { es: 'Olivos', en: 'Olive trees' },
  higueras: { es: 'Higueras', en: 'Fig trees' },
  'otras-ornamentales': { es: 'Otras ornamentales', en: 'Other ornamentals' },
};

export const formatos: Record<Formato, Record<Idioma, string>> = {
  contenedor: { es: 'Contenedor', en: 'Container' },
  cepellon: { es: 'Cepellón', en: 'Root ball' },
  'raiz-desnuda': { es: 'Raíz desnuda', en: 'Bare root' },
};

export const disponibilidades: Record<Disponibilidad, Record<Idioma, string>> = {
  disponible: { es: 'Disponible', en: 'In stock' },
  'bajo-pedido': { es: 'Bajo pedido', en: 'To order' },
  agotado: { es: 'Agotado', en: 'Out of stock' },
};
