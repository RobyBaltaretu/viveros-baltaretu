import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas en navegador del cliente Creaciones Turia (CLIENTE_ID=turia): solo
 * panel, con su portafolio privado. Mismo entorno local que las de Baltaretu
 * (D1 local vacía y entrada al panel sin Access desde localhost), en otro puerto.
 */
export default defineConfig({
  testDir: 'tests-e2e-turia',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4339',
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'rm -rf .wrangler/state/v3/d1 && astro build && astro preview --port 4339 --ignore-lock',
    env: { CLIENTE_ID: 'turia', WORKERS_CI_BRANCH: 'pruebas-e2e', ASTRO_TELEMETRY_DISABLED: '1', CLOUDFLARE_ENV: 'desarrollo' },
    url: 'http://localhost:4339/robots.txt',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
