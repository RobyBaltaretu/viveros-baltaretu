// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// URL pública para canonical y hreflang. Mientras no haya dominio definitivo
// se usa el dominio de producción que asigna Vercel.
const site =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:4321');

export default defineConfig({
  site,
  // Web estática: todas las páginas se generan en el build. El adaptador solo
  // crea funciones serverless para las rutas que lo pidan expresamente
  // (`export const prerender = false`), como el panel o los formularios.
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'always',
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
