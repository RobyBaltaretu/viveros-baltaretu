import { describe, expect, it } from 'vitest';
import { aJsonLd, organizacion, producto } from '../src/lib/seo/datos-estructurados';
import { textos } from '../src/i18n/ui';

const empresaPendiente = {
  nombre: '[PLACEHOLDER: nombre de la empresa]',
  telefono: '[PLACEHOLDER: teléfono]',
  whatsapp: '',
  email: '[PLACEHOLDER: email]',
  direccion: '',
};

describe('datos estructurados', () => {
  it('no publica la organización mientras el nombre sea un placeholder', () => {
    expect(organizacion(empresaPendiente, 'https://ejemplo.test/')).toBeNull();
  });

  it('solo incluye los datos de empresa confirmados', () => {
    const org = organizacion({ ...empresaPendiente, nombre: 'Vivero Real', telefono: '+34 600 000 000' }, 'https://ejemplo.test/');
    expect(org).toMatchObject({ '@type': 'LocalBusiness', name: 'Vivero Real', telephone: '+34 600 000 000' });
    expect(org).not.toHaveProperty('email');
    expect(org).not.toHaveProperty('address');
  });

  it('el producto solo lleva oferta si la ficha tiene precio', () => {
    const base = {
      nombre: 'Palmera canaria',
      nombreCientifico: 'Phoenix canariensis',
      descripcion: 'd',
      url: 'https://ejemplo.test/catalogo/phoenix-canariensis/',
      categoria: 'Palmeras',
      disponibilidad: 'bajo-pedido' as const,
    };
    expect(producto({ ...base, precioDesde: null })).not.toHaveProperty('offers');
    expect(producto({ ...base, precioDesde: 35 })).toMatchObject({
      offers: { '@type': 'AggregateOffer', lowPrice: 35, priceCurrency: 'EUR', availability: 'https://schema.org/BackOrder' },
    });
  });

  it('escapa "</" para no cerrar el script', () => {
    expect(aJsonLd([{ '@type': 'Thing', name: '</script><script>alert(1)</script>' }])).not.toContain('</script>');
  });
});

describe('i18n', () => {
  it('todos los textos de interfaz existen en español y en inglés', () => {
    expect(Object.keys(textos.en).sort()).toEqual(Object.keys(textos.es).sort());
    for (const idioma of ['es', 'en'] as const) {
      for (const [clave, valor] of Object.entries(textos[idioma])) expect(valor, `${idioma}.${clave}`).not.toBe('');
    }
  });
});

describe('sitemap y robots', async () => {
  const { generarRobots, generarSitemap } = await import('../src/lib/seo/sitemap');
  it('cada URL lleva sus alternativas hreflang', () => {
    const xml = generarSitemap([{ es: '/catalogo/', en: '/en/catalogue/' }], 'https://ejemplo.test');
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml).toContain('<loc>https://ejemplo.test/en/catalogue/</loc>');
    expect(xml).toContain('hreflang="es" href="https://ejemplo.test/catalogo/"');
    expect(xml).toContain('hreflang="x-default" href="https://ejemplo.test/catalogo/"');
  });
  it('robots: bloquea el panel y la API, y todo en builds de prueba', () => {
    expect(generarRobots('https://ejemplo.test', true)).toContain('Disallow: /keystatic');
    expect(generarRobots('https://ejemplo.test', true)).toContain('Sitemap: https://ejemplo.test/sitemap.xml');
    expect(generarRobots('https://ejemplo.test', false)).toBe('User-agent: *\nDisallow: /\n');
  });
});
