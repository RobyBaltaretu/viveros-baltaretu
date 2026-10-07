import type { APIRoute } from 'astro';
import { rutaFamilia, rutaFicha, rutaGuia, rutaProyecto, rutas } from '../i18n/ui';
import { obtenerEspecies } from '../lib/catalogo';
import { FAMILIAS } from '../lib/catalogo/schema';
import { obtenerGuias, obtenerProyectos } from '../lib/paginas';
import { generarSitemap, type PaginaSitemap } from '../lib/seo/sitemap';

/** Se genera en el build con las mismas reglas de publicación que las páginas. */
export const GET: APIRoute = async ({ site }) => {
  const [especies, proyectos, guias] = await Promise.all([obtenerEspecies('es'), obtenerProyectos(), obtenerGuias()]);
  const fijas = (
    ['inicio', 'catalogo', 'proyectos', 'guias', 'reparto', 'nosotros', 'presupuesto', 'avisoLegal', 'privacidad', 'cookies'] as const
  ).map((clave) => rutas[clave]);
  const paginas: PaginaSitemap[] = [
    ...fijas,
    ...FAMILIAS.filter((f) => especies.some((e) => e.data.familia === f)).map((f) => ({ es: rutaFamilia('es', f), en: rutaFamilia('en', f) })),
    ...especies.map(({ data }) => ({ es: rutaFicha('es', data.slug), en: rutaFicha('en', data.slug) })),
    ...proyectos.map(({ data }) => ({ es: rutaProyecto('es', data.slug), en: rutaProyecto('en', data.slug) })),
    ...guias.map(({ data }) => ({ es: rutaGuia('es', data.slug), en: rutaGuia('en', data.slug) })),
  ];
  return new Response(generarSitemap(paginas, site!), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
