import { describe, expect, it } from 'vitest';
import { compararBaseline, resumenBaseline } from '../../scripts/contenido/huella-build.mjs';
import produccion from './web-produccion.json';
import pruebas from './web-pruebas.json';

const huella = (cambios: Partial<Record<'archivos' | 'paginas' | 'jsonLd', Record<string, unknown>>> & { sitemap?: string; robots?: string } = {}) =>
  resumenBaseline({
    archivos: {
      'index.html': 'a',
      'en/index.html': 'b',
      '_astro/x.css': 'c',
      '_astro/foto.webp': 'd',
      ...cambios.archivos,
    },
    paginas: { 'index.html': 'a', 'en/index.html': 'b', ...cambios.paginas },
    jsonLd: { 'index.html': [{ '@type': 'LocalBusiness' }], ...cambios.jsonLd },
    sitemap: cambios.sitemap ?? '<urlset><url>/</url><url>/en/</url></urlset>',
    robots: cambios.robots ?? 'User-agent: *\nDisallow: /panel\n',
  });

describe('red de seguridad: web', () => {
  it('detecta rutas, páginas, estilos, JSON-LD, sitemap y robots distintos', () => {
    const base = huella();
    expect(compararBaseline(base, huella())).toEqual([]);
    expect(compararBaseline(base, huella({ archivos: { 'nueva/index.html': 'z' } }))).toEqual(['ruta nueva nueva/index.html']);
    expect(compararBaseline(base, huella({ paginas: { 'en/index.html': 'otra' } }))).toEqual(['cambia en/index.html']);
    expect(compararBaseline(base, huella({ archivos: { '_astro/x.css': 'otra' } }))).toEqual(['cambia _astro/x.css']);
    expect(compararBaseline(base, huella({ jsonLd: { 'index.html': [{ '@type': 'Store' }] } }))).toEqual(['JSON-LD distinto en index.html']);
    expect(compararBaseline(base, huella({ sitemap: '<urlset></urlset>' }))).toEqual(['sitemap.xml distinto']);
    expect(compararBaseline(base, huella({ robots: 'User-agent: *\nDisallow: /\n' }))).toEqual(['robots.txt distinto']);
    // Las imágenes cuentan por su nombre, no por sus bytes (varían entre máquinas).
    expect(compararBaseline(base, huella({ archivos: { '_astro/foto.webp': 'otros-bytes' } }))).toEqual([]);
  });

  it('la línea base guardada cubre las páginas clave en los dos idiomas', () => {
    for (const ruta of ['index.html', 'en/index.html', 'catalogo/index.html', 'en/catalogue/index.html', 'presupuesto/index.html', 'en/quote/index.html', 'sitemap.xml', 'robots.txt']) {
      expect(produccion.rutas, ruta).toContain(ruta);
      expect(pruebas.rutas, ruta).toContain(ruta);
    }
    // Las fichas de ejemplo (revisado: false) solo salen en la base de pruebas.
    expect(pruebas.rutas.filter((r) => r.startsWith('catalogo/')).length).toBeGreaterThan(produccion.rutas.filter((r) => r.startsWith('catalogo/')).length);
    expect(produccion.robots).toContain('Disallow: /panel');
    expect(pruebas.robots).toContain('Disallow: /');
  });
});
