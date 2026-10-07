import type { APIRoute } from 'astro';
import { rutaFicha } from '../i18n/ui';
import { obtenerEspecies } from '../lib/catalogo';

/**
 * Índice estático de las especies publicadas, para pintar la lista de presupuesto
 * en el navegador (nombres y enlaces). Se genera en el build: no ejecuta el Worker.
 */
export const GET: APIRoute = async () => {
  const especies = await obtenerEspecies('es');
  const indice = Object.fromEntries(
    especies.map(({ data }) => [
      data.slug,
      {
        nombre: data.nombre,
        cientifico: data.nombreCientifico,
        url: { es: rutaFicha('es', data.slug), en: rutaFicha('en', data.slug) },
      },
    ]),
  );
  return new Response(JSON.stringify(indice), { headers: { 'Content-Type': 'application/json' } });
};
