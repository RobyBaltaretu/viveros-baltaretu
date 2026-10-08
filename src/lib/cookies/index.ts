import { esEntornoDePrueba } from '../entorno';
import { PREFIJO_ID_PRUEBA } from './consentimiento';

/**
 * ID de GA4 del build: el de PUBLIC_GA4_ID o, en vistas de prueba, uno de prueba
 * que muestra el aviso sin cargar nada. Vacío = sin analítica ni aviso.
 */
export const idAnalitica = (): string =>
  import.meta.env.PUBLIC_GA4_ID || (esEntornoDePrueba() ? `${PREFIJO_ID_PRUEBA}0000` : '');
