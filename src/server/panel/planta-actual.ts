import type { Entrada } from '../data/tipos.ts';
import type { SesionOk } from './pagina.ts';
import type { DatosPlanta } from './plantas.ts';

/** Planta de la URL (`/panel/plantas/[id]/...`), sin archivar. */
export async function plantaActual(s: SesionOk | null, id: string | undefined): Promise<{ entrada: Entrada; datos: DatosPlanta } | null> {
  if (!s || !id) return null;
  const entrada = await s.repos.contenido.obtener('catalogo', id);
  if (!entrada || entrada.archivada) return null;
  return { entrada, datos: entrada.borrador.datos as DatosPlanta };
}
