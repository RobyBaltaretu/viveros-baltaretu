import type { APIRoute } from 'astro';
import { mostrarNoRevisadas } from '../lib/catalogo/publicacion';
import { generarRobots } from '../lib/seo/sitemap';

/** En builds de ramas de prueba (con contenido sin revisar) no se indexa nada. */
export const GET: APIRoute = ({ site }) => {
  const prueba = mostrarNoRevisadas({
    dev: import.meta.env.DEV,
    ramaCi: import.meta.env.WORKERS_CI_BRANCH,
    ramaProduccion: import.meta.env.PRODUCTION_BRANCH,
  });
  return new Response(generarRobots(site!, !prueba), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
