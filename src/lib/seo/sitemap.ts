/** Sitemap con alternativas hreflang exactas (nuestras URL en inglés están traducidas). */
export interface PaginaSitemap {
  es: string;
  en: string;
}

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function generarSitemap(paginas: PaginaSitemap[], sitio: string | URL): string {
  const abs = (ruta: string) => escapar(new URL(ruta, sitio).href);
  const urls = paginas.flatMap((p) =>
    (['es', 'en'] as const).map(
      (idioma) => `  <url>
    <loc>${abs(p[idioma])}</loc>
    <xhtml:link rel="alternate" hreflang="es" href="${abs(p.es)}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${abs(p.en)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(p.es)}"/>
  </url>`,
    ),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

export function generarRobots(sitio: string | URL, indexable: boolean): string {
  if (!indexable) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nDisallow: /keystatic\nDisallow: /api/\n\nSitemap: ${new URL('/sitemap.xml', sitio).href}\n`;
}
