// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import tailwindcss from '@tailwindcss/vite';

// URL pública para canonical y hreflang. En Workers Builds es obligatoria
// (variable de build SITE_URL): mientras no haya dominio propio, la URL *.workers.dev.
if (process.env.WORKERS_CI && !process.env.SITE_URL) {
  throw new Error('Falta la variable de build SITE_URL (URL pública con https://, sin barra final).');
}
const site = process.env.SITE_URL || 'http://localhost:4321';

export default defineConfig({
  site,
  // 'ignore' para que /api/* y las rutas de Keystatic funcionen sin barra final; enlaces y canonical la llevan.
  trailingSlash: 'ignore',
  // Web estática: todas las páginas se generan en el build. Solo las rutas con
  // `export const prerender = false` (formularios y panel) ejecutan el Worker.
  output: 'static',
  // Sin sesiones de Astro: así el adaptador no crea un espacio KV que no usamos.
  session: false,
  // `npm run panel:local` arranca sin el adaptador (en Node): el modo local de
  // Keystatic no funciona en workerd. Solo para editar contenido en local.
  adapter: process.env.KEYSTATIC_LOCAL
    ? undefined
    : cloudflare({
        // Imágenes optimizadas en el build con Sharp; sin el binding de Cloudflare Images.
        imageService: 'compile',
      }),
  // Keystatic añade /keystatic y /api/keystatic como rutas del Worker.
  integrations: [react(), keystatic()],
  // Fuentes servidas desde el propio dominio (subconjunto latino de Fontsource,
  // instalado con npm): sin peticiones a terceros y con fallbacks ajustados.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Bricolage Grotesque',
      cssVariable: '--font-bricolage',
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      display: 'swap',
      options: {
        variants: [
          {
            src: ['./node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wdth-normal.woff2'],
            weight: '200 800',
            // Eje de anchura: los titulares van condensados (75 %), como troncos.
            stretch: '75% 100%',
            style: 'normal',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'DM Sans',
      cssVariable: '--font-dm-sans',
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      display: 'swap',
      options: {
        variants: [
          {
            src: ['./node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2'],
            weight: '100 1000',
            style: 'normal',
          },
        ],
      },
    },
    {
      // Datos técnicos (alturas, perímetros, rótulos de plano).
      provider: fontProviders.local(),
      name: 'IBM Plex Mono',
      cssVariable: '--font-plex-mono',
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      display: 'swap',
      options: {
        variants: [
          { src: ['./node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2'], weight: '400', style: 'normal' },
          { src: ['./node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2'], weight: '500', style: 'normal' },
        ],
      },
    },
  ],
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
    define: {
      // Workers Builds solo expone estas variables al proceso de build (Node). El
      // prerender corre en workerd, así que se inyectan como constantes.
      'import.meta.env.WORKERS_CI_BRANCH': JSON.stringify(process.env.WORKERS_CI_BRANCH ?? ''),
      'import.meta.env.PRODUCTION_BRANCH': JSON.stringify(process.env.PRODUCTION_BRANCH ?? 'main'),
    },
  },
});
