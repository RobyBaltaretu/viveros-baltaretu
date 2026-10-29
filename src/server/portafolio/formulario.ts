import type { EntradaProyecto } from './portafolio.ts';

/** Datos del formulario de un proyecto, tal como llegan del navegador. */
export function leerFormularioProyecto(form: FormData): EntradaProyecto {
  const texto = (n: string) => String(form.get(n) ?? '').trim();
  const anio = texto('anio');
  return {
    titulo: texto('titulo'),
    categoria: texto('categoria'),
    descripcion: texto('descripcion'),
    materiales: texto('materiales'),
    anio: anio ? Number(anio) : null,
    localidad: texto('localidad'),
    destacado: form.get('destacado') !== null,
  };
}
