import type { VocabularioPanel } from '../../src/plataforma/vocabulario.ts';

/**
 * Carpintería a medida (Creaciones Turia). El asistente se llama «Gubia»
 * (la herramienta del carpintero para tallar y rematar; P-09, 31-10-2026).
 */
export const vocabularioCarpinteria: VocabularioPanel = {
  tituloPanel: 'Panel de la carpintería',
  nombreAsistente: 'Gubia',
  asistenteDe: 'del taller',
  asistentePuede: 'facturas, cobros, clientes o gastos',
  sugerencias: [
    '¿Qué tengo pendiente hoy?',
    '¿Cuánto hemos facturado este mes?',
    '¿Qué facturas están vencidas?',
    'Marca como cobradas las facturas vencidas de un cliente',
    'Hazle una factura a un cliente',
    '¿En qué hemos gastado más este trimestre?',
    'Apunta un gasto de tableros de 320 € de hoy',
  ],
  zonas: { plantas: { texto: 'Taller', descripcion: 'Catálogo con precios y portafolio de trabajos', icono: 'catalogo' } },
  escenaInicio: 'fotos',
};
