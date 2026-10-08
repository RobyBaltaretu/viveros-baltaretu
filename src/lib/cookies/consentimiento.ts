/**
 * Consentimiento de cookies de analítica (regla de CLAUDE.md: GA4 solo se carga
 * después de que la persona lo acepte). Se guarda en localStorage.
 */
export type Consentimiento = 'aceptado' | 'rechazado';

export const CLAVE_CONSENTIMIENTO = 'vivero:consentimiento-cookies';
/** IDs de prueba: muestran el aviso pero nunca cargan Google Analytics. */
export const PREFIJO_ID_PRUEBA = 'G-PRUEBA';

interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

export function leerConsentimiento(almacen: Almacen | undefined): Consentimiento | null {
  try {
    const valor = almacen?.getItem(CLAVE_CONSENTIMIENTO);
    return valor === 'aceptado' || valor === 'rechazado' ? valor : null;
  } catch {
    return null;
  }
}

export function guardarConsentimiento(almacen: Almacen | undefined, valor: Consentimiento): void {
  try {
    almacen?.setItem(CLAVE_CONSENTIMIENTO, valor);
  } catch {
    // Sin almacenamiento (modo privado): el aviso volverá a salir en la próxima visita.
  }
}

/** Solo se carga GA4 con consentimiento y con un ID real. */
export const debeCargarAnalitica = (consentimiento: Consentimiento | null, id: string) =>
  consentimiento === 'aceptado' && /^G-[A-Z0-9]+$/.test(id) && !id.startsWith(PREFIJO_ID_PRUEBA);
