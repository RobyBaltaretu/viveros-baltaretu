import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas en navegador (accesibilidad con axe y recorridos con teclado) sobre el
 * build servido con el runtime de Cloudflare. El build incluye las fichas de
 * ejemplo (rama distinta de main) para que haya contenido que revisar.
 * En local, CHROMIUM_PATH permite usar un Chromium ya instalado.
 */
export default defineConfig({
  testDir: 'tests-e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4329',
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // --ignore-lock: servidor en primer plano también cuando Astro detecta un agente.
    command: 'tsx scripts/contenido/importar.ts && astro build && astro preview --port 4329 --ignore-lock',
    // Entorno `desarrollo`: D1 local (con el contenido importado) para probar el panel.
    env: { WORKERS_CI_BRANCH: 'pruebas-e2e', ASTRO_TELEMETRY_DISABLED: '1', CLOUDFLARE_ENV: 'desarrollo' },
    url: 'http://localhost:4329/',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
