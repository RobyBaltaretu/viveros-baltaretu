import { vocabularioCarpinteria } from '../../paquetes-sector/carpinteria/vocabulario.ts';
import { vocabularioVivero } from '../../paquetes-sector/vivero/vocabulario.ts';
import { clienteActual } from './actual.ts';
import type { SECTORES } from './configuracion.ts';
import type { NombreIcono } from '../server/panel/iconos.ts';

/**
 * Palabras del panel que dependen del sector (paquetes-sector/<sector>/).
 * Lo demás del panel es común. Las del vivero son las de siempre.
 */
export interface VocabularioPanel {
  /** Título de la pestaña del navegador y texto bajo el nombre en el logo. */
  tituloPanel: string;
  nombreAsistente: string;
  /** Debajo del nombre en el chat, y de quién es el cupo de IA. */
  asistenteDe: string;
  /** Qué se le puede pedir (saludo del chat). */
  asistentePuede: string;
  /** Ejemplos para empezar. */
  sugerencias: string[];
  /** Nombre y descripción de las zonas del menú que cambian con el sector. */
  zonas: { plantas: { texto: string; descripcion: string; icono: NombreIcono } };
  /** Dibujo del saludo del inicio (escena de `Ilustracion.astro`). */
  escenaInicio: 'plantas' | 'fotos';
}

const POR_SECTOR: Record<(typeof SECTORES)[number], VocabularioPanel> = { vivero: vocabularioVivero, carpinteria: vocabularioCarpinteria };

export const vocabularioPanel = (): VocabularioPanel => POR_SECTOR[clienteActual().sector];
