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

/** Páginas del menú principal, en orden. Se amplía a medida que existen las páginas. */
export const navegacion = ['catalogo'] as const satisfies readonly (keyof typeof rutas)[];

export const nombresIdioma: Record<Idioma, string> = { es: 'Español', en: 'English' };

/** Parte de la URL de cada familia: /catalogo/palmeras/ y /en/catalogue/palm-trees/. */
export const slugFamilia: Record<Familia, Record<Idioma, string>> = {
  palmeras: { es: 'palmeras', en: 'palm-trees' },
  olivos: { es: 'olivos', en: 'olive-trees' },
  higueras: { es: 'higueras', en: 'fig-trees' },
  'otras-ornamentales': { es: 'otras-ornamentales', en: 'other-ornamentals' },
};

export function rutaFamilia(idioma: Idioma, familia: Familia): string {
  return `${rutas.catalogo[idioma]}${slugFamilia[familia][idioma]}/`;
}

export function rutaFicha(idioma: Idioma, slug: string): string {
  return `${rutas.catalogo[idioma]}${slug}/`;
}

export const textos = {
  es: {
    saltarAlContenido: 'Saltar al contenido',
    navegacionPrincipal: 'Navegación principal',
    menu: 'Menú',
    cerrarMenu: 'Cerrar menú',
    irAInicio: 'Ir a la página de inicio',
    lemaEmpresa: 'Vivero mayorista de plantas ornamentales en la provincia de Valencia, con reparto a toda España.',
    contacto: 'Contacto',
    navegacion: 'Navegación',
    idioma: 'Idioma',
    telefono: 'Teléfono',
    email: 'Email',
    direccion: 'Dirección',
    derechos: 'Todos los derechos reservados.',
    antetituloPortada: 'Vivero mayorista · Provincia de Valencia',
    pedirPresupuesto: 'Pedir presupuesto',
    verCatalogo: 'Ver catálogo',
    persona: 'Persona',
    alturaPersona: '1,8 m',
    hastaAltura: 'hasta',
    escenaPortada: 'Escala real: una persona de 1,8 m junto a ejemplares del catálogo a su altura máxima.',
    tituloConfianza: 'Lo que cuenta en una obra',
    mision: 'Misión',
    vision: 'Visión',
    verFicha: 'Ver ficha',
    familiasNav: 'Familias',
    todas: 'Todas',
    eligePorTamano: 'Elige por tamaño',
    alturaMinima: 'Altura mínima',
    alturaMaxima: 'Altura máxima',
    rangoAltura: 'De {min} a {max} m',
    cualquierAltura: 'Cualquier altura',
    filtroFamilia: 'Familia',
    filtroFormato: 'Formato',
    filtroPerimetro: 'Perímetro de tronco',
    cualquiera: 'Cualquiera',
    perimetroHasta30: 'Hasta 30 cm',
    perimetro30a80: '30–80 cm',
    perimetroMas80: 'Más de 80 cm',
    borrarFiltros: 'Borrar filtros',
    resultados: '{n} especies',
    resultadosUno: '1 especie',
    sinResultados: 'Ninguna especie cumple estos filtros. Prueba a ampliar la altura o a quitar alguno.',
    alturaEjemplar: 'Altura',
    presupuestoTitulo: 'Pide tu presupuesto',
    presupuestoProvisional: 'El formulario de presupuesto está en preparación. Mientras tanto, puedes escribirnos o llamarnos:',
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
    menu: 'Menu',
    cerrarMenu: 'Close menu',
    irAInicio: 'Go to the home page',
    lemaEmpresa: 'Wholesale nursery of ornamental plants in the province of Valencia, delivering across Spain.',
    contacto: 'Contact',
    navegacion: 'Navigation',
    idioma: 'Language',
    telefono: 'Phone',
    email: 'Email',
    direccion: 'Address',
    derechos: 'All rights reserved.',
    antetituloPortada: 'Wholesale nursery · Province of Valencia',
    pedirPresupuesto: 'Request a quote',
    verCatalogo: 'Browse the catalogue',
    persona: 'Person',
    alturaPersona: '1.8 m',
    hastaAltura: 'up to',
    escenaPortada: 'True scale: a 1.8 m person next to catalogue specimens at their maximum height.',
    tituloConfianza: 'What matters on site',
    mision: 'Mission',
    vision: 'Vision',
    verFicha: 'View details',
    familiasNav: 'Families',
    todas: 'All',
    eligePorTamano: 'Choose by size',
    alturaMinima: 'Minimum height',
    alturaMaxima: 'Maximum height',
    rangoAltura: '{min} to {max} m',
    cualquierAltura: 'Any height',
    filtroFamilia: 'Family',
    filtroFormato: 'Format',
    filtroPerimetro: 'Trunk girth',
    cualquiera: 'Any',
    perimetroHasta30: 'Up to 30 cm',
    perimetro30a80: '30–80 cm',
    perimetroMas80: 'Over 80 cm',
    borrarFiltros: 'Clear filters',
    resultados: '{n} species',
    resultadosUno: '1 species',
    sinResultados: 'No species match these filters. Try a wider height range or remove a filter.',
    alturaEjemplar: 'Height',
    presupuestoTitulo: 'Request a quote',
    presupuestoProvisional: 'The quote form is being prepared. In the meantime, you can email or call us:',
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
