# CLAUDE.md: web del vivero mayorista

## Proyecto
Web corporativa y de catálogo de **Viveros Baltaretu**, vivero mayorista de plantas ornamentales (provincia de Valencia, reparto a toda España). Objetivos: posicionar en Google, mostrar el catálogo con fotos reales y convertir visitas en peticiones de presupuesto o contactos por WhatsApp. No es una tienda online.

Negocio (confirmado por el propietario):
- Planta pequeña y mediana, **hasta 4 m** de altura. Nada de "gran porte".
- Venta normalmente **al por mayor**. Algunas especies también se venden **por unidad** y se envían al destino (campos `ventaUnitaria` y `precioUnidad` de cada ficha). Ambos casos pasan por la lista y la petición de presupuesto, que indica el tipo de pedido.
- Pedido mínimo, plazos y envío por unidad: singleton "Condiciones de venta" (`src/content/ajustes/condiciones.yaml`).

## Stack
- Astro (páginas estáticas, JavaScript solo en componentes interactivos) y Tailwind CSS.
- Catálogo en archivos Markdown con frontmatter, en `src/content/catalogo/`, validado con un esquema en cada build.
- Textos editables que no son fichas: datos de la empresa, portada y textos del catálogo en `src/content/ajustes/*.yaml`; páginas fijas (nosotros, reparto y legales) en `src/content/paginas/*.yaml`. Proyectos y guías son colecciones (`src/content/proyectos/`, `src/content/guias/`) con la misma regla de `revisado` que el catálogo. Nada de textos de contenido fijos en los componentes; los de interfaz van en `src/i18n/ui.ts`.
- Panel interno propio en `/panel` para el gerente, que no tiene GitHub: Astro en el servidor, contenido en D1 (borrador y publicado), acceso con Cloudflare Access y roles (propietario, gerente y como mucho un editor), y asistente (guiado y lenguaje natural con Workers AI). Todo el acceso a datos va por la capa de repositorios (`src/server/data/`). En el build, `scripts/contenido/descargar.ts` escribe el contenido publicado en `src/content` y `src/assets` (con `CONTENIDO_TOKEN`); sin token, se usan los archivos del repositorio. Detalles: `docs/panel-propio/`. El GitHub y el soporte los lleva el propietario del proyecto.
- Hosting en Cloudflare Workers con Static Assets (plan gratuito), con el adaptador `@astrojs/cloudflare` y `wrangler.jsonc`. No usar Vercel ni Netlify. Las páginas son estáticas. Solo ejecutan el Worker las rutas con `prerender = false`: formularios y presupuestos (`/api/*`, con Turnstile y Cloudflare Email Service) y el panel (`/panel`).
- Publicación: lo que se publica desde el panel sale solo a la web (decisión del propietario). El comando de despliegue de Workers Builds es `npm run desplegar` (`scripts/contenido/desplegar.ts`): despliega con `wrangler deploy` si el build lleva publicaciones del panel y, si no (cambios de código), sube una versión con `wrangler versions upload` que el propietario publica desde Cloudflare.
- Todo lo demás debe ser gratuito. Antes de elegir un servicio, comprobar sus límites actuales.

## Idiomas
Español en la raíz (`/`) e inglés bajo `/en/`. Cada texto se escribe en los dos idiomas, sin traducción literal. Etiquetas `hreflang` entre versiones.

## Reglas
- No inventar datos de la empresa. Lo que falte se marca como `[PLACEHOLDER]`.
- Los datos de ejemplo del catálogo llevan `datosDeEjemplo: true` y `revisado: false`. Nada con `revisado: false` se publica en producción.
- Precio visible como "desde X €"; si falta, "precio bajo presupuesto".
- Cambios siempre en rama con PR. No hacer push a `main`. Los cambios de código llegan a producción con aprobación manual del propietario.
- Ejecutar lint, tests y build antes de dar una tarea por terminada.
- Claves y secretos solo como variables de entorno, nunca en el repositorio.
- Accesibilidad WCAG 2.1 AA: etiquetas en formularios, contraste, navegación con teclado, textos alternativos.
- Cookies: Google Analytics 4 solo se carga tras el consentimiento del usuario (`AvisoCookies.astro`, ID en `PUBLIC_GA4_ID`; sin ID no hay aviso ni analítica).
- Textos legales: los revisa un asesor. No presentarlos como definitivos.
- Datos de prueba: `src/lib/pruebas/datos.ts` rellena los huecos pendientes (`[PLACEHOLDER]` o vacíos) solo en desarrollo y en builds de ramas que no son `main`, con un aviso visible "Vista de prueba". Nunca pisan un dato real ni llegan a producción. Los contactos de prueba usan valores que no llevan a nadie (email en example.com).

## Esquema de cada especie
`slug`, `familia` (palmeras, olivos, higueras, otras-ornamentales), `nombre {es,en}`, `nombreCientifico`, `descripcion {es,en}`, `alturaMin/Max` (m), `perimetroTroncoCm` (opcional), `formatos`, `disponibilidad` (disponible, bajo-pedido, agotado), `precioDesde` y `unidadPrecio`, `origen`, `destacada`, `ventaUnitaria` (también se vende por unidad, con envío), `precioUnidad` (solo con `ventaUnitaria`), `seo {es,en}`, `revisado`. `alturaMax` no puede pasar de 4 m (`ALTURA_MAXIMA`). Opcionales añadidos para la web: `fotos` (imagen + `alt {es,en}`), `silueta` (dibujo provisional; por defecto el de la familia) y `datosDeEjemplo`.

## Diseño
- Dirección: vivero mediterráneo, claro y sencillo. Mensaje directo para el público (jardinerías, paisajistas y obra; y particulares en las especies que se venden por unidad). Poca información por pantalla: nada de datos técnicos que no ayuden a comprar.
- Tokens en `src/styles/global.css` (`@theme` de Tailwind 4): crema (fondo), papel, verdor, oliva (marca), tinta (texto), gris (texto secundario), terracota (acento) y linea. Los contrastes se comprueban en `tests/tokens.test.ts`.
- La terracota es solo para lo que se pulsa (botón principal, con texto blanco). El oliva es el color de marca; la única superficie oscura es oliva (pie y llamada final). Superficies: `superficie-crema`, `superficie-papel`, `superficie-verde` y `superficie-oliva`, con su foco, acento y botón.
- Tipografía: Bricolage Grotesque para titulares y DM Sans para texto. Unidades en minúscula (m, cm).
- Componentes base en `src/components/ui/`. Dibujos a línea en `src/components/ilustraciones/` (`Silueta`: base en el suelo, altura del SVG = altura real), usados en el héroe, las familias, los marcadores de foto y el comparador de escala de la ficha. Las fotos van con `FotoOPlaceholder`: muestra la foto optimizada o "[FOTO: …]" en el mismo hueco.
- Portada: héroe (qué, a quién, cómo), familias, dos formas de comprar (al por mayor / por unidad, con las condiciones del panel), pasos, confianza y llamada final. Textos en el singleton "Portada".
- Catálogo: filtros principales (familia, altura, "También por unidad"); formato y perímetro en "Más filtros".
- Movimiento solo con CSS y dentro de `prefers-reduced-motion: no-preference` (balanceo suave de hojas). Las transiciones entre páginas son View Transitions nativas.
- Revisión visual: `/estilo-interno/` (solo en dev y ramas que no son `main`).

## Comandos
Requiere Node 22 (22.12 o superior, ver `.nvmrc`).
- `npm install`: instala dependencias.
- `npm run dev`: genera los tipos de Wrangler y arranca el servidor local en http://localhost:4321. Muestra también las fichas con `revisado: false`.
- `npm run build`: build en `dist/` (estáticos en `dist/client`, Worker en `dist/server`). Excluye las fichas sin revisar, salvo en builds de Workers Builds de ramas distintas de `main`.
- `npm run preview`: sirve el build con el runtime de Cloudflare (workerd). Las variables de runtime van en `.dev.vars` (ver `.dev.vars.example`).
- `npm run lint`: `wrangler types`, ESLint y `astro check` (tipos y esquema del contenido).
- `npm test`: tests con Vitest (validación de las fichas del catálogo y de la función de presupuestos).
- `npm run contenido:importar`, `contenido:copia`, `contenido:restaurar` y `contenido:equivalencia`: cargar el contenido en D1, copias de seguridad y comprobación de que el build desde D1 da la misma web.
- `npm run asistente:banco`: precisión del asistente con el banco de frases.
- `npm run test:e2e`: Playwright + axe sobre el build servido en workerd. Comprueba WCAG 2.1 AA en las páginas clave, en móvil y en escritorio, y los recorridos con teclado. En local, `CHROMIUM_PATH` permite usar un Chromium ya instalado.
- `npm run check:worker`: `wrangler deploy --dry-run`, que valida `wrangler.jsonc` y el bundle sin desplegar.
- Variables: las de build en `.env.example` y las de runtime en `.dev.vars.example`. Los pasos en Cloudflare están en el README.

La CI (`.github/workflows/ci.yml`) ejecuta `npm run lint`, `npm test`, `npm run build` y `npm run check:worker` en cada PR, y en trabajos aparte `npm run test:e2e` (web y panel, con D1 local) y `npm run contenido:equivalencia`.

## SEO
- Cada página tiene canonical, hreflang (es, en y x-default), Open Graph y JSON-LD (`src/lib/seo/`). Los datos estructurados nunca incluyen datos de empresa en `[PLACEHOLDER]` ni precios que no estén en la ficha.
- `/sitemap.xml` y `/robots.txt` se generan en el build con las mismas reglas de publicación. En builds de ramas de prueba, `robots.txt` bloquea todo.
- Imagen social por defecto: `public/og-imagen.png` (`node scripts/generar-imagen-og.mjs`).

## Documentos de referencia
Hoja de ruta, definición funcional y técnica, y estrategia SEO con el mapa de páginas.

Estado actual, preferencias del propietario y pendientes: `docs/estado.md`. Leerlo al empezar una sesión y actualizarlo al cerrar cada PR.

## Panel propio
- La web pública sigue estática y el diseño aceptado no se cambia por el panel.
- Nada fuera de `src/server/data/` consulta la base (lo comprueba un test). Se reutilizan los esquemas de `src/lib/*/schema.ts`.
- El panel: español llano, una tarea por pantalla, controles de 48 px, WCAG 2.1 AA (e2e en `tests-e2e/panel.spec.ts`). Un error del usuario nunca rompe la web: todo se valida con el esquema del build antes de guardar.
- El asistente solo ejecuta la lista cerrada de `src/server/asistente/acciones.ts`, siempre con confirmación Sí/No.
- Facturas (`src/server/facturas/`, `/panel/facturas`): una emitida no se cambia ni se borra (se corrige con una rectificativa); numeración correlativa por serie y año; los datos fiscales de la empresa están en D1 (`ajustes_privados`), no en la web. No es un sistema VeriFactu: no presentarlo como tal.
- Gastos (`src/server/gastos/`, `/panel/gastos`): el lector de tickets (Workers AI con visión) solo propone; el gasto queda «por revisar» hasta que una persona lo guarda. Las fotos de los tickets nunca se publican.
- Decisiones: `docs/panel-propio/decisiones.md`. Pasos del propietario: `docs/panel-propio/pasos-manuales.md`.
