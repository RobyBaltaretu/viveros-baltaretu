import type { ErrorCampo } from '../contenido/validacion.ts';
import type { SesionOk } from './pagina.ts';
import { guardarPlanta, leerFormularioPlanta, revisarPlanta, slugDesde, type DatosPlanta } from './plantas.ts';

/** Pasos del alta guiada: una pregunta por pantalla. */
export const PASOS = [
  { titulo: '¿Cómo se llama?', presentes: 'nombre.es,nombreCientifico', campos: ['nombre.es', 'nombreCientifico'] },
  { titulo: '¿De qué familia es?', presentes: 'familia', campos: ['familia'] },
  { titulo: '¿Qué alturas tienes?', presentes: 'alturaMin,alturaMax,perimetro', campos: ['alturaMin', 'alturaMax', 'perimetroTroncoCm'] },
  { titulo: '¿Cuánto cuesta?', presentes: 'precioDesde,ventaUnitaria,precioUnidad', campos: ['precioDesde', 'precioUnidad'] },
  { titulo: '¿Hay ahora y cómo se entrega?', presentes: 'disponibilidad,formatos', campos: ['disponibilidad', 'formatos'] },
  { titulo: 'Descríbela', presentes: 'descripcion.es,nombre.en,descripcion.en', campos: ['descripcion.es', 'nombre.en', 'descripcion.en'] },
  { titulo: 'Revisa y guarda', presentes: 'origen,destacada,revisado', campos: ['origen'] },
] as const;

const BASE: DatosPlanta = { unidadPrecio: 'unidad', fotos: [], datosDeEjemplo: false, revisado: false, destacada: false, ventaUnitaria: false, formatos: [] };

export interface EstadoAlta {
  paso: number;
  datos: DatosPlanta;
  errores: ErrorCampo[];
  /** Identificador de la planta creada. */
  creada?: string;
}

function leerEstado(texto: string): DatosPlanta {
  try {
    const d = JSON.parse(texto) as DatosPlanta;
    return d && typeof d === 'object' ? d : { ...BASE };
  } catch {
    return { ...BASE };
  }
}

export async function pasoAlta(s: SesionOk, request: Request): Promise<EstadoAlta> {
  if (request.method !== 'POST') return { paso: 0, datos: { ...BASE }, errores: [] };
  const form = await request.formData();
  const paso = Math.min(Math.max(Number(form.get('paso')) || 0, 0), PASOS.length - 1);
  const datos = leerFormularioPlanta(form, { ...BASE, ...leerEstado(String(form.get('estado') ?? '')) });
  if (form.get('accion') === 'atras') return { paso: Math.max(paso - 1, 0), datos, errores: [] };
  const campos = new Set<string>(PASOS[paso].campos);
  const errores = revisarPlanta(datos).filter((e) => campos.has(e.campo));
  if (errores.length) return { paso, datos, errores };
  if (paso < PASOS.length - 1) return { paso: paso + 1, datos, errores: [] };

  // Último paso: identificador libre a partir del nombre y guardado como borrador.
  const raiz = slugDesde(String(datos.nombre?.es ?? datos.nombreCientifico ?? 'planta')) || 'planta';
  let id = raiz;
  for (let i = 2; await s.repos.contenido.obtener('catalogo', id); i++) id = `${raiz}-${i}`;
  datos.slug = id;
  const r = await guardarPlanta(s.repos, id, datos, { email: s.usuario.email });
  return r.ok ? { paso, datos, errores: [], creada: id } : { paso, datos, errores: r.errores };
}
