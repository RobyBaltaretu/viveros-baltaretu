# CLAUDE.md: web del vivero mayorista

## Proyecto
Web corporativa y de catálogo para un vivero mayorista de plantas ornamentales (provincia de Valencia, reparto a toda España). Objetivos: posicionar en Google, mostrar el catálogo con fotos reales y convertir visitas en peticiones de presupuesto o contactos por WhatsApp. No es una tienda online.

## Stack
- Astro (páginas estáticas, JavaScript solo en componentes interactivos) y Tailwind CSS.
- Catálogo en archivos Markdown con frontmatter, en `src/content/catalogo/`, validado con un esquema en cada build.
- Textos editables que no son fichas, como singletons del panel: datos de la empresa, portada y textos del catálogo en `src/content/ajustes/*.yaml`; páginas fijas (nosotros, reparto y legales) en `src/content/paginas/*.yaml`. Proyectos y guías son colecciones (`src/content/proyectos/`, `src/content/guias/`) con la misma regla de `revisado` que el catálogo. Nada de textos de contenido fijos en los componentes; los de interfaz van en `src/i18n/ui.ts`.
- Panel interno con Keystatic para el gerente, que no tiene GitHub: acceso por Keystatic Cloud (gratuito hasta 3 usuarios). El GitHub y el soporte los lleva el propietario del proyecto.
- Hosting en Cloudflare Workers con Static Assets (plan gratuito), con el adaptador `@astrojs/cloudflare` y `wrangler.jsonc`. No usar Vercel ni Netlify. Las páginas son estáticas. Solo ejecutan el Worker las rutas con `prerender = false`: formularios y presupuestos (`/api/*`, con Turnstile y Cloudflare Email Service) y el panel (`/keystatic`).
- Producción con aprobación manual: Workers Builds sube versiones con `wrangler versions upload` y el propietario las publica desde el panel de Cloudflare.
- Todo lo demás debe ser gratuito. Antes de elegir un servicio, comprobar sus límites actuales.

## Idiomas
Español en la raíz (`/`) e inglés bajo `/en/`. Cada texto se escribe en los dos idiomas, sin traducción literal. Etiquetas `hreflang` entre versiones.

## Reglas
- No inventar datos de la empresa. Lo que falte se marca como `[PLACEHOLDER]`.
- Los datos de ejemplo del catálogo llevan `datosDeEjemplo: true` y `revisado: false`. Nada con `revisado: false` se publica en producción.
- Precio visible como "desde X €"; si falta, "precio bajo presupuesto".
- Cambios siempre en rama con PR. No hacer push a `main`. Producción requiere aprobación manual.
- Ejecutar lint, tests y build antes de dar una tarea por terminada.
- Claves y secretos solo como variables de entorno, nunca en el repositorio.
- Accesibilidad WCAG 2.1 AA: etiquetas en formularios, contraste, navegación con teclado, textos alternativos.
- Cookies: Google Analytics 4 solo se carga tras el consentimiento del usuario.
- Textos legales: los revisa un asesor. No presentarlos como definitivos.

## Esquema de cada especie
`slug`, `familia` (palmeras, olivos, higueras, otras-ornamentales), `nombre {es,en}`, `nombreCientifico`, `descripcion {es,en}`, `alturaMin/Max` (m), `perimetroTroncoCm` (opcional), `formatos`, `disponibilidad` (disponible, bajo-pedido, agotado), `precioDesde` y `unidadPrecio`, `origen`, `destacada`, `seo {es,en}`, `revisado`. Opcionales añadidos para la web: `fotos` (imagen + `alt {es,en}`), `silueta` (dibujo provisional; por defecto el de la familia) y `datosDeEjemplo`.

## Diseño
- Tokens en `src/styles/global.css` (`@theme` de Tailwind 4): bosque, superficie, lima, claro, texto, salvia y musgo. Los contrastes se comprueban en `tests/tokens.test.ts`.
- El lima es el único acento. Solo va sobre fondos oscuros (texto o borde) o como relleno con texto bosque, nunca como texto sobre claro. Las superficies (`superficie-oscura`, `superficie-media`, `superficie-clara`) ajustan el foco, el acento y el botón principal.
- Componentes base en `src/components/ui/`, siluetas SVG a escala en `src/components/ilustraciones/`. Las fotos van con `FotoOPlaceholder`: muestra la foto optimizada o "[FOTO: …]" ocupando el mismo hueco.
- Movimiento solo con CSS y dentro de `prefers-reduced-motion: no-preference`. Las transiciones entre páginas son View Transitions nativas.
- Revisión visual: `/estilo-interno/` (solo en dev y ramas que no son `main`).

## Comandos
Requiere Node 22 (22.12 o superior, ver `.nvmrc`).
- `npm install`: instala dependencias.
- `npm run dev`: genera los tipos de Wrangler y arranca el servidor local en http://localhost:4321. Muestra también las fichas con `revisado: false`.
- `npm run build`: build en `dist/` (estáticos en `dist/client`, Worker en `dist/server`). Excluye las fichas sin revisar, salvo en builds de Workers Builds de ramas distintas de `main`.
- `npm run preview`: sirve el build con el runtime de Cloudflare (workerd). Las variables de runtime van en `.dev.vars` (ver `.dev.vars.example`).
- `npm run lint`: `wrangler types`, ESLint y `astro check` (tipos y esquema del contenido).
- `npm test`: tests con Vitest (validación de las fichas del catálogo y de la función de presupuestos).
- `npm run panel:local`: servidor de desarrollo en Node, sin el adaptador de Cloudflare, para editar el contenido en http://127.0.0.1:4321/keystatic con el modo local de Keystatic, que escribe en disco. El modo local no funciona en workerd, así que en `npm run dev` y en producción el panel usa Keystatic Cloud (`PUBLIC_KEYSTATIC_CLOUD_PROJECT`).
- `npm run test:e2e`: Playwright + axe sobre el build servido en workerd. Comprueba WCAG 2.1 AA en las páginas clave, en móvil y en escritorio, y los recorridos con teclado. En local, `CHROMIUM_PATH` permite usar un Chromium ya instalado.
- `npm run check:worker`: `wrangler deploy --dry-run`, que valida `wrangler.jsonc` y el bundle sin desplegar.
- Variables: las de build en `.env.example` y las de runtime en `.dev.vars.example`. Los pasos en Cloudflare están en el README.

La CI (`.github/workflows/ci.yml`) ejecuta `npm run lint`, `npm test`, `npm run build` y `npm run check:worker` en cada PR, y en un trabajo aparte `npm run test:e2e`.

## SEO
- Cada página tiene canonical, hreflang (es, en y x-default), Open Graph y JSON-LD (`src/lib/seo/`). Los datos estructurados nunca incluyen datos de empresa en `[PLACEHOLDER]` ni precios que no estén en la ficha.
- `/sitemap.xml` y `/robots.txt` se generan en el build con las mismas reglas de publicación. En builds de ramas de prueba, `robots.txt` bloquea todo.
- Imagen social por defecto: `public/og-imagen.png` (`node scripts/generar-imagen-og.mjs`).

## Documentos de referencia
Hoja de ruta, definición funcional y técnica, y estrategia SEO con el mapa de páginas.
