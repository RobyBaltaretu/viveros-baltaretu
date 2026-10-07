import { defineConfig } from 'vitest/config';

// Configuración independiente de Astro: el plugin de Cloudflare no admite dos
// servidores de Vite a la vez. Los tests solo usan módulos TypeScript normales.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
