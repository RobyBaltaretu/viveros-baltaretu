import type { ErrorCampo } from '../contenido/validacion.ts';
import type { SesionOk } from './pagina.ts';
import { plantaActual } from './planta-actual.ts';
import { guardarPlanta, leerFormularioPlanta, type DatosPlanta } from './plantas.ts';

/**
 * Lógica común de las pantallas que cambian una planta: carga la planta, y si
 * llega el formulario lo valida y guarda como borrador.
 */
export async function pantallaPlanta(s: SesionOk | null, id: string | undefined, request: Request) {
  const planta = await plantaActual(s, id);
  let datos: DatosPlanta | undefined = planta?.datos;
  let errores: ErrorCampo[] = [];
  let guardado = false;
  if (s && planta && request.method === 'POST') {
    datos = leerFormularioPlanta(await request.formData(), planta.datos);
    const r = await guardarPlanta(s.repos, planta.entrada.id, datos, { email: s.usuario.email });
    if (r.ok) guardado = true;
    else errores = r.errores;
  }
  const error = (campo: string) => errores.find((e) => e.campo === campo)?.mensaje;
  return { planta, datos, errores, error, guardado, volver: `/panel/plantas/${id}` };
}

/** "18.5" → "18,5" para mostrar en los campos. */
export const aTexto = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? String(n).replace('.', ',') : '');
