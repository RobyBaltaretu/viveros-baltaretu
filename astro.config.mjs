// @ts-check
import { defineConfig } from 'astro/config';
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
