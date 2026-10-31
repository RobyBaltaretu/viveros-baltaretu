import { SUGERENCIAS } from '../../src/server/asistente/formato.ts';
import type { VocabularioPanel } from '../../src/plataforma/vocabulario.ts';

/** Vivero (Viveros Baltaretu): los textos de siempre del panel. */
export const vocabularioVivero: VocabularioPanel = {
  tituloPanel: 'Panel del vivero',
  nombreAsistente: 'AgricolAI',
  asistenteDe: 'del vivero',
  asistentePuede: 'ventas, facturas, gastos o plantas',
  sugerencias: SUGERENCIAS,
  zonas: { plantas: { texto: 'Plantas', descripcion: 'Catálogo, inventario y fotos', icono: 'plantas' } },
  escenaInicio: 'plantas',
};
