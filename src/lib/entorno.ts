import { mostrarNoRevisadas, type EntornoPublicacion } from './catalogo/publicacion';

/** Entorno del build actual. Las ramas llegan inyectadas en astro.config.mjs (el prerender corre en workerd). */
export const entornoActual = (): EntornoPublicacion => ({
  dev: import.meta.env.DEV,
  ramaCi: import.meta.env.WORKERS_CI_BRANCH,
  ramaProduccion: import.meta.env.PRODUCTION_BRANCH,
});

/** Desarrollo local y builds de ramas de prueba: se ven las fichas sin revisar y los datos de prueba. */
export const esEntornoDePrueba = () => mostrarNoRevisadas(entornoActual());
