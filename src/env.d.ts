interface ImportMetaEnv {
  /** Clave de sitio (pública) del widget de Turnstile. */
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  /** ID de medición de Google Analytics 4 (G-XXXXXXX). Solo se carga tras el consentimiento. */
  readonly PUBLIC_GA4_ID?: string;
  /** Inyectadas en astro.config.mjs (ver src/lib/catalogo/index.ts). */
  readonly WORKERS_CI_BRANCH: string;
  readonly PRODUCTION_BRANCH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Bindings y variables del Worker. Se declaran a mano (en vez de los tipos completos
 * del runtime de Workers) para no mezclar sus globales con los del DOM en los
 * scripts del navegador. Cada ruta del Worker tipa lo que usa.
 */
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}

declare namespace App {
  interface Locals {
    /** Sesión del panel (solo en `/panel` y `/api/panel/*`, ver src/middleware.ts). */
    panel?: import('./server/panel/acceso.ts').SesionPanel;
  }
}
